import { afterEach, describe, expect, it } from "bun:test";
import { ConflictError, type ValidationError } from "../../errors/index.js";
import { Guard } from "../../guard/index.js";
import { Result } from "../../result/index.js";
import {
  AggregateRoot,
  type Auditable,
  createDomainEvent,
  type DomainEvent,
  Entity,
  isEntity,
  UniqueId,
} from "../index.js";

class OrderId extends UniqueId {
  declare private readonly __brand: "OrderId";
}

type OrderStatus = "draft" | "confirmed";

interface OrderProps extends Auditable {
  customerId: string;
  total: number;
  status: OrderStatus;
}

type OrderConfirmed = DomainEvent<"order.confirmed", { total: number }>;
type OrderCreated = DomainEvent<"order.created", { customerId: string }>;

class Order extends AggregateRoot<OrderProps, OrderId, OrderCreated | OrderConfirmed> {
  private constructor(props: OrderProps, id: OrderId) {
    super(props, id);
  }

  static create(input: { customerId: string; total: number }): Result<Order, ValidationError> {
    return Guard.all([
      Guard.notEmpty(input.customerId, { field: "customerId" }),
      Guard.inRange(input.total, { min: 0 }, { field: "total" }),
    ]).map(() => {
      const now = new Date();
      const order = new Order(
        { ...input, status: "draft", createdAt: now, updatedAt: now },
        OrderId.generate(),
      );
      order.addDomainEvent(
        createDomainEvent({
          name: "order.created",
          aggregateId: order.id.value,
          payload: { customerId: input.customerId },
        }),
      );
      return order;
    });
  }

  /** Reidratação pelo repositório: não valida nem emite eventos. */
  static restore(props: OrderProps, id: OrderId): Order {
    return new Order(props, id);
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  confirm(): Result<void, ConflictError> {
    if (this.props.status !== "draft") {
      return Result.fail(new ConflictError("Order already confirmed", { code: "ORDER_NOT_DRAFT" }));
    }
    this.props.status = "confirmed";
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      createDomainEvent({
        name: "order.confirmed",
        aggregateId: this.id.value,
        payload: { total: this.props.total },
      }),
    );
    return Result.ok();
  }
}

class Customer extends Entity<{ name: string }> {
  static restore(name: string, id: UniqueId) {
    return new Customer({ name }, id);
  }
}

const props = (): OrderProps => ({
  customerId: "c-1",
  total: 10,
  status: "draft",
  createdAt: new Date(0),
  updatedAt: new Date(0),
});

describe("Entity", () => {
  it("é igual a outra entidade da mesma classe com o mesmo id", () => {
    const id = OrderId.from("o-1").unwrap();

    expect(Order.restore(props(), id).equals(Order.restore({ ...props(), total: 99 }, id))).toBe(
      true,
    );
  });

  it("não é igual com id diferente", () => {
    expect(
      Order.restore(props(), OrderId.from("o-1").unwrap()).equals(
        Order.restore(props(), OrderId.from("o-2").unwrap()),
      ),
    ).toBe(false);
  });

  it("não é igual a entidade de outra classe com o mesmo valor de id", () => {
    const order = Order.restore(props(), OrderId.from("x").unwrap());
    const customer = Customer.restore("Ana", UniqueId.from("x").unwrap());

    expect(order.equals(customer as unknown as Order)).toBe(false);
  });

  it("é falso para null e undefined", () => {
    const order = Order.restore(props(), OrderId.generate());

    expect(order.equals(null)).toBe(false);
    expect(order.equals(undefined)).toBe(false);
  });

  it("copia as props recebidas (alterar o objeto original não afeta a entidade)", () => {
    const input = props();
    const order = Order.restore(input, OrderId.generate());
    input.status = "confirmed";

    expect(order.status).toBe("draft");
  });

  it("props não são acessíveis de fora", () => {
    const order = Order.restore(props(), OrderId.generate());

    // @ts-expect-error props é protected
    order.props;
    expect(order.status).toBe("draft");
  });

  it("toString mostra classe e id", () => {
    expect(Order.restore(props(), OrderId.from("o-1").unwrap()).toString()).toBe("Order(o-1)");
  });

  it("isEntity reconhece entidades pelo brand", () => {
    expect(isEntity(Customer.restore("Ana", UniqueId.generate()))).toBe(true);
    expect(isEntity({ id: "x" })).toBe(false);
    expect(isEntity(null)).toBe(false);
  });
});

describe("convenção create / restore", () => {
  it("create valida e acumula as issues", () => {
    const result = Order.create({ customerId: "", total: -1 });

    expect(result.isFail() && result.error.issues.map((issue) => issue.field)).toEqual([
      "customerId",
      "total",
    ]);
  });

  it("create gera o id tipado e o estado inicial", () => {
    const order = Order.create({ customerId: "c-1", total: 10 }).unwrap();

    expect(order.id).toBeInstanceOf(OrderId);
    expect(order.status).toBe("draft");
  });

  it("restore não emite eventos", () => {
    expect(Order.restore(props(), OrderId.generate()).domainEvents).toEqual([]);
  });
});

describe("AggregateRoot — eventos de domínio", () => {
  it("registra os eventos emitidos pelos métodos de domínio, em ordem", () => {
    const order = Order.create({ customerId: "c-1", total: 10 }).unwrap();
    order.confirm();

    expect(order.domainEvents.map((event) => event.name)).toEqual([
      "order.created",
      "order.confirmed",
    ]);
  });

  it("não emite evento quando a regra falha", () => {
    const order = Order.restore({ ...props(), status: "confirmed" }, OrderId.generate());
    const result = order.confirm();

    expect(result.isFail() && result.error.code).toBe("ORDER_NOT_DRAFT");
    expect(order.domainEvents).toEqual([]);
  });

  it("pullDomainEvents devolve os eventos e esvazia a fila", () => {
    const order = Order.create({ customerId: "c-1", total: 10 }).unwrap();

    expect(order.pullDomainEvents()).toHaveLength(1);
    expect(order.pullDomainEvents()).toEqual([]);
    expect(order.domainEvents).toEqual([]);
  });

  it("domainEvents é uma cópia somente leitura", () => {
    const order = Order.create({ customerId: "c-1", total: 10 }).unwrap();
    const events = order.domainEvents;

    // @ts-expect-error readonly array
    events.push(events[0]);
    expect(order.domainEvents).toHaveLength(1);
  });

  it("os eventos são tipados pela união declarada no agregado", () => {
    const order = Order.create({ customerId: "c-1", total: 10 }).unwrap();
    order.confirm();
    const totals = order
      .pullDomainEvents()
      .flatMap((event) => (event.name === "order.confirmed" ? [event.payload.total] : []));

    expect(totals).toEqual([10]);
  });
});

describe("createDomainEvent", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("preenche id e occurredAt e congela o evento", () => {
    restore = UniqueId.useGenerator({ generate: () => "evt-1" });
    const before = Date.now();
    const event = createDomainEvent({ name: "x", aggregateId: "a-1", payload: { n: 1 } });

    expect(event.id).toBe("evt-1");
    expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(Object.isFrozen(event)).toBe(true);
  });

  it("aceita occurredAt explícito (ex.: vindo de um Clock)", () => {
    const occurredAt = new Date("2026-01-01T00:00:00Z");

    expect(
      createDomainEvent({ name: "x", aggregateId: "a", payload: null, occurredAt }).occurredAt,
    ).toBe(occurredAt);
  });
});
