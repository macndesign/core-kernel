import { UniqueId } from "./unique-id.js";

/**
 * Algo relevante que aconteceu no domínio. Nome no passado e com namespace
 * (ex.: `order.confirmed`). Declare os eventos de um agregado como tipos:
 *
 * ```ts
 * type OrderConfirmed = DomainEvent<"order.confirmed", { total: number }>;
 * ```
 */
export interface DomainEvent<Name extends string = string, Payload = unknown> {
  /** Id único do evento (idempotência / outbox). */
  readonly id: string;
  readonly name: Name;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: Payload;
}

export interface CreateDomainEventInput<Name extends string, Payload> {
  name: Name;
  aggregateId: string;
  payload: Payload;
  /** Padrão: agora. Passe o valor de um `Clock` para ter datas determinísticas. */
  occurredAt?: Date;
}

/** Cria um evento imutável, gerando `id` (via gerador do `UniqueId`) e `occurredAt`. */
export function createDomainEvent<const Name extends string, Payload>(
  input: CreateDomainEventInput<Name, Payload>,
): DomainEvent<Name, Payload> {
  return Object.freeze({
    id: UniqueId.generate().value,
    name: input.name,
    aggregateId: input.aggregateId,
    occurredAt: input.occurredAt ?? new Date(),
    payload: input.payload,
  });
}
