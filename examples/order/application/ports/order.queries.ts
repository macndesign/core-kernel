import type { PaginatedInputDTO, PaginatedResultDTO } from "core-kernel";
import type { OrderStatus } from "../../domain/order.entity.js";

/** DTO de leitura: dados prontos para a tela, sem entidades nem VOs. */
export interface OrderListItemDTO {
  id: string;
  customerEmail: string;
  status: OrderStatus;
  total: string;
}

export interface ListOrdersInput extends PaginatedInputDTO {
  status?: OrderStatus;
}

/** Port de leitura (CQRS): consultas devolvem DTOs, separadas do repositório. */
export interface OrderQueries {
  list(input: ListOrdersInput): Promise<PaginatedResultDTO<OrderListItemDTO>>;
}
