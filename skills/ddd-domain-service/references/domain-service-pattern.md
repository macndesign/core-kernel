# Domain Service: padrões

## Política que aprova ou reprova (com motivo)

Regra: um funcionário não pode assumir um turno que se sobrepõe a outro turno dele. Envolve
o turno alvo **e** a agenda do funcionário — não é responsabilidade de um único turno.

```ts
// file: shift-conflict.policy.ts
import { ConflictError, Result } from "core-kernel";
import type { DateRange } from "core-kernel/vo";

export interface ScheduledShift {
  id: string;
  period: DateRange;
}

/** Pura: recebe a agenda já carregada pelo use case. */
export function ensureNoShiftConflict(
  schedule: readonly ScheduledShift[],
  target: ScheduledShift,
): Result<void, ConflictError> {
  const conflict = schedule.find((shift) => shift.id !== target.id && shift.period.overlaps(target.period));
  if (!conflict) return Result.ok();
  return Result.fail(
    new ConflictError("Shift overlaps another shift", {
      code: "SHIFT_CONFLICT",
      details: { conflictingShiftId: conflict.id },
    }),
  );
}
```

## Calculadora

```ts
// file: order-pricing.service.ts
import type { Result, ValidationError } from "core-kernel";
import { Money } from "core-kernel/vo";

export interface PricedItem {
  unitPrice: Money;
  quantity: number;
}

export interface PricingRules {
  /** Desconto progressivo: a partir de `minQuantity` itens, `percent`% de desconto. */
  volumeDiscount: { minQuantity: number; percent: number };
}

export function calculateOrderTotal(
  items: readonly PricedItem[],
  rules: PricingRules,
  currency: string,
): Result<Money, ValidationError> {
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce<Result<Money, ValidationError>>(
    (sum, item) => sum.flatMap((acc) => acc.add(item.unitPrice.multiply(item.quantity))),
    Money.create({ amount: 0, currency }),
  );
  const { minQuantity, percent } = rules.volumeDiscount;
  return subtotal.map((value) => (totalQuantity >= minQuantity ? value.multiply(1 - percent / 100) : value));
}
```

## Uso no use case (o use case faz o I/O, o serviço decide)

```ts
// file: assign-shift.usecase.ts
import { BaseUseCase, type ConflictError, Result, type ValidationError } from "core-kernel";
import { DateRange } from "core-kernel/vo";
import { ensureNoShiftConflict, type ScheduledShift } from "./shift-conflict.policy.js";

export interface ScheduleQuery {
  shiftsOf(employeeId: string): Promise<ScheduledShift[]>;
}

type Input = { employeeId: string; shiftId: string; start: string; end: string };

export class AssignShiftUseCase extends BaseUseCase<Input, void, ValidationError | ConflictError> {
  constructor(private readonly schedule: ScheduleQuery) {
    super();
  }

  protected async handle(input: Input): Promise<Result<void, ValidationError | ConflictError>> {
    const period = DateRange.create(input);
    if (period.isFail()) return period;

    const shifts = await this.schedule.shiftsOf(input.employeeId);
    const allowed = ensureNoShiftConflict(shifts, { id: input.shiftId, period: period.value });
    if (allowed.isFail()) return allowed;

    // ... atribuir e persistir
    return Result.ok();
  }
}
```

## Testes (sem dublês: entrada → saída)

```ts
// file: domain-services.test.ts
import { describe, expect, it } from "bun:test";
import { assertFail, assertOk } from "core-kernel/testing";
import { DateRange, Money } from "core-kernel/vo";
import { calculateOrderTotal } from "./order-pricing.service.js";
import { ensureNoShiftConflict } from "./shift-conflict.policy.js";

const shift = (id: string, start: string, end: string) => ({
  id,
  period: DateRange.create({ start: `2026-01-01T${start}:00Z`, end: `2026-01-01T${end}:00Z` }).unwrap(),
});

describe("ensureNoShiftConflict", () => {
  const schedule = [shift("a", "08:00", "12:00")];

  it("permite turnos que só se tocam", () => {
    assertOk(ensureNoShiftConflict(schedule, shift("b", "12:00", "16:00")));
  });

  it("reprova sobreposição com o id do conflito", () => {
    const result = ensureNoShiftConflict(schedule, shift("b", "11:00", "13:00"));

    assertFail(result, "SHIFT_CONFLICT");
    expect(result.error.details).toEqual({ conflictingShiftId: "a" });
  });

  it("ignora o próprio turno (reagendamento)", () => {
    assertOk(ensureNoShiftConflict(schedule, shift("a", "09:00", "13:00")));
  });
});

describe("calculateOrderTotal", () => {
  const brl = (amount: number) => Money.create({ amount, currency: "BRL" }).unwrap();
  const rules = { volumeDiscount: { minQuantity: 10, percent: 10 } };

  it("aplica desconto por volume a partir do mínimo", () => {
    expect(calculateOrderTotal([{ unitPrice: brl(1000), quantity: 9 }], rules, "BRL").unwrap().amount).toBe(9000);
    expect(calculateOrderTotal([{ unitPrice: brl(1000), quantity: 10 }], rules, "BRL").unwrap().amount).toBe(9000);
  });

  it("lista vazia dá zero", () => {
    expect(calculateOrderTotal([], rules, "BRL").unwrap().isZero()).toBe(true);
  });
});
```

## Checklist

- [ ] A regra não cabe numa única entidade/VO.
- [ ] Nome da regra de negócio (`*Policy`, `*Calculator`, verbo `ensure*`/`calculate*`).
- [ ] Nenhuma dependência de I/O (repositório, client, Clock, env).
- [ ] Entradas/saídas com objetos do domínio; `Result` quando reprova com motivo.
- [ ] Testes diretos, sem mocks, cobrindo limites e vazio.

## Armadilhas comuns

- Serviço de domínio que recebe repositório (vira use case disfarçado).
- "Service" anêmico que só faz getter/setter de uma entidade — a regra devia estar nela.
- Ler `new Date()` dentro do serviço em vez de receber `now`.
- Duplicar uma regra que já existe num VO (`DateRange.overlaps`, `Money.add`).
