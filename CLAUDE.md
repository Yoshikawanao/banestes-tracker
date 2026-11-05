# Regras do projeto Banestes Tracker

- Fonte de verdade do concurso: edital oficial e retificações. Não inventar conteúdo do edital nem usar dados fictícios como reais.
- Só HTML, CSS e JavaScript (módulos ES). Sem frameworks, sem npm, sem build. Firebase (Auth, Firestore, Hosting) via CDN.
- Uma etapa por vez; só avançar quando o usuário validar a anterior. Atualizar TASKS.md.
- Cálculos em js/calculations.js (puros, com testes em tests/). Acesso ao Firestore só em js/storage.js.
- Interface em pt-BR, tema escuro, mobile primeiro. Sem "0%" quando não há dados: mostrar "Sem dados".
- Confirmar antes de ações destrutivas. Não depender só de cor para indicar status.
- Ao atualizar o edital por retificação, manter os ids dos tópicos para preservar o histórico de estudo.
