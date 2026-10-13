import { ValueObject } from "../domain/value-object.js";
import type { ValidationError } from "../errors/validation-error.js";
import { Guard } from "../guard/guard.js";
import { Result } from "../result/result.js";
import { asString, type VoOptions } from "./internal.js";

export interface TextOptions extends VoOptions {
  /** Padrão: 1 (texto obrigatório). Use 0 para aceitar vazio. */
  minLength?: number;
  maxLength?: number;
}

/** Texto livre com trim e limites de tamanho. Base para nomes, descrições, títulos. */
export class Text extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(
    raw: string,
    { field = "text", minLength = 1, maxLength }: TextOptions = {},
  ): Result<Text, ValidationError> {
    const value = asString(raw).trim();
    const min: Result<void, ValidationError> =
      minLength > 0
        ? Guard.notEmpty(value, { field }).flatMap(() =>
            Guard.minLength(value, minLength, { field }),
          )
        : Result.ok();
    return min
      .flatMap(() =>
        maxLength === undefined ? Result.ok() : Guard.maxLength(value, maxLength, { field }),
      )
      .map(() => new Text(value));
  }
}
