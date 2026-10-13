import type { AppError } from "../errors/app-error.js";
import type { ValidationError } from "../errors/validation-error.js";
import type { Fail, Ok, Result } from "../result/result.js";

// Asserções independentes de test runner (bun:test, vitest, jest, node:test).

const describe = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

/** Garante sucesso e faz narrowing (`result.value` fica acessível). */
export function assertOk<T, E extends AppError>(result: Result<T, E>): asserts result is Ok<T, E> {
  if (result.isFail()) throw new Error(`Expected Ok, got Fail: ${describe(result.error)}`);
}

/**
 * Garante falha e faz narrowing (`result.error` fica acessível). Com `code`, exige que ele
 * seja o `code` do erro ou de alguma issue de validação.
 */
export function assertFail<T, E extends AppError>(
  result: Result<T, E>,
  code?: string,
): asserts result is Fail<E> {
  if (result.isOk()) throw new Error(`Expected Fail, got Ok: ${describe(result.value)}`);
  if (code === undefined) return;
  const { issues = [] } = result.error as { issues?: ValidationError["issues"] };
  const codes = [result.error.code, ...issues.map((issue) => issue.code)];
  if (!codes.includes(code)) throw new Error(`Expected code ${code}, got ${codes.join(", ")}`);
}
