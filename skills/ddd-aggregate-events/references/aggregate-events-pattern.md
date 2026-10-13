# Agregados e eventos: padrões

## Eventos como tipos

```ts
// file: shift.events.ts
import type { DomainEvent } from "core-kernel";

export type ShiftSwapRequested = DomainEvent<
  "shift.swap_requested",
  { fromEmployeeId: string; toEmployeeId: string }
>;
export type ShiftReassigned = DomainEvent<"shift.reassigned", { employeeId: string }>;

/** Todos os eventos do agregado Shift. */
export type ShiftEvent = ShiftSwapRequested | ShiftReassigned;
```

## Raiz do agregado

```ts
// file: shift.aggregate.ts
import {
  AggregateRoot,
  ConflictError,
  createDomainEvent,
  Result,
  UniqueId,
  type ValidationError,
} from "core-kernel";
import { DateRange } from "core-kernel/vo";
import type { ShiftEvent } from "./shift.events.js";

export class ShiftId extends UniqueId {
  declare private readonly __brand: "ShiftId";
}

export interface ShiftProps {
  /** Referência a outro agregado: só o id. */
  employeeId: string;
  period: DateRange;
  pendingSwapTo: string | null;
}

export class Shift extends AggregateRoot<ShiftProps, ShiftId, ShiftEvent> {
  private constructor(props: ShiftProps, id: ShiftId) {
    super(props, id);
  }

  static create(input: { employeeId: string; start: string; end: string }): Result<Shift, ValidationError> {
    return DateRange.create(input).map(
      (period) => new Shift({ employeeId: input.employeeId, period, pendingSwapTo: null }, ShiftId.generate()),
    );
  }

  static restore(props: ShiftProps, id: ShiftId): Shift {
    return new Shift(props, id);
  }

  get employeeId(): string {
    return this.props.employeeId;
  }

  get period(): DateRange {
    return this.props.period;
  }

  requestSwap(toEmployeeId: string, now: Date): Result<void, ConflictError> {
    if (this.props.pendingSwapTo !== null) {
      return Result.fail(new ConflictError("Swap already pending", { code: "SWAP_ALREADY_PENDING" }));
    }
    if (toEmployeeId === this.props.employeeId) {
      return Result.fail(new ConflictError("Cannot swap with yourself", { code: "SWAP_SAME_EMPLOYEE" }));
    }
    if (this.period.start <= now) {
      return Result.fail(new ConflictError("Shift already started", { code: "SHIFT_STARTED" }));
    }
    this.props.pendingSwapTo = toEmployeeId;
    // Evento só depois de todas as regras passarem.
    this.addDomainEvent(
      createDomainEvent({
        name: "shift.swap_requested",
        aggregateId: this.id.value,
        occurredAt: now,
        payload: { fromEmployeeId: this.props.employeeId, toEmployeeId },
      }),
    );
    return Result.ok();
  }

  approveSwap(now: Date): Result<void, ConflictError> {
    const to = this.props.pendingSwapTo;
    if (to === null) return Result.fail(new ConflictError("No pending swap", { code: "NO_PENDING_SWAP" }));
    this.props.employeeId = to;
    this.props.pendingSwapTo = null;
    this.addDomainEvent(
      createDomainEvent({ name: "shift.reassigned", aggregateId: this.id.value, occurredAt: now, payload: { employeeId: to } }),
    );
    return Result.ok();
  }
}
```

## Publicação no use case (depois de persistir)

