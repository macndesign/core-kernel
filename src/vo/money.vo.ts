import { ValueObject } from "../domain/value-object.js";
import { ValidationError } from "../errors/validation-error.js";
import { Guard } from "../guard/guard.js";
import { Result } from "../result/result.js";
import type { VoOptions } from "./internal.js";

export interface MoneyValue {
  /** Valor em unidades mínimas da moeda (ex.: centavos). Sempre inteiro. */
  amount: number;
  /** Código ISO 4217 (ex.: `BRL`). */
  currency: string;
}

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

/** Casas decimais da moeda segundo o Intl (BRL → 2, JPY → 0). */
const fractionDigits = (currency: string): number =>
  new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
    .maximumFractionDigits ?? 2;

/**
 * Dinheiro em unidades mínimas inteiras (sem erros de ponto flutuante nas somas).
 * Pode ser negativo (estornos, saldos); regras como "preço ≥ 0" são da entidade.
 */
export class Money extends ValueObject<MoneyValue> {
  private constructor(value: MoneyValue) {
    super(value);
  }

  /** `field` prefixa as issues (ex.: `price` → `price.amount`). */
  static create(
    { amount, currency }: MoneyValue,
    { field }: VoOptions = {},
  ): Result<Money, ValidationError> {
    const name = (part: string) => (field ? `${field}.${part}` : part);
    const code = String(currency ?? "").toUpperCase();
    return Guard.all([
      Guard.integer(amount, { field: name("amount") }),
      Guard.matches(code, CURRENCY_PATTERN, {
        field: name("currency"),
        code: "INVALID_CURRENCY",
        message: `${name("currency")} must be an ISO 4217 code`,
      }),
    ]).map(() => new Money({ amount, currency: code }));
  }

  /** Converte um valor decimal (ex.: `10.5` BRL) para unidades mínimas, arredondando. */
  static fromDecimal(
    decimal: number,
    currency: string,
    options?: VoOptions,
  ): Result<Money, ValidationError> {
    const code = String(currency ?? "").toUpperCase();
    if (!CURRENCY_PATTERN.test(code)) return Money.create({ amount: 0, currency: code }, options);
    const amount = Math.round(decimal * 10 ** fractionDigits(code));
    return Money.create({ amount, currency: code }, options);
  }

  get amount(): number {
    return this.value.amount;
  }

  get currency(): string {
    return this.value.currency;
  }

  add(other: Money): Result<Money, ValidationError> {
    return this.sameCurrency(other).map(
      () => new Money({ amount: this.amount + other.amount, currency: this.currency }),
    );
  }

  subtract(other: Money): Result<Money, ValidationError> {
    return this.sameCurrency(other).map(
      () => new Money({ amount: this.amount - other.amount, currency: this.currency }),
    );
  }

  /** Multiplica e arredonda para a unidade mínima. Lança para fator não finito (uso indevido). */
  multiply(factor: number): Money {
    if (!Number.isFinite(factor)) throw new TypeError("Money.multiply requires a finite factor");
    return new Money({ amount: Math.round(this.amount * factor), currency: this.currency });
  }

  isZero(): boolean {
    return this.amount === 0;
  }

  isPositive(): boolean {
    return this.amount > 0;
  }

  isNegative(): boolean {
    return this.amount < 0;
  }

  toDecimal(): number {
    return this.amount / 10 ** fractionDigits(this.currency);
  }

  format(locale = "pt-BR"): string {
    return new Intl.NumberFormat(locale, { style: "currency", currency: this.currency }).format(
      this.toDecimal(),
    );
  }

  private sameCurrency(other: Money): Result<void, ValidationError> {
    if (other.currency === this.currency) return Result.ok();
    return Result.fail(
      new ValidationError({
        field: "currency",
        code: "CURRENCY_MISMATCH",
        message: `cannot combine ${this.currency} with ${other.currency}`,
      }),
    );
  }
}
