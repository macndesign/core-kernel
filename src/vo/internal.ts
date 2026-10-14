// Helpers compartilhados pelos VOs. `VoOptions` e `IssueOverride` são públicos (reexportados
// em ./index.ts); o resto é interno.
import { ValidationError } from "../errors/validation-error.js";

import { Result } from "../result/result.js";

/** Troca o código e/ou a mensagem de uma issue (ex.: para outro idioma). */
export interface IssueOverride {
  code?: string;
  message?: string;
}

/**
 * Opções comuns dos VOs. `C` é a união dos códigos que o VO pode gerar; `errors` é indexado
 * por esses códigos padrão:
 *
 * ```ts
 * Email.create(raw, { field: "contato", errors: { INVALID_EMAIL: { code: "EMAIL_INVALIDO", message: "E-mail inválido" } } });
 * ```
 */
export interface VoOptions<C extends string = string> {
  /** Nome do campo nas issues de validação (ex.: `billingEmail`). */
  field?: string;
  errors?: Partial<Record<C, IssueOverride>>;
}

/** Entradas vêm de JSON/forms: trata qualquer valor não-string como string vazia em vez de lançar. */
export const asString = (raw: unknown): string => (typeof raw === "string" ? raw : "");

export const invalid = (field: string, code: string, message = `${field} is invalid`) =>
  Result.fail(new ValidationError({ field, code, message }));

/** Aplica os overrides de `errors` às issues de uma falha de validação. */
export function withOverrides<T>(
  result: Result<T, ValidationError>,
  errors: Partial<Record<string, IssueOverride>> | undefined,
): Result<T, ValidationError> {
  if (!errors) return result;
  return result.mapError(
    (error) =>
      new ValidationError(
        error.issues.map((issue) => {
          const override = errors[issue.code];
          if (!override) return issue;
          return {
            ...issue,
            ...(override.code !== undefined && { code: override.code }),
            ...(override.message !== undefined && { message: override.message }),
          };
        }),
      ),
  );
}
