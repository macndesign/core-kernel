// Tipos usados pelas outras fixtures. Os comentários `// espera: CKxxx` marcam, na linha, os
// achados esperados; linhas sem marca não podem ter achado.
import { BaseUseCase, ForbiddenError, NotFoundError, Result, UniqueId } from "core-kernel";

export class PedidoId extends UniqueId {
  declare private readonly __brand: "PedidoId";
}

export interface Pedido {
  id: PedidoId;
  clienteId: PedidoId | undefined;
}

export class CancelarPedidoUseCase extends BaseUseCase<
  { pedidoId: string },
  Pedido,
  NotFoundError | ForbiddenError
> {
  protected async handle(input: {
    pedidoId: string;
  }): Promise<Result<Pedido, NotFoundError | ForbiddenError>> {
    const id = PedidoId.from(input.pedidoId);
    if (id.isFail()) return Result.fail(new NotFoundError("Pedido não encontrado"));
    return Result.ok({ id: id.value, clienteId: undefined });
  }
}
