import { ValueObject } from "../domain/value-object.js";
import type { ValidationError } from "../errors/validation-error.js";
import { Guard } from "../guard/guard.js";
import { Result } from "../result/result.js";
import { asString, type VoOptions, withOverrides } from "./internal.js";

/** Códigos que `Text.create` pode gerar (chaves de `errors`). */
export type TextErrorCode = "EMPTY" | "TOO_SHORT" | "TOO_LONG";

export interface TextOptions extends VoOptions<TextErrorCode> {
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
    { field = "text", minLength = 1, maxLength, errors }: TextOptions = {},
  ): Result<Text, ValidationError> {
    const value = asString(raw).trim();
    const min: Result<void, ValidationError> =
      minLength > 0
        ? Guard.notEmpty(value, { field }).flatMap(() =>
            Guard.minLength(value, minLength, { field }),
          )
        : Result.ok();
    const result = min
      .flatMap(() =>
        maxLength === undefined ? Result.ok() : Guard.maxLength(value, maxLength, { field }),
      )
      .map(() => new Text(value));
    return withOverrides(result, errors);
  }
}
