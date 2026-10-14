import { ValueObject } from "../../domain/value-object.js";
import type { ValidationError } from "../../errors/validation-error.js";
import { Result } from "../../result/result.js";
import { asString, invalid, type VoOptions, withOverrides } from "../internal.js";

/** Códigos que `Cpf.create` pode gerar (chaves de `errors`). */
export type CpfErrorCode = "INVALID_CPF";

/** Dígito verificador do módulo 11 usado pela Receita Federal. */
const checkDigit = (base: string, firstWeight: number): number => {
  const sum = [...base].reduce((acc, digit, i) => acc + Number(digit) * (firstWeight - i), 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
};

const isValid = (digits: string): boolean => {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const first = checkDigit(digits.slice(0, 9), 10);
  const second = checkDigit(`${digits.slice(0, 9)}${first}`, 11);
  return digits.endsWith(`${first}${second}`);
};

/** CPF com dígitos verificadores válidos, guardado só com os 11 dígitos. */
export class Cpf extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(
    raw: string,
    { field = "cpf", errors }: VoOptions<CpfErrorCode> = {},
  ): Result<Cpf, ValidationError> {
    const digits = asString(raw).replace(/\D/g, "");
    return isValid(digits)
      ? Result.ok(new Cpf(digits))
      : withOverrides(invalid(field, "INVALID_CPF"), errors);
  }

  /** `000.000.000-00` */
  get formatted(): string {
    const v = this.value;
    return `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
  }

  get baseDigits(): string {
    return this.value.slice(0, 9);
  }

  get checkDigits(): string {
    return this.value.slice(9);
  }
}
