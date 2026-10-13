import { ValueObject } from "../domain/value-object.js";
import type { ValidationError } from "../errors/validation-error.js";
import { Guard } from "../guard/guard.js";
import type { Result } from "../result/result.js";
import { asString, type VoOptions } from "./internal.js";

export interface PasswordPolicy extends VoOptions {
  /** Padrão: 8. */
  minLength?: number;
  /** Cada regra é exigida por padrão. */
  uppercase?: boolean;
  lowercase?: boolean;
  digit?: boolean;
  symbol?: boolean;
}

const MASK = "********";

/**
 * Senha em texto puro que cumpre a política, para ser **hasheada** logo em seguida. Devolve
 * uma issue por regra violada (útil para checklists na UI). `toString`/`toJSON` mascaram o
 * valor para não vazá-lo em logs; leia `value` só para gerar o hash.
 */
export class StrongPassword extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(
    raw: string,
    {
      field = "password",
      minLength = 8,
      uppercase = true,
      lowercase = true,
      digit = true,
      symbol = true,
    }: PasswordPolicy = {},
  ): Result<StrongPassword, ValidationError> {
    const value = asString(raw);
    const rule = (enabled: boolean, pattern: RegExp, code: string, what: string) =>
      enabled
        ? [Guard.matches(value, pattern, { field, code, message: `${field} must contain ${what}` })]
        : [];

    return Guard.all([
      Guard.minLength(value, minLength, { field }),
      ...rule(uppercase, /[A-Z]/, "MISSING_UPPERCASE", "an uppercase letter"),
      ...rule(lowercase, /[a-z]/, "MISSING_LOWERCASE", "a lowercase letter"),
      ...rule(digit, /\d/, "MISSING_DIGIT", "a digit"),
      ...rule(symbol, /[^A-Za-z0-9]/, "MISSING_SYMBOL", "a symbol"),
    ]).map(() => new StrongPassword(value));
  }

  override toString(): string {
    return MASK;
  }

  override toJSON(): string {
    return MASK;
  }
}
