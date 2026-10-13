import {
  BaseUseCase,
  type PaginatedResultDTO,
  Result,
  type ValidationError,
  validatePagination,
} from "core-kernel";
import type { ListOrdersInput, OrderListItemDTO, OrderQueries } from "../ports/order.queries.js";

/** Leitura: valida a paginação e delega para a query, sem passar por entidades. */
export class ListOrdersUseCase extends BaseUseCase<
  ListOrdersInput,
  PaginatedResultDTO<OrderListItemDTO>,
  ValidationError
> {
  constructor(private readonly queries: OrderQueries) {
    super();
  }

  protected async handle(
    input: ListOrdersInput,
  ): Promise<Result<PaginatedResultDTO<OrderListItemDTO>, ValidationError>> {
    const valid = validatePagination(input, { maxPageSize: 50 });
    if (valid.isFail()) return valid;
    return Result.ok(await this.queries.list(valid.value));
  }
}
