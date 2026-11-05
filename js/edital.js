import { h, toast } from './ui.js';
import { isLeaf, flattenLeaves, coverage, formatPercent } from './calculations.js';
import { saveEditalProgress } from './storage.js';

const TRIPLE = [['nao_iniciado', 'Não iniciado', '○'], ['em_andamento', 'Em andamento', '◐'], ['concluido', 'Concluído', '●']];
const REV = [['nao_iniciada', 'Não iniciada', '○'], ['pendente', 'Pendente', '◐'], ['feita', 'Feita', '●']];
const FIELDS = [
  { key: 'theory', label: 'Teoria', opts: TRIPLE, def: 'nao_iniciado', done: 'concluido' },
  { key: 'exercises', label: 'Exercícios', opts: TRIPLE, def: 'nao_iniciado', done: 'concluido' },
  { key: 'revision', label: 'Revisão', opts: REV, def: 'nao_iniciada', done: 'feita' }
];
const MASTERY = [[0, 'Não avaliado'], [1, '1 - Muito baixo'], [2, '2 - Baixo'], [3, '3 - Médio'], [4, '4 - Alto'], [5, '5 - Muito alto']];
const BLOCKS = { gerais: 'Conhecimentos Gerais', especificos: 'Conhecimentos Específicos' };

