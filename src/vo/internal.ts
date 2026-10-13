// Helpers compartilhados pelos VOs. Não fazem parte da API pública.
import { ValidationError } from "../errors/validation-error.js";
import { Result } from "../result/result.js";

export interface VoOptions {
  /** Nome do campo nas issues de validação (ex.: `billingEmail`). */
  field?: string;
}

/** Entradas vêm de JSON/forms: trata qualquer valor não-string como string vazia em vez de lançar. */
export const asString = (raw: unknown): string => (typeof raw === "string" ? raw : "");

export const invalid = (field: string, code: string, message = `${field} is invalid`) =>
  Result.fail(new ValidationError({ field, code, message }));
