# Banestes Tracker

Site pessoal para acompanhar a preparação para Técnico Bancário do Banestes (prova em 24/01/2027).
Feito só com HTML, CSS e JavaScript. Não precisa instalar nada para publicar.

## Configurar (uma vez)

1. No [Firebase Console](https://console.firebase.google.com), crie um projeto.
2. **Authentication** > Método de login > ative **E-mail/senha** e, na aba Usuários, adicione o seu e-mail e senha.
3. **Firestore Database** > Criar banco de dados. Depois, na aba Regras, cole o conteúdo de `firestore.rules` e publique.
4. **Configurações do projeto** > Seus apps > adicione um app **Web** e copie o `firebaseConfig` para `js/firebase-config.js`.

## Publicar

**Firebase Hosting:** instale o [Firebase CLI](https://firebase.google.com/docs/cli), depois, na pasta do projeto:

```
firebase login
firebase use --add      # escolha o seu projeto
firebase deploy
```

**Publicação automática pelo GitHub (opcional):** rode `firebase init hosting:github`; depois disso, cada `git push` publica o site sozinho.

## Testar no computador

```
python3 -m http.server 8080
```

Abra http://localhost:8080. (Abrir o arquivo direto no navegador não funciona, pois usa módulos ES.)

## Atualizar o conteúdo programático

O Anexo IV do Edital nº 01/2026 já está em `data/edital.json`. Se houver retificação, edite `topics` da disciplina. Os assuntos podem ter níveis; os tópicos finais (sem `children`) são os que contam no progresso. Os `id` devem ser únicos e **nunca mudar** depois de usados, para não perder o histórico:

```json
{ "id": "lp-01", "title": "Assunto", "children": [ { "id": "lp-01-01", "title": "Subassunto" } ] }
```

Preencha também `meta` (data de publicação, última conferência e versão).

## Testes dos cálculos

```
node tests/calculations.test.mjs
node tests/recommendations.test.mjs
```

Veja `TASKS.md` para o andamento das etapas.
