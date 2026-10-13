import { describe, expect, it } from "bun:test";
import { type PaginatedResultDTO, toPaginatedResult, validatePagination } from "../index.js";

describe("toPaginatedResult", () => {
  it("monta o envelope { data, meta } com totalPages = ceil(total / pageSize)", () => {
    const result: PaginatedResultDTO<string> = toPaginatedResult(["a", "b"], 21, {
      page: 2,
      pageSize: 10,
    });

    expect(result).toEqual({
      data: ["a", "b"],
      meta: { page: 2, pageSize: 10, total: 21, totalPages: 3 },
    });
  });

  it("totalPages é 0 quando não há itens", () => {
    expect(toPaginatedResult([], 0, { page: 1, pageSize: 10 }).meta.totalPages).toBe(0);
  });
});

describe("validatePagination", () => {
  it("aceita page >= 1 e pageSize entre 1 e o máximo", () => {
    expect(validatePagination({ page: 1, pageSize: 100 }).unwrap()).toEqual({
      page: 1,
      pageSize: 100,
    });
  });

  it("acumula issues de page e pageSize inválidos", () => {
    const result = validatePagination({ page: 0, pageSize: 1.5 });

    expect(result.isFail() && result.error.issues.map((issue) => issue.field)).toEqual([
      "page",
      "pageSize",
    ]);
  });

  it("respeita maxPageSize (padrão 100)", () => {
    expect(validatePagination({ page: 1, pageSize: 101 }).isFail()).toBe(true);
    expect(validatePagination({ page: 1, pageSize: 500 }, { maxPageSize: 500 }).isOk()).toBe(true);
  });

  it("preserva os demais campos do input (filtros)", () => {
    const input = { page: 1, pageSize: 10, search: "abc" };

    expect(validatePagination(input).unwrap()).toBe(input);
  });
});
