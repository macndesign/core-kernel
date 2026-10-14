import { ValueObject } from "../../domain/value-object.js";
import type { ValidationError } from "../../errors/validation-error.js";
import { Result } from "../../result/result.js";
import { asString, invalid, type VoOptions, withOverrides } from "../internal.js";

/** Códigos que `Cnpj.create` pode gerar (chaves de `errors`). */
export type CnpjErrorCode = "INVALID_CNPJ";

// Formato válido para CNPJs numéricos e alfanuméricos (IN RFB nº 2.229/2024, emitidos a
// partir de julho/2026): 12 caracteres A–Z/0–9 + 2 dígitos verificadores numéricos.
const CNPJ_PATTERN = /^[A-Z0-9]{12}\d{2}$/;
const FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_WEIGHTS = [6, ...FIRST_WEIGHTS];

/**
 * Módulo 11 da Receita. Cada caractere vale seu código ASCII − 48: dígitos mantêm o próprio
 * valor e letras viram 17 (A) a 42 (Z) — o mesmo cálculo serve para os dois formatos.
 */
const checkDigit = (base: string, weights: readonly number[]): number => {
  const sum = [...base].reduce(
    (acc, char, i) => acc + (char.charCodeAt(0) - 48) * (weights[i] ?? 0),
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
};

const isValid = (value: string): boolean => {
  if (!CNPJ_PATTERN.test(value) || /^(.)\1{13}$/.test(value)) return false;
  const first = checkDigit(value.slice(0, 12), FIRST_WEIGHTS);
  const second = checkDigit(`${value.slice(0, 12)}${first}`, SECOND_WEIGHTS);
  return value.endsWith(`${first}${second}`);
};

/**
 * CNPJ numérico ou alfanumérico com dígitos verificadores válidos, guardado sem pontuação e
 * em maiúsculas.
 */
export class Cnpj extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(
    raw: string,
    { field = "cnpj", errors }: VoOptions<CnpjErrorCode> = {},
  ): Result<Cnpj, ValidationError> {
    const value = asString(raw)
      .toUpperCase()
      .replace(/[.\-/\s]/g, "");
    return isValid(value)
      ? Result.ok(new Cnpj(value))
      : withOverrides(invalid(field, "INVALID_CNPJ"), errors);
  }

  /** `00.000.000/0000-00` (ou `12.ABC.345/01DE-35`). */
  get formatted(): string {
    const v = this.value;
    return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
  }

  /** Raiz (8 primeiros caracteres): identifica a empresa; matriz e filiais compartilham. */
  get root(): string {
    return this.value.slice(0, 8);
  }
}
