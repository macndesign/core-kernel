import { AppError, type AppErrorOptions } from "./app-error.js";

/** Quem pediu a operação não tem permissão para ela. */
export class ForbiddenError extends AppError {
  readonly kind = "forbidden" as const;

  constructor(message: string, options?: AppErrorOptions) {
    super(message, "FORBIDDEN", options);
  }
}
