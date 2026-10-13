import type { DomainEventPublisher } from "../application/ports/domain-event-publisher.js";
import type { DomainEvent } from "../domain/domain-event.js";

/** Guarda os eventos publicados para asserções. */
export class InMemoryEventPublisher implements DomainEventPublisher {
  readonly published: DomainEvent[] = [];

  async publish(events: readonly DomainEvent[]): Promise<void> {
    this.published.push(...events);
  }

  namesOf(): string[] {
    return this.published.map((event) => event.name);
  }

  clear(): void {
    this.published.length = 0;
  }
}
