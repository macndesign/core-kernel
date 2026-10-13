import { AppError, type AppErrorOptions } from "./app-error.js";

/** A operação conflita com o estado atual (ex.: e-mail já cadastrado, transição de estado inválida). */
export class ConflictError extends AppError {
  readonly kind = "conflict" as const;

  constructor(message: string, options?: AppErrorOptions) {
    super(message, "CONFLICT", options);
  }
}
