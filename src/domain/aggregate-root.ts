import type { DomainEvent } from "./domain-event.js";
import { Entity } from "./entity.js";
import type { UniqueId } from "./unique-id.js";

/**
 * Entidade raiz de um agregado: a fronteira de consistência e a única porta de entrada para
 * alterá-lo. Acumula os eventos de domínio emitidos pelos seus métodos; quem persiste o
 * agregado (use case / repositório) chama `pullDomainEvents()` e os publica.
 *
 * `E` é a união dos eventos que o agregado pode emitir.
 */
export abstract class AggregateRoot<
  P extends object,
  Id extends UniqueId = UniqueId,
  E extends DomainEvent = DomainEvent,
> extends Entity<P, Id> {
  #events: E[] = [];

  /** Eventos pendentes de publicação (cópia). */
  get domainEvents(): readonly E[] {
    return [...this.#events];
  }

  /** Devolve os eventos pendentes e esvazia a fila. */
  pullDomainEvents(): E[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }

  protected addDomainEvent(event: E): void {
    this.#events.push(event);
  }
}
