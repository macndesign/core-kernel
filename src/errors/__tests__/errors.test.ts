import { describe, expect, it } from "bun:test";
import {
  type AppError,
  ConflictError,
  ForbiddenError,
  isAppError,
  NotFoundError,
  UnexpectedError,
  ValidationError,
} from "../index.js";

describe("AppError subclasses", () => {
  it.each([
    [new NotFoundError("Order not found"), "not_found", "NOT_FOUND", "NotFoundError"],
    [new ConflictError("Email already taken"), "conflict", "CONFLICT", "ConflictError"],
    [new ForbiddenError("Not allowed"), "forbidden", "FORBIDDEN", "ForbiddenError"],
    [new UnexpectedError("Boom"), "unexpected", "UNEXPECTED", "UnexpectedError"],
  ] as const)("%p tem kind, code padrão e name", (error, kind, code, name) => {
    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe(kind);
    expect(error.code).toBe(code);
    expect(error.name).toBe(name);
    expect(error.details).toBeUndefined();
  });

  it("aceita code, details e cause customizados", () => {
    const cause = new Error("db down");
    const error = new NotFoundError("Order not found", {
      code: "ORDER_NOT_FOUND",
      details: { id: "42" },
      cause,
    });

    expect(error.message).toBe("Order not found");
    expect(error.code).toBe("ORDER_NOT_FOUND");
    expect(error.details).toEqual({ id: "42" });
    expect(error.cause).toBe(cause);
  });

  it("serializa para JSON com os campos relevantes", () => {
    const error = new ConflictError("Email already taken", {
      code: "EMAIL_TAKEN",
      details: { email: "a@b.com" },
    });

    expect(JSON.parse(JSON.stringify(error))).toEqual({
      name: "ConflictError",
      kind: "conflict",
      code: "EMAIL_TAKEN",
      message: "Email already taken",
      details: { email: "a@b.com" },
    });
  });

  it("kind permite narrowing em uma união de erros", () => {
    const describe = (error: NotFoundError | ValidationError): string =>
      error.kind === "validation" ? `${error.issues.length} issues` : error.message;

    expect(describe(new NotFoundError("x"))).toBe("x");
    expect(describe(new ValidationError({ code: "C", message: "m" }))).toBe("1 issues");
  });
});

describe("ValidationError", () => {
  it("aceita uma issue única", () => {
    const error = new ValidationError({
      field: "email",
      code: "INVALID_EMAIL",
      message: "Invalid email",
    });

    expect(error.kind).toBe("validation");
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.message).toBe("Invalid email");
    expect(error.issues).toEqual([
      { field: "email", code: "INVALID_EMAIL", message: "Invalid email" },
    ]);
  });

  it("aceita várias issues e compõe a mensagem", () => {
    const error = new ValidationError([
      { field: "name", code: "REQUIRED", message: "Name is required" },
      { field: "age", code: "OUT_OF_RANGE", message: "Age out of range" },
    ]);

    expect(error.issues).toHaveLength(2);
    expect(error.message).toBe("Name is required; Age out of range");
  });

  it("aceita message e code customizados", () => {
    const error = new ValidationError(
      { code: "C", message: "m" },
      { message: "Invalid order", code: "INVALID_ORDER" },
    );

    expect(error.message).toBe("Invalid order");
    expect(error.code).toBe("INVALID_ORDER");
  });

  it("lança TypeError sem issues (uso indevido da API)", () => {
    expect(() => new ValidationError([])).toThrow(TypeError);
  });

  it("issues são imutáveis", () => {
    const error = new ValidationError({ code: "C", message: "m" });

    expect(Object.isFrozen(error.issues)).toBe(true);
  });

  it("merge junta as issues de vários erros", () => {
    const merged = ValidationError.merge([
      new ValidationError({ field: "a", code: "A", message: "a" }),
      new ValidationError([
        { field: "b", code: "B", message: "b" },
        { field: "c", code: "C", message: "c" },
      ]),
    ]);

    expect(merged.issues.map((i) => i.field)).toEqual(["a", "b", "c"]);
    expect(merged.code).toBe("VALIDATION_FAILED");
  });

  it("serializa issues no JSON", () => {
    const error = new ValidationError({ field: "f", code: "C", message: "m" });

    expect(JSON.parse(JSON.stringify(error))).toEqual({
      name: "ValidationError",
      kind: "validation",
      code: "VALIDATION_FAILED",
      message: "m",
      issues: [{ field: "f", code: "C", message: "m" }],
    });
  });
});

describe("UnexpectedError.from", () => {
  it("preserva mensagem e cause de um Error", () => {
    const original = new Error("socket hang up");
    const error = UnexpectedError.from(original);

    expect(error.message).toBe("socket hang up");
    expect(error.cause).toBe(original);
  });

  it("converte valores que não são Error", () => {
    expect(UnexpectedError.from("boom").message).toBe("boom");
    expect(UnexpectedError.from(42).cause).toBe(42);
  });
});

describe("isAppError", () => {
  it("reconhece AppErrors pelo brand, não por instanceof", () => {
    const fromOtherCopy = Object.assign(Object.create(null), {
      [Symbol.for("core-kernel/AppError")]: true,
    }) as unknown;

    expect(isAppError(new NotFoundError("x"))).toBe(true);
    expect(isAppError(fromOtherCopy)).toBe(true);
  });

  it("rejeita valores que não são AppError", () => {
    expect(isAppError(new Error("x"))).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError("x")).toBe(false);
  });

  it("faz narrowing de unknown", () => {
    const value: unknown = new ForbiddenError("x");
    if (isAppError(value)) {
      const error: AppError = value;
      expect(error.kind).toBe("forbidden");
    }
  });
});
