import {
  BaseUseCase,
  type Clock,
  type ConflictError,
  type DomainEventPublisher,
  NotFoundError,
  Result,
  type ValidationError,
} from "core-kernel";
import { OrderId } from "../../domain/order-id.js";
import type { OrderRepository } from "../ports/order.repository.js";

export interface ConfirmOrderInput {
  orderId: string;
}

type ConfirmOrderError = ValidationError | NotFoundError | ConflictError;

export class ConfirmOrderUseCase extends BaseUseCase<ConfirmOrderInput, void, ConfirmOrderError> {
  constructor(
    private readonly orders: Pick<OrderRepository, "findById" | "update">,
    private readonly events: DomainEventPublisher,
    private readonly clock: Clock,
  ) {
    super();
  }

  protected async handle({ orderId }: ConfirmOrderInput): Promise<Result<void, ConfirmOrderError>> {
    const id = OrderId.from(orderId);
    if (id.isFail()) return id;

    // Repositório devolve null; o use case decide que isso é um NotFoundError.
    const order = await this.orders.findById(id.value);
    if (!order) {
      return Result.fail(new NotFoundError("Order not found", { code: "ORDER_NOT_FOUND" }));
    }

    const confirmed = order.confirm(this.clock.now());
    if (confirmed.isFail()) return confirmed;

    await this.orders.update(order);
    await this.events.publish(order.pullDomainEvents());
    return Result.ok();
  }
}
