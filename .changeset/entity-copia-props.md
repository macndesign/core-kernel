---
"core-kernel": patch
---

Documentação: o construtor da `Entity` já faz uma cópia rasa das props, então `create`/`restore` devem passar `props` direto, sem `{ ...props }`. Arrays e objetos internos continuam compartilhados com quem chamou e, se o chamador puder alterá-los, devem ser copiados na fábrica. Registrado na skill `ddd-entity` (diretriz e armadilha), no `llms.txt` e no JSDoc da `Entity`.
