import {
  BaseUseCase,
  type Clock,
  type DomainEventPublisher,
  Result,
  type ValidationError,
} from "core-kernel";
import { Email, Money } from "core-kernel/vo";
import { Order } from "../../domain/order.entity.js";
import { OrderLine } from "../../domain/order-line.vo.js";
import type { OrderRepository } from "../ports/order.repository.js";

export interface PlaceOrderInput {
  customerEmail: string;
  currency: string;
  lines: { sku: string; quantity: number; unitPrice: number }[];
}

export interface PlaceOrderOutput {
  orderId: string;
}

/** Converte a entrada bruta em VOs, cria o agregado, persiste e publica os eventos. */
export class PlaceOrderUseCase extends BaseUseCase<
  PlaceOrderInput,
  PlaceOrderOutput,
  ValidationError
> {
  constructor(
    private readonly orders: Pick<OrderRepository, "create">,
    private readonly events: DomainEventPublisher,
    private readonly clock: Clock,
  ) {
    super();
  }

  protected async handle(
    input: PlaceOrderInput,
  ): Promise<Result<PlaceOrderOutput, ValidationError>> {
    const lines = input.lines.map((line, i) =>
      Money.fromDecimal(line.unitPrice, input.currency, { field: `lines[${i}].unitPrice` }).flatMap(
        (unitPrice) => OrderLine.create({ ...line, unitPrice }, `lines[${i}]`),
      ),
    );

    // combine acumula as issues de todos os campos de uma vez.
    const fields = Result.combine([
      Email.create(input.customerEmail, { field: "customerEmail" }),
      ...lines,
    ]);
    if (fields.isFail()) return fields;

    const [customerEmail, ...orderLines] = fields.value;
    const placed = Order.place({ customerEmail, lines: orderLines, now: this.clock.now() });
    if (placed.isFail()) return placed;

    const order = placed.value;
    await this.orders.create(order);
    await this.events.publish(order.pullDomainEvents());
    return Result.ok({ orderId: order.id.value });
  }
}
