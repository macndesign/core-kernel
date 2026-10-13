import { describe, expect, it } from "bun:test";
import {
  AggregateRoot,
  createDomainEvent,
  type DomainEvent,
  UniqueId,
} from "../../domain/index.js";
import { type Clock, type DomainEventPublisher, type Mapper, systemClock } from "../index.js";

describe("systemClock", () => {
  it("devolve a data atual", () => {
    const before = Date.now();

    expect(systemClock.now().getTime()).toBeGreaterThanOrEqual(before);
  });

  it("um Clock fixo torna o tempo determinístico", () => {
    const fixed: Clock = { now: () => new Date("2026-01-01T00:00:00Z") };

    expect(fixed.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("DomainEventPublisher", () => {
  it("recebe os eventos puxados do agregado", async () => {
    class Counter extends AggregateRoot<{ n: number }> {
      static create() {
        return new Counter({ n: 0 }, UniqueId.generate());
      }
      increment() {
        this.props.n++;
        this.addDomainEvent(
          createDomainEvent({
            name: "counter.incremented",
            aggregateId: this.id.value,
            payload: {},
          }),
        );
      }
    }
    const published: DomainEvent[] = [];
    const publisher: DomainEventPublisher = {
      publish: async (events) => {
        published.push(...events);
      },
    };
    const counter = Counter.create();
    counter.increment();

    await publisher.publish(counter.pullDomainEvents());

    expect(published.map((event) => event.name)).toEqual(["counter.incremented"]);
  });
});

describe("Mapper", () => {
  it("converte nos dois sentidos entre domínio e formato bruto", () => {
    const mapper: Mapper<UniqueId, { id: string }> = {
      toDomain: (raw) => UniqueId.from(raw.id).unwrap(),
      fromDomain: (id) => ({ id: id.value }),
    };

    expect(mapper.fromDomain(mapper.toDomain({ id: "x" }))).toEqual({ id: "x" });
  });
});
