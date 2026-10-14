import { ValueObject } from "../domain/value-object.js";
import type { ValidationError } from "../errors/validation-error.js";
import { Result } from "../result/result.js";
import { asString, invalid, type VoOptions, withOverrides } from "./internal.js";

/** Códigos que `Url.create` pode gerar (chaves de `errors`). */
export type UrlErrorCode = "INVALID_URL";

// WHATWG URL: global no Node, Bun, Deno e navegadores. Declarado aqui porque o build usa só
// `lib: ES2022`, para manter a lib agnóstica de runtime.
declare const URL: new (input: string) => { readonly protocol: string; readonly hostname: string };

export interface UrlOptions extends VoOptions<UrlErrorCode> {
  /** Protocolos aceitos. Padrão: `["http:", "https:"]` (bloqueia `javascript:`, `data:`...). */
  protocols?: readonly string[];
}

const parse = (value: string) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

/** URL absoluta. O valor é o texto recebido (com trim), sem reescrita. */
export class Url extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(
    raw: string,
    { field = "url", protocols = ["http:", "https:"], errors }: UrlOptions = {},
  ): Result<Url, ValidationError> {
    const value = asString(raw).trim();
    const parsed = parse(value);
    if (!parsed || !protocols.includes(parsed.protocol)) {
      return withOverrides(invalid(field, "INVALID_URL"), errors);
    }
    return Result.ok(new Url(value));
  }

  get hostname(): string {
    return new URL(this.value).hostname;
  }
}
