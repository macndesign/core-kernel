import type { Mapper } from "core-kernel";
import { Email, Money } from "core-kernel/vo";
import { Order, type OrderStatus } from "../domain/order.entity.js";
import { OrderId } from "../domain/order-id.js";
import { OrderLine } from "../domain/order-line.vo.js";

/** Formato da linha no banco (snake_case, primitivos). */
export interface OrderRow {
  id: string;
  customer_email: string;
  status: OrderStatus;
  currency: string;
  total_cents: number;
  lines: { sku: string; quantity: number; unit_price_cents: number }[];
  created_at: Date;
  updated_at: Date;
}

/**
 * Domínio ↔ persistência. Dados do banco são confiáveis: `unwrap()` só lança se houver
 * corrupção, e o `BaseUseCase` converte essa exceção em `UnexpectedError`.
 */
export const orderMapper: Mapper<Order, OrderRow> = {
  toDomain(row) {
    const money = (amount: number) => Money.create({ amount, currency: row.currency }).unwrap();
    return Order.restore(
      {
        customerEmail: Email.create(row.customer_email).unwrap(),
        lines: row.lines.map((line) =>
          OrderLine.create({
            sku: line.sku,
            quantity: line.quantity,
            unitPrice: money(line.unit_price_cents),
          }).unwrap(),
        ),
        total: money(row.total_cents),
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      OrderId.from(row.id).unwrap(),
    );
  },

  fromDomain(order) {
    return {
      id: order.id.value,
      customer_email: order.customerEmail.value,
      status: order.status,
      currency: order.total.currency,
      total_cents: order.total.amount,
      lines: order.lines.map((line) => ({
        sku: line.sku,
        quantity: line.quantity,
        unit_price_cents: line.unitPrice.amount,
      })),
      created_at: order.createdAt,
      updated_at: order.updatedAt,
    };
  },
};
