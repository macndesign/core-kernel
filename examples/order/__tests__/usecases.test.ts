import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  assertFail,
  assertOk,
  FixedClock,
  InMemoryEventPublisher,
  SequentialIdGenerator,
} from "core-kernel/testing";
import { ConfirmOrderUseCase } from "../application/usecases/confirm-order.usecase.js";
import { ListOrdersUseCase } from "../application/usecases/list-orders.usecase.js";
import {
  type PlaceOrderInput,
  PlaceOrderUseCase,
} from "../application/usecases/place-order.usecase.js";
import { InMemoryOrderStore } from "./fakes/in-memory-order.store.js";

const validInput: PlaceOrderInput = {
  customerEmail: " Ana@Example.com ",
  currency: "BRL",
  lines: [
    { sku: "abc-1", quantity: 2, unitPrice: 10.5 },
    { sku: "xyz-9", quantity: 1, unitPrice: 4 },
  ],
};

/** Monta os use cases com dublês do core-kernel/testing (como o criarSut do shift-swap). */
const createSut = () => {
  const store = new InMemoryOrderStore();
  const events = new InMemoryEventPublisher();
  const clock = new FixedClock("2026-10-13T12:00:00Z");
  return {
    store,
    events,
    clock,
    placeOrder: new PlaceOrderUseCase(store, events, clock),
    confirmOrder: new ConfirmOrderUseCase(store, events, clock),
    listOrders: new ListOrdersUseCase(store),
  };
};

let restoreIds: () => void;
beforeEach(() => {
  restoreIds = new SequentialIdGenerator("order").install();
});
afterEach(() => restoreIds());

describe("PlaceOrderUseCase", () => {
  it("cria o pedido, persiste e publica order.placed", async () => {
    const { placeOrder, store, events } = createSut();

    const result = await placeOrder.execute(validInput);

    assertOk(result);
    expect(result.value.orderId).toBe("order-1");
    expect(store.items[0]?.total.amount).toBe(2500);
    expect(store.items[0]?.customerEmail.value).toBe("ana@example.com");
    expect(events.namesOf()).toEqual(["order.placed"]);
  });

  it("acumula as issues de todos os campos inválidos", async () => {
    const { placeOrder, store } = createSut();

    const result = await placeOrder.execute({
      customerEmail: "invalid",
      currency: "BRL",
      lines: [{ sku: "", quantity: 0, unitPrice: 1 }],
    });

    assertFail(result, "VALIDATION_FAILED");
    expect(result.error.kind === "validation" && result.error.issues.map((i) => i.field)).toEqual([
      "customerEmail",
      "lines[0].sku",
      "lines[0].quantity",
    ]);
    expect(store.size).toBe(0);
  });

  it("converte falha do banco em UnexpectedError", async () => {
    const { placeOrder, store, events } = createSut();
    store.failNext(new Error("connection refused"));

    assertFail(await placeOrder.execute(validInput), "UNEXPECTED");
    expect(events.published).toEqual([]);
  });
});

describe("ConfirmOrderUseCase", () => {
  it("confirma e publica order.confirmed com a hora do Clock", async () => {
    const { placeOrder, confirmOrder, store, events, clock } = createSut();
    const { orderId } = (await placeOrder.execute(validInput)).unwrap();
    clock.advance(60_000);

    assertOk(await confirmOrder.execute({ orderId }));
    expect(store.items[0]?.status).toBe("confirmed");
    expect(events.published.at(-1)?.payload).toEqual({
      confirmedAt: "2026-10-13T12:01:00.000Z",
    });
  });

  it.each([
    ["", "INVALID_ID"],
    ["order-404", "ORDER_NOT_FOUND"],
  ])("orderId %p → %p", async (orderId, code) => {
    const { confirmOrder } = createSut();

    assertFail(await confirmOrder.execute({ orderId }), code);
  });

  it("não confirma duas vezes", async () => {
    const { placeOrder, confirmOrder } = createSut();
    const { orderId } = (await placeOrder.execute(validInput)).unwrap();
    await confirmOrder.execute({ orderId });

    assertFail(await confirmOrder.execute({ orderId }), "ORDER_NOT_PENDING");
  });
});

describe("ListOrdersUseCase", () => {
  it("devolve DTOs paginados e filtrados", async () => {
    const { placeOrder, confirmOrder, listOrders } = createSut();
    const place = async () => (await placeOrder.execute(validInput)).unwrap().orderId;
    const first = await place();
    const second = await place();
    const third = await place();
    assertOk(await confirmOrder.execute({ orderId: second }));

    const result = await listOrders.execute({ page: 1, pageSize: 10, status: "pending" });

    assertOk(result);
    expect(result.value.data.map((o) => o.id)).toEqual([first, third]);
    expect(result.value.meta).toEqual({ page: 1, pageSize: 10, total: 2, totalPages: 1 });
  });

  it("rejeita pageSize acima do limite do caso de uso", async () => {
    const { listOrders } = createSut();

    assertFail(await listOrders.execute({ page: 1, pageSize: 51 }), "TOO_LARGE");
  });
});
