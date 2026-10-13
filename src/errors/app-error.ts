const APP_ERROR_BRAND = Symbol.for("core-kernel/AppError");

/**
 * Categoria do erro. Adapters (HTTP, CLI, UI) mapeiam o `kind` para a sua representação
 * (ex.: `not_found` → 404) sem que o domínio conheça esses detalhes.
 */
export type ErrorKind = "validation" | "not_found" | "conflict" | "forbidden" | "unexpected";

export interface AppErrorOptions {
  /** Código estável e legível por máquina (ex.: `ORDER_NOT_FOUND`). Cada subclasse tem um padrão. */
  code?: string;
  /** Dados extras para diagnóstico ou para o adapter montar a resposta. */
  details?: unknown;
  cause?: unknown;
}

export interface AppErrorJSON {
  name: string;
  kind: ErrorKind;
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Base de todos os erros esperados da aplicação. Erros são **valores** devolvidos dentro
 * de um `Result`, não exceções: estendem `Error` apenas para ter `stack`/`cause` e
 * interoperar com loggers e ferramentas.
 */
export abstract class AppError extends Error {
  abstract readonly kind: ErrorKind;
  readonly code: string;
  readonly details?: unknown;

  protected constructor(message: string, defaultCode: string, options: AppErrorOptions = {}) {
    super(message, "cause" in options ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = options.code ?? defaultCode;
    if (options.details !== undefined) this.details = options.details;
  }

  toJSON(): AppErrorJSON {
    return {
      name: this.name,
      kind: this.kind,
      code: this.code,
      message: this.message,
      ...(this.details !== undefined && { details: this.details }),
    };
  }
}

Object.defineProperty(AppError.prototype, APP_ERROR_BRAND, { value: true });

/**
 * Checa se um valor é um `AppError` pelo brand em vez de `instanceof`, para funcionar
 * mesmo quando o consumidor carrega duas cópias da lib (ESM + CJS).
 */
export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[APP_ERROR_BRAND] === true
  );
}