const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function renderEdital(root, ctx) {
  const { edital } = ctx;
  const state = { q: '', disc: 'all', status: 'all' };
  const statRefs = new Map(); // discId -> função que atualiza os números da disciplina
  const val = (id, f) => ctx.progress[id]?.[f.key] ?? f.def;

  const list = h('div');
  const filtering = () => state.q !== '' || state.status !== 'all' || state.disc !== 'all';

  function statusOk(leaf) {
    if (state.status === 'all') return true;
    const [key, v] = state.status.split(':');
    const f = FIELDS.find(x => x.key === key);
    return val(leaf.id, f) === v;
  }

  function filterTree(topics, parentMatch) {
    const q = norm(state.q.trim());
    return topics.map(t => {
      const self = parentMatch || !q || norm(t.title).includes(q);
      if (isLeaf(t)) return self && statusOk(t) ? t : null;
      const kids = filterTree(t.children, self);
      return kids.length ? { ...t, children: kids } : null;
    }).filter(Boolean);
  }

  function chipsFor(leaf) {
    return FIELDS.map(f => {
      const v = val(leaf.id, f);
      const [, label, icon] = f.opts.find(o => o[0] === v);
      const cls = v === f.def ? 'chip' : v === f.done ? 'chip done' : 'chip mid';
      return h('span', { class: cls, title: `${f.label}: ${label}`, 'aria-label': `${f.label}: ${label}` }, `${f.label} ${icon}`);
    });
  }

  async function patch(leaf, chipsEl, changes) {
    ctx.progress[leaf.id] = { ...(ctx.progress[leaf.id] || {}), ...changes };
    chipsEl.replaceChildren(...chipsFor(leaf));
    statRefs.forEach(fn => fn());
    try {
      await saveEditalProgress(ctx.user.uid, leaf.id, changes);
      toast('Salvo');
    } catch (e) {
      console.error(e);
      toast('Não foi possível salvar. Verifique a conexão e as regras do Firestore.', 'error');
    }
  }

  function renderLeaf(leaf) {
    const chips = h('span', { class: 'chips' }, chipsFor(leaf));
    const p = () => ctx.progress[leaf.id] || {};
    const selects = FIELDS.map(f => {
      const id = `${leaf.id}-${f.key}`;
      return h('div', {},
        h('label', { for: id }, f.label),
        h('select', { id, onchange: e => patch(leaf, chips, { [f.key]: e.target.value }) },
          f.opts.map(([v, label]) => h('option', { value: v, selected: v === val(leaf.id, f) }, label))));
    });
    const mId = `${leaf.id}-mastery`;
    const mastery = h('div', {},
      h('label', { for: mId }, 'Domínio percebido'),
      h('select', { id: mId, onchange: e => patch(leaf, chips, { mastery: Number(e.target.value) }) },
        MASTERY.map(([v, label]) => h('option', { value: v, selected: v === (p().mastery ?? 0) }, label))));
    const nId = `${leaf.id}-notes`;
    const notes = h('div', { class: 'wide' },
      h('label', { for: nId }, 'Observações'),
      h('textarea', { id: nId, onchange: e => patch(leaf, chips, { notes: e.target.value }) }, p().notes || ''));
    return h('details', { class: 'leaf' },
      h('summary', {}, h('span', { class: 'leaf-title' }, leaf.title), chips),
      h('div', { class: 'leaf-form' }, selects, mastery, notes));
  }

  function renderTopics(topics) {
    return topics.map(t => isLeaf(t)
      ? renderLeaf(t)
      : h('div', { class: 'group' },
          h('div', { class: 'group-title' }, t.title),
          h('div', { class: 'group-body' }, renderTopics(t.children))));
  }

  function renderDisc(d) {
    const bar = h('i');
    const stats = h('div', { class: 'disc-stats' });
    const update = () => {
      const cov = FIELDS.map(f => coverage(d.topics, ctx.progress, f.key, f.done));
      bar.style.width = `${cov[0].percent ?? 0}%`;
      stats.replaceChildren(...cov.map((c, i) => h('span', {}, `${FIELDS[i].label}: ${c.total ? `${c.done}/${c.total}` : 'Sem dados'}`)));
    };
    statRefs.set(d.id, update);
    update();
    const filtered = filterTree(d.topics, false);
    const body = !d.topics.length
      ? h('p', { class: 'disc-empty' }, 'O conteúdo programático desta disciplina ainda não foi importado do Anexo IV.')
      : !filtered.length ? h('p', { class: 'disc-empty' }, 'Nenhum assunto encontrado com esses filtros.') : renderTopics(filtered);
    return h('details', { class: 'disc', open: filtering() && filtered.length > 0 },
      h('summary', {},
        h('div', { class: 'disc-top' }, h('span', { class: 'disc-name' }, d.name), h('span', { class: 'disc-q' }, `${d.questions} questões`)),
        h('div', { class: 'bar', role: 'presentation' }, bar),
        stats),
      h('div', { class: 'disc-body' }, body));
  }

  function renderList() {
    statRefs.clear();
    const discs = edital.disciplines.filter(d => state.disc === 'all' || d.id === state.disc);
    list.replaceChildren(...Object.entries(BLOCKS).flatMap(([bk, bname]) => {
      const ds = discs.filter(d => d.block === bk);
      return ds.length ? [h('h2', { class: 'block-title' }, bname), ...ds.map(renderDisc)] : [];
    }));
  }

  const toolbar = h('div', { class: 'toolbar' },
    h('div', {}, h('label', { for: 'f-q' }, 'Buscar assunto'),
      h('input', { id: 'f-q', type: 'search', placeholder: 'Digite parte do assunto', oninput: e => { state.q = e.target.value; renderList(); } })),
    h('div', {}, h('label', { for: 'f-d' }, 'Disciplina'),
      h('select', { id: 'f-d', onchange: e => { state.disc = e.target.value; renderList(); } },
        h('option', { value: 'all' }, 'Todas'),
        edital.disciplines.map(d => h('option', { value: d.id }, d.name)))),
    h('div', {}, h('label', { for: 'f-s' }, 'Status'),
      h('select', { id: 'f-s', onchange: e => { state.status = e.target.value; renderList(); } },
        h('option', { value: 'all' }, 'Todos'),
        FIELDS.flatMap(f => f.opts.map(([v, label]) => h('option', { value: `${f.key}:${v}` }, `${f.label}: ${label}`))))));

  const m = edital.meta;
  const meta = h('div', { class: 'meta-box' },
    h('strong', {}, 'Origem do conteúdo programático'),
    h('dl', {},
      h('dt', {}, 'Fonte'), h('dd', {}, m.fonte),
      h('dt', {}, 'Retificações'), h('dd', {}, m.retificacoes.join('; ') || 'Nenhuma'),
      h('dt', {}, 'Publicação'), h('dd', {}, m.dataPublicacao || 'Não registrada'),
      h('dt', {}, 'Última conferência'), h('dd', {}, m.ultimaConferencia || 'Não registrada'),
      h('dt', {}, 'Versão do conteúdo'), h('dd', {}, m.versaoConteudo || 'Não registrada')));

  const total = edital.disciplines.reduce((n, d) => n + flattenLeaves(d.topics).length, 0);
  root.replaceChildren(
    h('div', { class: 'page-head' }, h('h1', {}, 'Edital'),
      h('p', {}, total ? `${total} assuntos finais. Toque em um assunto para registrar teoria, exercícios, revisão e domínio.` : 'Disciplinas e questões já estão conforme o edital. Falta importar os assuntos do Anexo IV.')),
    toolbar, list, meta);
  renderList();
}
