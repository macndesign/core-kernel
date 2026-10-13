import { UniqueId } from "core-kernel";

/** Id tipado: o compilador não deixa passar um `CustomerId` onde se espera um `OrderId`. */
export class OrderId extends UniqueId {
  declare private readonly __brand: "OrderId";
}
