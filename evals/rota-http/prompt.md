---
name: rota-http
tags: [borda]
runs: 3
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

Num backend Express em TypeScript, tenho um caso de uso feito com o pacote `core-kernel`:

```ts
import type { CancelarPedidoUseCase } from "./cancelar-pedido.usecase.js";
// CancelarPedidoUseCase extends BaseUseCase<
//   { pedidoId: string; usuarioId: string },
//   Pedido,
//   NotFoundError | ForbiddenError | ConflictError
// >
```

Escreva em `src/rotas/pedidos.ts` a rota `POST /pedidos/:id/cancelar` que executa o caso de uso e responde com o status HTTP adequado para cada tipo de falha (inclusive falhas inesperadas de banco, como violação de chave estrangeira do Postgres) e com o pedido em caso de sucesso. O frontend lê o campo `error` (texto) do corpo de erro. Não precisa rodar nada.
