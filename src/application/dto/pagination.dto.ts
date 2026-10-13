import type { ValidationError } from "../../errors/validation-error.js";
import { Guard } from "../../guard/guard.js";
import type { Result } from "../../result/result.js";

// Nomes e formato iguais ao contrato de paginação do pharmacore.

/** Entrada de queries paginadas. `page` começa em 1. */
export interface PaginatedInputDTO {
  page: number;
  pageSize: number;
}

export interface PaginationMetaDTO {
  page: number;
  pageSize: number;
  total: number;
  /** `Math.ceil(total / pageSize)` */
  totalPages: number;
}

export interface PaginatedResultDTO<T> {
  data: T[];
  meta: PaginationMetaDTO;
}

export interface PaginationLimits {
  /** Padrão: 100. */
  maxPageSize?: number;
}

/** Valida `page` (inteiro ≥ 1) e `pageSize` (inteiro entre 1 e `maxPageSize`), acumulando issues. */
export function validatePagination<T extends PaginatedInputDTO>(
  input: T,
  { maxPageSize = 100 }: PaginationLimits = {},
): Result<T, ValidationError> {
  return Guard.all([
    Guard.integer(input.page, { field: "page" }).flatMap(() =>
      Guard.inRange(input.page, { min: 1 }, { field: "page" }),
    ),
    Guard.integer(input.pageSize, { field: "pageSize" }).flatMap(() =>
      Guard.inRange(input.pageSize, { min: 1, max: maxPageSize }, { field: "pageSize" }),
    ),
  ]).map(() => input);
}

/** Monta o envelope `{ data, meta }` a partir da página de itens e do total. */
export function toPaginatedResult<T>(
  data: T[],
  total: number,
  { page, pageSize }: PaginatedInputDTO,
): PaginatedResultDTO<T> {
  return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}
