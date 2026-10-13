import { ValidationError } from "../errors/validation-error.js";
import { Result } from "../result/result.js";

/** Personaliza a issue gerada quando a verificação falha. */
export interface GuardOptions {
  /** Campo validado; entra na issue e na mensagem padrão. */
  field?: string;
  /** Substitui o código padrão (ex.: `INVALID_EMAIL` em vez de `INVALID_FORMAT`). */
  code?: string;
  /** Substitui a mensagem padrão (ex.: texto traduzido para a UI). */
  message?: string;
}

export interface Range {
  min?: number;
  max?: number;
}

export type GuardResult = Result<void, ValidationError>;

const PASS: GuardResult = Result.ok();

function check(
  passed: boolean,
  defaultCode: string,
  defaultMessage: (subject: string) => string,
  options: GuardOptions = {},
): GuardResult {
  if (passed) return PASS;
  const { field, code = defaultCode, message = defaultMessage(field ?? "value") } = options;
  return Result.fail(
    new ValidationError(field === undefined ? { code, message } : { field, code, message }),
  );
}

const unit = (value: string | readonly unknown[]) =>
  typeof value === "string" ? "characters" : "items";

/**
 * Verificações reutilizáveis para invariantes de VOs e entidades. Cada uma devolve
 * `Result<void, ValidationError>`: junte várias com `Guard.all` (acumula as issues) ou
 * encadeie com `flatMap` (para na primeira falha).
 *
 * Guards só verificam; normalização (trim, lowercase...) é responsabilidade do VO.
 */
export const Guard = {
  /** Falha apenas para `null`/`undefined`. */
  required(value: unknown, options?: GuardOptions): GuardResult {
    return check(value != null, "REQUIRED", (s) => `${s} is required`, options);
  },

  /** Falha para `null`/`undefined`, string vazia ou só com espaços e array vazio. */
  notEmpty(value: string | readonly unknown[] | null | undefined, options?: GuardOptions) {
    const empty =
      value == null || (typeof value === "string" ? value.trim() === "" : value.length === 0);
    return check(!empty, "EMPTY", (s) => `${s} must not be empty`, options);
  },

  minLength(value: string | readonly unknown[], min: number, options?: GuardOptions) {
    return check(
      value.length >= min,
      "TOO_SHORT",
      (s) => `${s} must have at least ${min} ${unit(value)}`,
      options,
    );
  },

  maxLength(value: string | readonly unknown[], max: number, options?: GuardOptions) {
    return check(
      value.length <= max,
      "TOO_LONG",
      (s) => `${s} must have at most ${max} ${unit(value)}`,
      options,
    );
  },

  /** Limites inclusivos. `NaN` sempre falha. */
  inRange(value: number, { min, max }: Range, options?: GuardOptions): GuardResult {
    if (Number.isNaN(value)) {
      return check(false, "NOT_A_NUMBER", (s) => `${s} must be a number`, options);
    }
    if (min !== undefined && value < min) {
      return check(false, "TOO_SMALL", (s) => `${s} must be at least ${min}`, options);
    }
    if (max !== undefined && value > max) {
      return check(false, "TOO_LARGE", (s) => `${s} must be at most ${max}`, options);
    }
    return PASS;
  },

  integer(value: number, options?: GuardOptions): GuardResult {
    return check(
      Number.isInteger(value),
      "NOT_AN_INTEGER",
      (s) => `${s} must be an integer`,
      options,
    );
  },

  matches(value: string, pattern: RegExp, options?: GuardOptions): GuardResult {
    // Cópia sem flags g/y: `test` em regex com estado (lastIndex) alterna o resultado.
    const stateless = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ""));
    return check(
      stateless.test(value),
      "INVALID_FORMAT",
      (s) => `${s} has an invalid format`,
      options,
    );
  },

  oneOf<const T>(value: unknown, allowed: readonly T[], options?: GuardOptions): GuardResult {
    return check(
      allowed.includes(value as T),
      "NOT_ALLOWED",
      (s) => `${s} must be one of: ${allowed.join(", ")}`,
      options,
    );
  },

  /** Executa todas as verificações e acumula as issues num único `ValidationError`. */
  all(results: readonly GuardResult[]): GuardResult {
    return Result.combine(results).map(() => undefined);
  },
} as const;
