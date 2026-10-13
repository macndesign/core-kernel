import { Guard, type Result, type ValidationError, ValueObject } from "core-kernel";
import type { Money } from "core-kernel/vo";

export interface OrderLineValue {
  sku: string;
  quantity: number;
  unitPrice: Money;
}

/** VO composto: um item do pedido. Aninha outro VO (`Money`). */
export class OrderLine extends ValueObject<OrderLineValue> {
  private constructor(value: OrderLineValue) {
    super(value);
  }

  /** `field` identifica a linha nas issues (ex.: `lines[1]`). */
  static create(
    { sku, quantity, unitPrice }: OrderLineValue,
    field = "line",
  ): Result<OrderLine, ValidationError> {
    const normalizedSku = sku.trim().toUpperCase();
    return Guard.all([
      Guard.notEmpty(normalizedSku, { field: `${field}.sku` }),
      Guard.integer(quantity, { field: `${field}.quantity` }).flatMap(() =>
        Guard.inRange(quantity, { min: 1 }, { field: `${field}.quantity` }),
      ),
      Guard.inRange(unitPrice.amount, { min: 0 }, { field: `${field}.unitPrice` }),
    ]).map(() => new OrderLine({ sku: normalizedSku, quantity, unitPrice }));
  }

  get sku(): string {
    return this.value.sku;
  }

  get quantity(): number {
    return this.value.quantity;
  }

  get unitPrice(): Money {
    return this.value.unitPrice;
  }

  get subtotal(): Money {
    return this.value.unitPrice.multiply(this.value.quantity);
  }
}
