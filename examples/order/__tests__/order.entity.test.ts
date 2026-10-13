import { describe, expect, it } from "bun:test";
import { assertFail, assertOk } from "core-kernel/testing";
import { Email, Money } from "core-kernel/vo";
import { Order } from "../domain/order.entity.js";
import { OrderLine } from "../domain/order-line.vo.js";

const now = new Date("2026-10-13T12:00:00Z");
const email = Email.create("ana@example.com").unwrap();
const line = (sku: string, quantity: number, cents: number, currency = "BRL") =>
  OrderLine.create({
    sku,
    quantity,
    unitPrice: Money.create({ amount: cents, currency }).unwrap(),
  }).unwrap();

describe("Order.place", () => {
  it("calcula o total, começa pendente e emite order.placed", () => {
    const result = Order.place({
      customerEmail: email,
      lines: [line("a", 2, 1000), line("b", 1, 550)],
      now,
    });

    assertOk(result);
    expect(result.value.total.amount).toBe(2550);
    expect(result.value.status).toBe("pending");
    expect(result.value.domainEvents.map((e) => e.name)).toEqual(["order.placed"]);
  });

  it("exige ao menos uma linha", () => {
    assertFail(Order.place({ customerEmail: email, lines: [], now }), "EMPTY");
  });

  it("não aceita linhas em moedas diferentes", () => {
    assertFail(
      Order.place({
        customerEmail: email,
        lines: [line("a", 1, 100), line("b", 1, 100, "USD")],
        now,
      }),
      "CURRENCY_MISMATCH",
    );
  });
});

describe("Order.confirm", () => {
  it("confirma pedidos pendentes uma única vez", () => {
    const order = Order.place({ customerEmail: email, lines: [line("a", 1, 100)], now }).unwrap();
    order.pullDomainEvents();

    assertOk(order.confirm(now));
    expect(order.domainEvents.map((e) => e.name)).toEqual(["order.confirmed"]);
    assertFail(order.confirm(now), "ORDER_NOT_PENDING");
  });
});

describe("OrderLine", () => {
  it("normaliza o SKU e calcula o subtotal", () => {
    const l = line(" ab-1 ", 3, 999);

    expect(l.sku).toBe("AB-1");
    expect(l.subtotal.amount).toBe(2997);
  });

  it("valida quantidade e preço com o field da linha", () => {
    const result = OrderLine.create(
      { sku: "", quantity: 0, unitPrice: Money.create({ amount: -1, currency: "BRL" }).unwrap() },
      "lines[2]",
    );

    assertFail(result);
    expect(result.error.issues.map((i) => i.field)).toEqual([
      "lines[2].sku",
      "lines[2].quantity",
      "lines[2].unitPrice",
    ]);
  });
});
