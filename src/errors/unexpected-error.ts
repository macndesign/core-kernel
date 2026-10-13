import { AppError, type AppErrorOptions } from "./app-error.js";

/**
 * Falha que não faz parte das regras de negócio (infraestrutura, bug, exceção de terceiros).
 * Normalmente nasce em `Result.try`/`Result.tryAsync` ou em adapters.
 */
export class UnexpectedError extends AppError {
  readonly kind = "unexpected" as const;

  constructor(message: string, options?: AppErrorOptions) {
    super(message, "UNEXPECTED", options);
  }

  /** Converte qualquer valor lançado (`catch (e)`) em `UnexpectedError`, preservando-o em `cause`. */
  static from(thrown: unknown): UnexpectedError {
    const message = thrown instanceof Error ? thrown.message : String(thrown);
    return new UnexpectedError(message, { cause: thrown });
  }
}
