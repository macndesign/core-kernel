---
name: adapter-postgres
tags: [infra]
runs: 3
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

Tenho este agregado num projeto TypeScript que usa o pacote `core-kernel`:

```ts
import { AggregateRoot, UniqueId } from "core-kernel";

export class ClienteId extends UniqueId {
  declare private readonly __brand: "ClienteId";
}
export class PedidoId extends UniqueId {
  declare private readonly __brand: "PedidoId";
}

interface PedidoProps {
  clienteId: ClienteId;
  total: number;
  status: "aberto" | "pago";
}

export class Pedido extends AggregateRoot<PedidoProps, PedidoId> {
  static restore(props: PedidoProps, id: PedidoId): Pedido {
    return new Pedido(props, id);
  }
  get clienteId() { return this.props.clienteId; }
  get total() { return this.props.total; }
  get status() { return this.props.status; }
}
```

Implemente em `src/pedido.pg-repository.ts` um repositório com o driver `pg` (`Pool`) com `create`, `update`, `findById` e `findByCliente(clienteId)`. A tabela é `pedidos (id text, cliente_id text, total numeric, status text)`. Não precisa rodar nada.
