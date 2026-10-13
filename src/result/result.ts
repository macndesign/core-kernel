import type { AppError } from "../errors/app-error.js";
import { UnexpectedError } from "../errors/unexpected-error.js";
import { ValidationError } from "../errors/validation-error.js";

const RESULT_BRAND = Symbol.for("core-kernel/Result");

interface ResultMethods<T, E extends AppError> {
  isOk(): this is Ok<T, E>;
  isFail(): this is Fail<T, E>;
  /** Transforma o valor de sucesso; não executa em falha. */
  map<U>(fn: (value: T) => U): Result<U, E>;
  /** Encadeia uma operação que também retorna `Result`; os tipos de erro se acumulam. */
  flatMap<U, F extends AppError>(fn: (value: T) => Result<U, F>): Result<U, E | F>;
  /** Transforma o erro; não executa em sucesso. */
  mapError<F extends AppError>(fn: (error: E) => F): Result<T, F>;
  match<A, B = A>(handlers: { ok: (value: T) => A; fail: (error: E) => B }): A | B;
  /** Devolve o valor ou **lança** o erro. Use só em testes e nas bordas da aplicação. */
  unwrap(): T;
  unwrapOr<U>(fallback: U): T | U;
}

export interface Ok<T, E extends AppError = never> extends ResultMethods<T, E> {
  readonly ok: true;
  readonly value: T;
}

export interface Fail<T, E extends AppError> extends ResultMethods<T, E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Resultado de uma operação que pode falhar de forma esperada. O valor (`value`) e o
 * erro (`error`) só ficam acessíveis depois do narrowing com `isOk()`/`isFail()` (ou `ok`).
 */
export type Result<T, E extends AppError = AppError> = Ok<T, E> | Fail<T, E>;

class OkImpl<T, E extends AppError> implements Ok<T, E> {
  readonly ok = true as const;

  constructor(readonly value: T) {
    Object.freeze(this);
  }

  isOk(): this is Ok<T, E> {
    return true;
  }

  isFail(): this is Fail<T, E> {
    return false;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return new OkImpl<U, E>(fn(this.value));
  }

  flatMap<U, F extends AppError>(fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return fn(this.value);
  }

  mapError<F extends AppError>(_fn: (error: E) => F): Result<T, F> {
    return this as unknown as Ok<T, F>;
  }

  match<A, B = A>(handlers: { ok: (value: T) => A; fail: (error: E) => B }): A | B {
    return handlers.ok(this.value);
  }

  unwrap(): T {
    return this.value;
  }

  unwrapOr<U>(_fallback: U): T | U {
    return this.value;
  }
}

class FailImpl<T, E extends AppError> implements Fail<T, E> {
  readonly ok = false as const;

  constructor(readonly error: E) {
    Object.freeze(this);
  }

  isOk(): this is Ok<T, E> {
    return false;
  }

  isFail(): this is Fail<T, E> {
    return true;
  }

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return this as unknown as Fail<U, E>;
  }

  flatMap<U, F extends AppError>(_fn: (value: T) => Result<U, F>): Result<U, E | F> {
    return this as unknown as Fail<U, E>;
  }

  mapError<F extends AppError>(fn: (error: E) => F): Result<T, F> {
    return new FailImpl<T, F>(fn(this.error));
  }

  match<A, B = A>(handlers: { ok: (value: T) => A; fail: (error: E) => B }): A | B {
    return handlers.fail(this.error);
  }

  unwrap(): T {
    throw this.error;
  }

  unwrapOr<U>(fallback: U): T | U {
    return fallback;
  }
}

for (const impl of [OkImpl, FailImpl]) {
  Object.defineProperty(impl.prototype, RESULT_BRAND, { value: true });
}

function ok(): Result<void, never>;
function ok<T>(value: T): Result<T, never>;
function ok<T>(value?: T): Result<T | undefined, never> {
  return new OkImpl(value);
}

function fail<E extends AppError>(error: E): Result<never, E> {
  return new FailImpl<never, E>(error);
}

type AnyResult = Result<unknown, AppError>;
type ValuesOf<R extends readonly AnyResult[]> = {
  -readonly [K in keyof R]: R[K] extends Result<infer T, AppError> ? T : never;
};
type ErrorOf<R extends AnyResult> = R extends Result<unknown, infer E> ? E : never;

/**
 * Junta vários Results em um com a tupla dos valores.
 * Em falha: se **todas** as falhas forem de validação, agrega as issues num único
 * `ValidationError` (útil para validar vários campos de uma vez); caso contrário,
 * devolve a primeira falha que não é de validação.
 */
function combine<const R extends readonly AnyResult[]>(
  results: R,
): Result<ValuesOf<R>, ErrorOf<R[number]>> {
  const failures = results.filter((result) => !result.ok).map((result) => result.error);
  const [first] = failures;
  if (first === undefined) {
    return ok(results.map((result) => (result as Ok<unknown>).value) as ValuesOf<R>);
  }
  if (failures.length === 1) return fail(first as ErrorOf<R[number]>);

  const nonValidation = failures.find((error) => error.kind !== "validation");
  if (nonValidation) return fail(nonValidation as ErrorOf<R[number]>);

  const merged = ValidationError.merge(failures as ValidationError[]);
  return fail(merged as unknown as ErrorOf<R[number]>);
}

/** Executa código que pode lançar exceção (ex.: lib de terceiros) e converte em `Result`. */
function tryCatch<T>(fn: () => T): Result<T, UnexpectedError>;
function tryCatch<T, E extends AppError>(
  fn: () => T,
  mapError: (thrown: unknown) => E,
): Result<T, E>;
function tryCatch<T>(
  fn: () => T,
  mapError: (thrown: unknown) => AppError = UnexpectedError.from,
): Result<T, AppError> {
  try {
    return ok(fn());
  } catch (thrown) {
    return fail(mapError(thrown));
  }
}

/** Versão assíncrona de `Result.try`; captura rejeições e exceções síncronas de `fn`. */
function tryCatchAsync<T>(fn: () => Promise<T>): Promise<Result<T, UnexpectedError>>;
function tryCatchAsync<T, E extends AppError>(
  fn: () => Promise<T>,
  mapError: (thrown: unknown) => E,
): Promise<Result<T, E>>;
async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  mapError: (thrown: unknown) => AppError = UnexpectedError.from,
): Promise<Result<T, AppError>> {
  try {
    return ok(await fn());
  } catch (thrown) {
    return fail(mapError(thrown));
  }
}

/** Checa se um valor é um `Result` pelo brand (funciona entre cópias ESM/CJS da lib). */
function isResult(value: unknown): value is AnyResult {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[RESULT_BRAND] === true
  );
}

export const Result = {
  ok,
  fail,
  combine,
  try: tryCatch,
  tryAsync: tryCatchAsync,
  isResult,
} as const;
