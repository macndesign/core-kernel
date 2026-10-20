---
type: llm
weight: 2
---

O repositório está correto para o core-kernel:
- todo id tipado passado como parâmetro de SQL usa `.value` (ex.: `[pedido.id.value, pedido.clienteId.value]`), nunca o objeto inteiro (`[pedido.id]`), que o `pg` gravaria como texto JSON com aspas;
- `findById`/`findByCliente` recebem ids tipados e reidratam com `restore` e `XxxId.from(...)` (ou equivalente), devolvendo `null` quando não encontra;
- falhas de banco não são convertidas em `Result` (o repositório lança; o `BaseUseCase` trata);
- a conversão linha ↔ agregado está isolada (mapper ou funções `toDomain`/`fromDomain`).
