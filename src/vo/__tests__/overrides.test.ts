import { describe, expect, it } from "bun:test";
import type { ValidationError, ValidationIssue } from "../../errors/index.js";
import type { Result } from "../../result/index.js";
import { Cnpj, Cpf } from "../br/index.js";
import { DateRange, Email, Money, StrongPassword, Text, Url } from "../index.js";

const issues = (result: Result<unknown, ValidationError>): readonly ValidationIssue[] =>
  result.isFail() ? result.error.issues : [];

describe("errors: troca código e mensagem pelo código padrão", () => {
  it("Email", () => {
    const result = Email.create("x", {
      field: "contato",
      errors: { INVALID_EMAIL: { code: "EMAIL_INVALIDO", message: "E-mail inválido" } },
    });

    expect(issues(result)).toEqual([
      { field: "contato", code: "EMAIL_INVALIDO", message: "E-mail inválido" },
    ]);
    expect(result.isFail() && result.error.message).toBe("E-mail inválido");
  });

  it("só o code, mantendo a mensagem padrão", () => {
    expect(issues(Email.create("x", { errors: { INVALID_EMAIL: { code: "E1" } } }))).toEqual([
      { field: "email", code: "E1", message: "email is invalid" },
    ]);
  });

  it("só a mensagem, mantendo o code padrão", () => {
    expect(
      issues(Text.create("", { field: "nome", errors: { EMPTY: { message: "Informe o nome" } } })),
    ).toEqual([{ field: "nome", code: "EMPTY", message: "Informe o nome" }]);
  });

  it("códigos sem override ficam como estão", () => {
    const result = Text.create("abcd", {
      maxLength: 3,
      errors: { EMPTY: { code: "VAZIO" } },
    });

    expect(issues(result).map((i) => i.code)).toEqual(["TOO_LONG"]);
  });

  it("VOs com várias issues trocam cada uma pelo seu código", () => {
    const result = StrongPassword.create("aaaa", {
      errors: {
        TOO_SHORT: { code: "SENHA_CURTA" },
        MISSING_DIGIT: { code: "SEM_DIGITO", message: "Inclua um número" },
      },
    });

    expect(issues(result).map((i) => [i.code, i.message])).toEqual([
      ["SENHA_CURTA", "password must have at least 8 characters"],
      ["MISSING_UPPERCASE", "password must contain an uppercase letter"],
      ["SEM_DIGITO", "Inclua um número"],
      ["MISSING_SYMBOL", "password must contain a symbol"],
    ]);
  });

  it("Url, Cpf e Cnpj", () => {
    expect(
      issues(Url.create("x", { errors: { INVALID_URL: { code: "URL_INVALIDA" } } }))[0]?.code,
    ).toBe("URL_INVALIDA");
    expect(
      issues(Cpf.create("1", { errors: { INVALID_CPF: { code: "CPF_INVALIDO" } } }))[0]?.code,
    ).toBe("CPF_INVALIDO");
    expect(
      issues(Cnpj.create("1", { errors: { INVALID_CNPJ: { code: "CNPJ_INVALIDO" } } }))[0]?.code,
    ).toBe("CNPJ_INVALIDO");
  });

  it("Money (create e fromDecimal)", () => {
    const errors = { INVALID_CURRENCY: { code: "MOEDA_INVALIDA" } };

    expect(issues(Money.create({ amount: 1, currency: "x" }, { errors }))[0]?.code).toBe(
      "MOEDA_INVALIDA",
    );
    expect(issues(Money.fromDecimal(1, "x", { errors }))[0]?.code).toBe("MOEDA_INVALIDA");
  });

  it("DateRange aceita field (prefixo) e errors", () => {
    const result = DateRange.create(
      { start: "2026-01-02T00:00:00Z", end: "2026-01-01T00:00:00Z" },
      { field: "periodo", errors: { INVALID_DATE_RANGE: { code: "PERIODO_INVALIDO" } } },
    );

    expect(issues(result)).toEqual([
      { field: "periodo.end", code: "PERIODO_INVALIDO", message: "end must be after start" },
    ]);
  });

  it("o tipo restringe as chaves aos códigos que o VO gera", () => {
    // @ts-expect-error Email não gera TOO_SHORT
    Email.create("x", { errors: { TOO_SHORT: { code: "X" } } });
    expect(true).toBe(true);
  });

  it("sucesso não é afetado", () => {
    expect(Email.create("a@b.com", { errors: { INVALID_EMAIL: { code: "X" } } }).isOk()).toBe(true);
  });
});
