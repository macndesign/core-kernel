import { toPaginatedResult } from "core-kernel";
import { InMemoryRepository } from "core-kernel/testing";
import type {
  ListOrdersInput,
  OrderListItemDTO,
  OrderQueries,
} from "../../application/ports/order.queries.js";
import type { OrderRepository } from "../../application/ports/order.repository.js";
import type { Order } from "../../domain/order.entity.js";

/** Repositório + queries em memória, compartilhando os mesmos dados (como um banco faria). */
export class InMemoryOrderStore
  extends InMemoryRepository<Order>
  implements OrderRepository, OrderQueries
{
  async list({ page, pageSize, status }: ListOrdersInput) {
    const matching = this.filter((order) => status === undefined || order.status === status);
    const data: OrderListItemDTO[] = matching
      .slice((page - 1) * pageSize, page * pageSize)
      .map((order) => ({
        id: order.id.value,
        customerEmail: order.customerEmail.value,
        status: order.status,
        total: order.total.format(),
      }));
    return toPaginatedResult(data, matching.length, { page, pageSize });
  }
}
