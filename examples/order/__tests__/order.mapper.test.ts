import { describe, expect, it } from "bun:test";
import { Email, Money } from "core-kernel/vo";
import { Order } from "../domain/order.entity.js";
import { OrderLine } from "../domain/order-line.vo.js";
import { type OrderRow, orderMapper } from "../infra/order.mapper.js";

const placeOrder = () =>
  Order.place({
    customerEmail: Email.create("ana@example.com").unwrap(),
    lines: [
      OrderLine.create({
        sku: "A",
        quantity: 2,
        unitPrice: Money.create({ amount: 500, currency: "BRL" }).unwrap(),
      }).unwrap(),
    ],
    now: new Date("2026-10-13T12:00:00Z"),
  }).unwrap();

describe("orderMapper", () => {
  it("faz o caminho domínio → linha → domínio sem perder dados", () => {
    const order = placeOrder();

    const row: OrderRow = orderMapper.fromDomain(order);
    const restored = orderMapper.toDomain(row);

    expect(row).toMatchObject({
      customer_email: "ana@example.com",
      total_cents: 1000,
      currency: "BRL",
    });
    expect(restored.equals(order)).toBe(true);
    expect(restored.total.equals(order.total)).toBe(true);
    expect(restored.lines[0]?.equals(order.lines[0])).toBe(true);
    expect(restored.domainEvents).toEqual([]); // restore não emite eventos
  });

  it("lança para dados corrompidos (o BaseUseCase converte em UnexpectedError)", () => {
    const corrupted: OrderRow = { ...orderMapper.fromDomain(placeOrder()), customer_email: "x" };

    expect(() => orderMapper.toDomain(corrupted)).toThrow();
  });
});
