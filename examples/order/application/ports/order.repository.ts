import type { CreateRepository, FindByIdRepository, UpdateRepository } from "core-kernel";
import type { Order } from "../../domain/order.entity.js";

/**
 * Port de escrita: só o que os use cases usam (sem `delete`, que nenhum precisa).
 * A implementação real (Prisma, Drizzle...) fica fora do core.
 */
export interface OrderRepository
  extends CreateRepository<Order>,
    UpdateRepository<Order>,
    FindByIdRepository<Order> {}