```ts
// file: request-swap.usecase.ts
import {
  BaseUseCase,
  type Clock,
  type ConflictError,
  type DomainEventPublisher,
  type FindByIdRepository,
  NotFoundError,
  Result,
  type UpdateRepository,
  type ValidationError,
} from "core-kernel";
import { type Shift, ShiftId } from "./shift.aggregate.js";

type Input = { shiftId: string; toEmployeeId: string };
type RequestSwapError = ValidationError | NotFoundError | ConflictError;

export class RequestSwapUseCase extends BaseUseCase<Input, void, RequestSwapError> {
  constructor(
    private readonly shifts: FindByIdRepository<Shift> & UpdateRepository<Shift>,
    private readonly events: DomainEventPublisher,
    private readonly clock: Clock,
  ) {
    super();
  }

  protected async handle({ shiftId, toEmployeeId }: Input): Promise<Result<void, RequestSwapError>> {
    const id = ShiftId.from(shiftId);
    if (id.isFail()) return id;
    const shift = await this.shifts.findById(id.value);
    if (!shift) return Result.fail(new NotFoundError("Shift not found", { code: "SHIFT_NOT_FOUND" }));

    const requested = shift.requestSwap(toEmployeeId, this.clock.now());
    if (requested.isFail()) return requested;

    await this.shifts.update(shift); // 1º persiste
    await this.events.publish(shift.pullDomainEvents()); // 2º publica
    return Result.ok();
  }
}
```

> Se a publicação precisar ser garantida mesmo com falha entre os dois passos, o adapter de
> persistência grava os eventos numa tabela *outbox* na mesma transação e um processo separado
> os publica. O `id` de cada evento serve para deduplicar no consumidor.

## Consumidor de eventos

Handlers ficam na camada de aplicação e chamam use cases — nunca alteram outro agregado
diretamente dentro do agregado que emitiu.

```ts
// file: notify-on-swap.handler.ts
import type { DomainEvent } from "core-kernel";
import type { ShiftEvent } from "./shift.events.js";

export interface Notifier {
  notify(employeeId: string, message: string): Promise<void>;
}

export const notifyOnSwapRequested =
  (notifier: Notifier) =>
  async (event: DomainEvent): Promise<void> => {
    const shiftEvent = event as ShiftEvent;
    if (shiftEvent.name !== "shift.swap_requested") return;
    // O narrowing pelo nome tipa o payload.
    await notifier.notify(shiftEvent.payload.toEmployeeId, "Você recebeu um pedido de troca de turno");
  };
```

## Testes

```ts
// file: shift.aggregate.test.ts
import { describe, expect, it } from "bun:test";
import { assertFail, assertOk } from "core-kernel/testing";
import { Shift } from "./shift.aggregate.js";

const before = new Date("2026-01-01T00:00:00Z");
const shift = () =>
  Shift.create({ employeeId: "e-1", start: "2026-01-02T08:00:00Z", end: "2026-01-02T16:00:00Z" }).unwrap();

describe("Shift", () => {
  it("emite shift.swap_requested com payload primitivo", () => {
    const s = shift();

    assertOk(s.requestSwap("e-2", before));
    expect(s.pullDomainEvents().map((e) => [e.name, e.payload])).toEqual([
      ["shift.swap_requested", { fromEmployeeId: "e-1", toEmployeeId: "e-2" }],
    ]);
  });

  it("não emite evento quando a regra falha", () => {
    const s = shift();

    assertFail(s.requestSwap("e-1", before), "SWAP_SAME_EMPLOYEE");
    expect(s.domainEvents).toEqual([]);
  });

  it("aprovação reatribui e emite shift.reassigned", () => {
    const s = shift();
    s.requestSwap("e-2", before);
    s.pullDomainEvents();

    assertOk(s.approveSwap(before));
    expect(s.employeeId).toBe("e-2");
    expect(s.domainEvents.map((e) => e.name)).toEqual(["shift.reassigned"]);
  });
});
```

## Checklist

- [ ] Fronteira definida pela invariante que precisa de consistência imediata.
- [ ] `AggregateRoot<Props, Id, União de eventos>`.
- [ ] Eventos no passado, com namespace, payload primitivo.
- [ ] Evento emitido só após a regra passar; `restore` não emite.
- [ ] Use case: persiste e depois `publish(pullDomainEvents())`.
- [ ] Um agregado alterado por transação; outros reagem a eventos.

## Armadilhas comuns

- Publicar antes de persistir (consumidor reage a algo que não foi salvo).
- Esquecer `pullDomainEvents()` e republicar os mesmos eventos na próxima operação.
- Payload com entidades/VOs (não serializa de forma estável entre versões).
- Agregado gigante que carrega coleções inteiras só para validar algo raro.
- Alterar dois agregados no mesmo use case "porque é mais fácil".
