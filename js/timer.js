import { h, toast, shorten } from './ui.js';
import { flattenLeaves, elapsedMs, pauseTimer, resumeTimer, formatClock, msToMinutes, formatDuration, toLocalDateKey } from './calculations.js';
import { ACTIVITIES, actLabel } from './constants.js';
import { loadTimer, saveTimer, clearTimer, saveSession } from './storage.js';

let tick = null;
export function stopTick() { clearInterval(tick); tick = null; }

export function renderTimer(box, ctx, onSaved) {
  stopTick();
  const uid = ctx.user.uid;
  const discs = ctx.edital.disciplines;
  const discName = id => discs.find(d => d.id === id)?.name ?? id;
  const topicsOf = id => flattenLeaves(discs.find(d => d.id === id)?.topics ?? []);
  const render = () => renderTimer(box, ctx, onSaved);
  const failed = e => { console.error(e); toast('Não foi possível concluir a ação. Verifique a conexão.', 'error'); };

  // Sempre confere o estado mais recente antes de agir (evita conflito entre dispositivos).
  async function fresh() {
    const cur = await loadTimer(uid);
    if (!cur) {
      ctx.timer = null;
      toast('Esta sessão já foi finalizada ou descartada em outro dispositivo.', 'error');
      render();
      return null;
    }
    ctx.timer = cur;
    return cur;
  }

  // ---------- Sem sessão ativa ----------
  function renderIdle() {
    const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const disc = h('select', { id: 't-disc' }, h('option', { value: '' }, 'Selecione a disciplina'), discs.map(d => h('option', { value: d.id }, d.name)));
    const topic = h('select', { id: 't-topic' }, h('option', { value: '' }, 'Disciplina inteira (sem assunto específico)'));
    disc.addEventListener('change', () => topic.replaceChildren(
      h('option', { value: '' }, 'Disciplina inteira (sem assunto específico)'),
      ...topicsOf(disc.value).map(t => h('option', { value: t.id }, shorten(t.title)))));
    const act = h('select', { id: 't-act' }, ACTIVITIES.map(([v, l]) => h('option', { value: v }, l)));
    const notes = h('textarea', { id: 't-notes' });
    const start = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      err.hidden = true;
      if (!disc.value) { err.textContent = 'Selecione a disciplina para iniciar.'; err.hidden = false; return; }
      start.disabled = true;
      try {
        const existing = await loadTimer(uid);
        if (existing) {
          ctx.timer = existing;
          toast('Já existe uma sessão em andamento (talvez em outro dispositivo).', 'error');
          return render();
        }
        const now = Date.now();
        const timer = {
          disciplineId: disc.value, topicId: topic.value || null, activity: act.value, notes: notes.value.trim(),
          status: 'running', startedAtMs: now, accumulatedMs: 0, lastResumeMs: now
        };
        await saveTimer(uid, timer);
        ctx.timer = timer;
        render();
      } catch (e) { failed(e); start.disabled = false; }
    } }, 'Iniciar sessão');

    box.replaceChildren(
      h('h2', {}, 'Cronômetro'),
      h('div', { class: 'clock muted', role: 'timer' }, '00:00:00'),
      h('div', { class: 'form-grid' },
        h('div', {}, h('label', { for: 't-disc' }, 'Disciplina'), disc),
        h('div', {}, h('label', { for: 't-topic' }, 'Assunto (opcional)'), topic),
        h('div', {}, h('label', { for: 't-act' }, 'Atividade'), act),
        h('div', { class: 'wide' }, h('label', { for: 't-notes' }, 'Observações'), notes)),
      err,
      h('div', { class: 'form-actions' }, start));
  }

  // ---------- Sessão ativa (rodando ou pausada) ----------
  function renderActive() {
    const t = ctx.timer;
    const running = t.status === 'running';
    const title = t.topicId ? flattenLeaves(discs.find(d => d.id === t.disciplineId)?.topics ?? []).find(x => x.id === t.topicId)?.title : '';
    const clock = h('div', { class: running ? 'clock' : 'clock paused', role: 'timer' });
    const upd = () => { clock.textContent = formatClock(elapsedMs(ctx.timer, Date.now())); };
    upd();
    if (running) tick = setInterval(upd, 1000);

    const notes = h('textarea', { id: 't-notes', onchange: async e => {
      try {
        const cur = await fresh();
        if (cur) { ctx.timer = { ...cur, notes: e.target.value.trim() }; await saveTimer(uid, ctx.timer); }
      } catch (ex) { failed(ex); }
    } }, t.notes || '');

    const toggle = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      toggle.disabled = true;
      try {
        const cur = await fresh();
        if (!cur) return;
        const next = running ? pauseTimer(cur, Date.now()) : resumeTimer(cur, Date.now());
        await saveTimer(uid, next);
        ctx.timer = next;
        render();
      } catch (e) { failed(e); toggle.disabled = false; }
    } }, running ? 'Pausar' : 'Retomar');

    const finish = h('button', { class: 'btn', type: 'button', onclick: async () => {
      finish.disabled = true;
      try {
        const cur = await fresh();
        if (!cur) return;
        const now = Date.now();
        const minutes = msToMinutes(elapsedMs(cur, now));
        if (minutes < 1) {
          toast('Menos de 30 segundos de estudo. Continue estudando ou descarte a sessão.', 'error');
          finish.disabled = false;
          return;
        }
        const data = {
          id: `timer-${cur.startedAtMs}`, // id fixo: tentar de novo não duplica a sessão
          date: toLocalDateKey(new Date(cur.startedAtMs)), disciplineId: cur.disciplineId, topicId: cur.topicId,
          activity: cur.activity, minutes, notes: notes.value.trim(), source: 'timer',
          startedAtMs: cur.startedAtMs, endedAtMs: now, createdAtMs: now
        };
        await saveSession(uid, data);
        ctx.sessions = [...ctx.sessions.filter(s => s.id !== data.id), data];
        await clearTimer(uid);
        ctx.timer = null;
        toast(`Sessão registrada: ${formatDuration(minutes)}`);
        render();
        onSaved();
      } catch (e) { failed(e); finish.disabled = false; }
    } }, 'Finalizar e salvar');

    const discard = h('button', { class: 'btn ghost danger', type: 'button', onclick: async () => {
      try {
        const cur = await fresh();
        if (!cur) return;
        const time = formatClock(elapsedMs(cur, Date.now()));
        if (!confirm(`Descartar a sessão em andamento (${time})? O tempo não será registrado e esta ação não pode ser desfeita.`)) return;
        await clearTimer(uid);
        ctx.timer = null;
        toast('Sessão descartada');
        render();
      } catch (e) { failed(e); }
    } }, 'Descartar');

    box.replaceChildren(
      h('h2', {}, 'Cronômetro'),
      h('div', { class: 'timer-state' }, running ? '● Em andamento' : '❚❚ Pausado'),
      clock,
      h('div', { class: 'timer-info' },
        h('div', {}, h('strong', {}, discName(t.disciplineId))),
        title && h('div', { class: 'muted' }, shorten(title, 120)),
        h('div', { class: 'muted' }, actLabel(t.activity))),
      h('label', { for: 't-notes' }, 'Observações'), notes,
      h('div', { class: 'form-actions' }, toggle, finish, discard));
  }

  if (ctx.timer) renderActive(); else renderIdle();
}
