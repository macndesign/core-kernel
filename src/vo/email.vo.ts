import { ValueObject } from "../domain/value-object.js";
import type { ValidationError } from "../errors/validation-error.js";
import { Guard } from "../guard/guard.js";
import type { Result } from "../result/result.js";
import { asString, type VoOptions } from "./internal.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LENGTH = 254; // RFC 5321

/** E-mail normalizado (trim + lowercase). */
export class Email extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(raw: string, { field = "email" }: VoOptions = {}): Result<Email, ValidationError> {
    const value = asString(raw).trim().toLowerCase();
    return Guard.maxLength(value, MAX_LENGTH, { field })
      .flatMap(() =>
        Guard.matches(value, EMAIL_PATTERN, {
          field,
          code: "INVALID_EMAIL",
          message: `${field} is invalid`,
        }),
      )
      .map(() => new Email(value));
  }

  get local(): string {
    return this.value.slice(0, this.value.lastIndexOf("@"));
  }

  get domain(): string {
    return this.value.slice(this.value.lastIndexOf("@") + 1);
  }
}
