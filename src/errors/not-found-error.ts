import { AppError, type AppErrorOptions } from "./app-error.js";

/** Recurso procurado não existe. */
export class NotFoundError extends AppError {
  readonly kind = "not_found" as const;

  constructor(message: string, options?: AppErrorOptions) {
    super(message, "NOT_FOUND", options);
  }
}
