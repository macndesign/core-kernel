import { AppError, type AppErrorJSON, type AppErrorOptions } from "./app-error.js";

export interface ValidationIssue {
  /** Código estável da regra violada (ex.: `INVALID_EMAIL`, `TOO_SHORT`). */
  readonly code: string;
  readonly message: string;
  /** Campo de origem, quando houver (ex.: `email`, `address.zipCode`). */
  readonly field?: string;
}

export interface ValidationErrorOptions extends AppErrorOptions {
  /** Mensagem geral. Padrão: as mensagens das issues separadas por `; `. */
  message?: string;
}

/**
 * Entrada inválida. Carrega uma ou mais `issues` para que formulários e APIs possam
 * apontar todos os campos com problema de uma vez (ver `Result.combine`).
 */
export class ValidationError extends AppError {
  readonly kind = "validation" as const;
  readonly issues: readonly ValidationIssue[];

  constructor(
    issues: ValidationIssue | readonly ValidationIssue[],
    options: ValidationErrorOptions = {},
  ) {
    const list: readonly ValidationIssue[] = Array.isArray(issues) ? issues : [issues];
    if (list.length === 0) {
      throw new TypeError("ValidationError requires at least one issue");
    }
    const { message, ...rest } = options;
    super(message ?? list.map((issue) => issue.message).join("; "), "VALIDATION_FAILED", rest);
    this.issues = Object.freeze(list.map((issue) => Object.freeze({ ...issue })));
  }

  /** Junta as issues de vários `ValidationError` em um só. */
  static merge(errors: readonly ValidationError[]): ValidationError {
    return new ValidationError(errors.flatMap((error) => error.issues));
  }

  override toJSON(): AppErrorJSON & { issues: readonly ValidationIssue[] } {
    return { ...super.toJSON(), issues: this.issues };
  }
}
