# Value Object: padrões

## VOs prontos

| Import | VO | Notas |
|---|---|---|
| `core-kernel/vo` | `Email` | trim + lowercase, `local`, `domain` |
| | `Text` | trim, `{ minLength (padrão 1), maxLength }` |
| | `Url` | http/https por padrão (`{ protocols }`), `hostname` |
| | `Money` | `{ amount (centavos inteiros), currency }`, `fromDecimal`, `add`, `subtract`, `multiply`, `format` |
| | `DateRange` | `[start, end)`, `overlaps`, `contains`, `durationMs` |
| | `StrongPassword` | uma issue por regra; `toString`/`toJSON` mascarados |
| `core-kernel/vo/br` | `Cpf` | só dígitos, `formatted` |
| | `Cnpj` | numérico e alfanumérico (IN RFB 2.229/2024), `formatted`, `root` |

Todos: `Xxx.create(raw, { field? }): Result<Xxx, ValidationError>`.

## Template: VO de valor primitivo

```ts
// file: sku.vo.ts
import { Guard, type Result, type ValidationError, ValueObject } from "core-kernel";

const SKU_PATTERN = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

/** Código do produto: maiúsculas, dígitos e hífens (ex.: `AB-123`). */
export class Sku extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(raw: string, { field = "sku" }: { field?: string } = {}): Result<Sku, ValidationError> {
    const value = raw.trim().toUpperCase();
    return Guard.notEmpty(value, { field })
      .flatMap(() => Guard.maxLength(value, 32, { field }))
      .flatMap(() => Guard.matches(value, SKU_PATTERN, { field, code: "INVALID_SKU", message: `${field} is invalid` }))
      .map(() => new Sku(value));
  }

  /** Prefixo antes do primeiro hífen (ex.: família do produto). */
  get prefix(): string {
    return this.value.split("-")[0] ?? this.value;
  }
}
```

## Template: VO composto (acumulando issues)

```ts
// file: address.vo.ts
import { Guard, type Result, type ValidationError, ValueObject } from "core-kernel";

export interface AddressValue {
  street: string;
  number: string;
  city: string;
  state: string;
  zipCode: string;
}

const STATES = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"] as const;

export class Address extends ValueObject<AddressValue> {
  private constructor(value: AddressValue) {
    super(value);
  }

  static create(raw: AddressValue, { field = "address" }: { field?: string } = {}): Result<Address, ValidationError> {
    const value: AddressValue = {
      street: raw.street.trim(),
      number: raw.number.trim(),
      city: raw.city.trim(),
      state: raw.state.trim().toUpperCase(),
      zipCode: raw.zipCode.replace(/\D/g, ""),
    };
    return Guard.all([
      Guard.notEmpty(value.street, { field: `${field}.street` }),
      Guard.notEmpty(value.number, { field: `${field}.number` }),
      Guard.notEmpty(value.city, { field: `${field}.city` }),
      Guard.oneOf(value.state, STATES, { field: `${field}.state` }),
      Guard.matches(value.zipCode, /^\d{8}$/, { field: `${field}.zipCode`, code: "INVALID_ZIP_CODE" }),
    ]).map(() => new Address(value));
  }

  get formattedZipCode(): string {
    return `${this.value.zipCode.slice(0, 5)}-${this.value.zipCode.slice(5)}`;
  }
}
```

## VO com operações (devolvem novos VOs)

```ts
// file: percentage.vo.ts
import { Guard, type Result, type ValidationError, ValueObject } from "core-kernel";
import type { Money } from "core-kernel/vo";

export class Percentage extends ValueObject<number> {
  private constructor(value: number) {
    super(value);
  }

  static create(raw: number, { field = "percentage" }: { field?: string } = {}): Result<Percentage, ValidationError> {
    return Guard.inRange(raw, { min: 0, max: 100 }, { field }).map(() => new Percentage(raw));
  }

  /** Aplica o desconto e devolve um novo Money (arredondado para centavos). */
  discount(price: Money): Money {
    return price.multiply(1 - this.value / 100);
  }
}
```

## Usando VOs prontos

```ts
// file: customer-input.ts
import { Result } from "core-kernel";
import { Email, Money } from "core-kernel/vo";
import { Cpf } from "core-kernel/vo/br";

export function parseCustomer(input: { email: string; cpf: string; creditLimit: number }) {
  return Result.combine([
    Email.create(input.email),
    Cpf.create(input.cpf),
    Money.fromDecimal(input.creditLimit, "BRL", { field: "creditLimit" }),
  ]).map(([email, cpf, creditLimit]) => ({ email, cpf, creditLimit }));
}
```

## Testes

```ts
// file: sku.vo.test.ts
import { describe, expect, it } from "bun:test";
import { assertFail, assertOk } from "core-kernel/testing";
import { Sku } from "./sku.vo.js";

describe("Sku", () => {
  it("normaliza para maiúsculas", () => {
    const sku = Sku.create("  ab-123 ");

    assertOk(sku);
    expect(sku.value.value).toBe("AB-123");
    expect(sku.value.prefix).toBe("AB");
  });

  it.each([[""], ["ab_123"], ["-ab"]])("rejeita %p", (raw) => {
    assertFail(Sku.create(raw));
  });

  it("aponta o código da regra violada", () => {
    assertFail(Sku.create("ab_123"), "INVALID_SKU");
  });

  it("é igual a outro Sku com o mesmo valor", () => {
    expect(Sku.create("AB-1").unwrap().equals(Sku.create("ab-1").unwrap())).toBe(true);
  });
});
```

## Checklist

- [ ] Não existe VO pronto equivalente (core-kernel/vo, core-kernel/vo/br, projeto).
- [ ] Construtor `private`; criação só via `create` devolvendo `Result`.
- [ ] Normalização antes da validação; valor guardado normalizado.
- [ ] Issues com `field` correto e `code` específico.
- [ ] Sem setters; operações devolvem novos VOs.
- [ ] Testes de normalização, de cada invariante (pelo `code`) e de igualdade.

## Armadilhas comuns

- Validar no construtor e lançar exceção (construtor não devolve `Result`).
- Esquecer a normalização ao comparar (`"ab-1"` vs `"AB-1"`).
- Criar `EmailVO`/`CpfVO` no projeto quando o core-kernel já tem.
- Guardar `Date` e devolvê-la direto num getter: devolva uma cópia (`new Date(...)`), pois
  `Date` é mutável.
- VO com identidade (id) — isso é entidade.
