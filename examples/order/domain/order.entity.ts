import {
  AggregateRoot,
  type Auditable,
  ConflictError,
  createDomainEvent,
  Result,
  ValidationError,
} from "core-kernel";
import type { Email, Money } from "core-kernel/vo";
import type { OrderEvent } from "./order.events.js";
import { OrderId } from "./order-id.js";
import type { OrderLine } from "./order-line.vo.js";

export type OrderStatus = "pending" | "confirmed";

export interface OrderProps extends Auditable {
  customerEmail: Email;
  lines: OrderLine[];
  total: Money;
  status: OrderStatus;
}

export interface PlaceOrderProps {
  customerEmail: Email;
  lines: OrderLine[];
  /** Vem do `Clock` injetado no use case — o domínio não chama `new Date()`. */
  now: Date;
}

/**
 * Agregado raiz. Invariantes: ao menos uma linha, todas na mesma moeda, e só pedidos
 * pendentes podem ser confirmados.
 */
export class Order extends AggregateRoot<OrderProps, OrderId, OrderEvent> {
  private constructor(props: OrderProps, id: OrderId) {
    super(props, id);
  }

  /** Cria um pedido novo: valida, gera o id e emite `order.placed`. */
  static place({ customerEmail, lines, now }: PlaceOrderProps): Result<Order, ValidationError> {
    const [first, ...rest] = lines;
    if (!first) {
      return Result.fail(
        new ValidationError({
          field: "lines",
          code: "EMPTY",
          message: "order needs at least one line",
        }),
      );
    }

    // Money.add falha com CURRENCY_MISMATCH se as linhas misturarem moedas.
    const total = rest.reduce<Result<Money, ValidationError>>(
      (sum, line) => sum.flatMap((acc) => acc.add(line.subtotal)),
      Result.ok(first.subtotal),
    );

    return total.map((amount) => {
      const order = new Order(
        { customerEmail, lines, total: amount, status: "pending", createdAt: now, updatedAt: now },
        OrderId.generate(),
      );
      order.addDomainEvent(
        createDomainEvent({
          name: "order.placed",
          aggregateId: order.id.value,
          occurredAt: now,
          payload: {
            customerEmail: customerEmail.value,
            total: amount.amount,
            currency: amount.currency,
          },
        }),
      );
      return order;
    });
  }

  /** Reidrata do banco (usado pelo mapper): sem validação e sem eventos. */
  static restore(props: OrderProps, id: OrderId): Order {
    return new Order(props, id);
  }

  get customerEmail(): Email {
    return this.props.customerEmail;
  }

  get lines(): readonly OrderLine[] {
    return [...this.props.lines];
  }

  get total(): Money {
    return this.props.total;
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Transição de estado: devolve `Result`, nunca lança e nunca expõe setter. */
  confirm(now: Date): Result<void, ConflictError> {
    if (this.props.status !== "pending") {
      return Result.fail(
        new ConflictError(`Order is ${this.props.status}`, { code: "ORDER_NOT_PENDING" }),
      );
    }
    this.props.status = "confirmed";
    this.props.updatedAt = now;
    this.addDomainEvent(
      createDomainEvent({
        name: "order.confirmed",
        aggregateId: this.id.value,
        occurredAt: now,
        payload: { confirmedAt: now.toISOString() },
      }),
    );
    return Result.ok();
  }
}
