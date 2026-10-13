import type { DomainEvent } from "../../domain/domain-event.js";

/** Publica eventos de domínio (barramento em memória, fila, outbox...). */
export interface DomainEventPublisher {
  publish(events: readonly DomainEvent[]): Promise<void>;
}
