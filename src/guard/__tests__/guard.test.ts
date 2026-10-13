import { describe, expect, it } from "bun:test";
import type { ValidationError, ValidationIssue } from "../../errors/index.js";
import type { Result } from "../../result/index.js";
import { Guard } from "../index.js";

const issuesOf = (result: Result<void, ValidationError>): readonly ValidationIssue[] =>
  result.isFail() ? result.error.issues : [];

const issueOf = (result: Result<void, ValidationError>): ValidationIssue | undefined =>
  issuesOf(result)[0];

describe("Guard.required", () => {
  it.each([[0], [""], [false], [[]], [{}]])("aceita %p", (value) => {
    expect(Guard.required(value).isOk()).toBe(true);
  });

  it.each([[null], [undefined]])("rejeita %p", (value) => {
    expect(issueOf(Guard.required(value, { field: "name" }))).toEqual({
      field: "name",
      code: "REQUIRED",
      message: "name is required",
    });
  });
});

describe("Guard.notEmpty", () => {
  it.each([["a"], [" a "], [[1]]])("aceita %p", (value) => {
    expect(Guard.notEmpty(value).isOk()).toBe(true);
  });

  it.each([[null], [undefined], [""], ["   "], [[]]])("rejeita %p", (value) => {
    expect(issueOf(Guard.notEmpty(value))).toEqual({
      code: "EMPTY",
      message: "value must not be empty",
    });
  });
});

describe("Guard.minLength / Guard.maxLength", () => {
  it("minLength aceita no limite e rejeita abaixo", () => {
    expect(Guard.minLength("abc", 3).isOk()).toBe(true);
    expect(Guard.minLength([1, 2, 3], 3).isOk()).toBe(true);
    expect(issueOf(Guard.minLength("ab", 3, { field: "name" }))).toEqual({
      field: "name",
      code: "TOO_SHORT",
      message: "name must have at least 3 characters",
    });
  });

  it("maxLength aceita no limite e rejeita acima", () => {
    expect(Guard.maxLength("abc", 3).isOk()).toBe(true);
    expect(issueOf(Guard.maxLength([1, 2, 3, 4], 3))).toEqual({
      code: "TOO_LONG",
      message: "value must have at most 3 items",
    });
  });
});

describe("Guard.inRange", () => {
  it("aceita dentro dos limites (inclusivos)", () => {
    expect(Guard.inRange(0, { min: 0, max: 10 }).isOk()).toBe(true);
    expect(Guard.inRange(10, { min: 0, max: 10 }).isOk()).toBe(true);
    expect(Guard.inRange(-5, { max: 10 }).isOk()).toBe(true);
  });

  it("rejeita abaixo do mínimo", () => {
    expect(issueOf(Guard.inRange(-1, { min: 0 }, { field: "age" }))).toEqual({
      field: "age",
      code: "TOO_SMALL",
      message: "age must be at least 0",
    });
  });

  it("rejeita acima do máximo", () => {
    expect(issueOf(Guard.inRange(11, { max: 10 }))?.code).toBe("TOO_LARGE");
  });

  it("rejeita NaN", () => {
    expect(issueOf(Guard.inRange(Number.NaN, { min: 0 }))?.code).toBe("NOT_A_NUMBER");
  });
});

describe("Guard.integer", () => {
  it("aceita inteiros e rejeita frações e NaN", () => {
    expect(Guard.integer(3).isOk()).toBe(true);
    expect(Guard.integer(-3).isOk()).toBe(true);
    expect(issueOf(Guard.integer(1.5))?.code).toBe("NOT_AN_INTEGER");
    expect(issueOf(Guard.integer(Number.NaN))?.code).toBe("NOT_AN_INTEGER");
  });
});

describe("Guard.matches", () => {
  it("aceita quando casa e rejeita quando não casa", () => {
    expect(Guard.matches("abc-123", /^[a-z]+-\d+$/).isOk()).toBe(true);
    expect(issueOf(Guard.matches("abc", /^\d+$/))).toEqual({
      code: "INVALID_FORMAT",
      message: "value has an invalid format",
    });
  });

  it("não sofre com regex global (lastIndex)", () => {
    const regex = /a/g;

    expect(Guard.matches("a", regex).isOk()).toBe(true);
    expect(Guard.matches("a", regex).isOk()).toBe(true);
  });
});

describe("Guard.oneOf", () => {
  it("aceita valores da lista e rejeita os demais", () => {
    const statuses = ["open", "closed"] as const;

    expect(Guard.oneOf("open", statuses).isOk()).toBe(true);
    expect(issueOf(Guard.oneOf("archived", statuses, { field: "status" }))).toEqual({
      field: "status",
      code: "NOT_ALLOWED",
      message: "status must be one of: open, closed",
    });
  });
});

describe("opções de issue", () => {
  it("code e message podem ser sobrescritos", () => {
    const result = Guard.matches("x", /@/, {
      field: "email",
      code: "INVALID_EMAIL",
      message: "E-mail inválido",
    });

    expect(issueOf(result)).toEqual({
      field: "email",
      code: "INVALID_EMAIL",
      message: "E-mail inválido",
    });
  });
});

describe("Guard.all", () => {
  it("é ok quando todos passam", () => {
    expect(Guard.all([Guard.required(1), Guard.notEmpty("a")]).isOk()).toBe(true);
    expect(Guard.all([]).isOk()).toBe(true);
  });

  it("acumula as issues de todas as falhas", () => {
    const result = Guard.all([
      Guard.notEmpty("", { field: "name" }),
      Guard.required(1, { field: "id" }),
      Guard.inRange(200, { max: 150 }, { field: "age" }),
    ]);

    expect(issuesOf(result).map((issue) => issue.field)).toEqual(["name", "age"]);
  });

  it("encadeado com flatMap interrompe na primeira falha", () => {
    const value = "";
    const result = Guard.notEmpty(value, { field: "email" }).flatMap(() =>
      Guard.matches(value, /@/, { field: "email" }),
    );

    expect(issuesOf(result).map((issue) => issue.code)).toEqual(["EMPTY"]);
  });
});
