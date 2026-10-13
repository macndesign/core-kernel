import type { DomainEvent } from "core-kernel";

export type OrderPlaced = DomainEvent<
  "order.placed",
  { customerEmail: string; total: number; currency: string }
>;

export type OrderConfirmed = DomainEvent<"order.confirmed", { confirmedAt: string }>;

/** Todos os eventos que o agregado `Order` emite. */
export type OrderEvent = OrderPlaced | OrderConfirmed;
