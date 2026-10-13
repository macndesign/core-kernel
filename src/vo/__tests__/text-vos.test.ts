import { describe, expect, it } from "bun:test";
import type { ValidationError, ValidationIssue } from "../../errors/index.js";
import type { Result } from "../../result/index.js";
import { Email, StrongPassword, Text, Url } from "../index.js";

const issues = (result: Result<unknown, ValidationError>): readonly ValidationIssue[] =>
  result.isFail() ? result.error.issues : [];
const codes = (result: Result<unknown, ValidationError>) => issues(result).map((i) => i.code);

describe("Email", () => {
  it("normaliza com trim e lowercase", () => {
    expect(Email.create("  Test.User@Example.COM  ").unwrap().value).toBe("test.user@example.com");
  });

  it("expõe local e domain", () => {
    const email = Email.create("john.doe@pharmacore.com").unwrap();

    expect(email.local).toBe("john.doe");
    expect(email.domain).toBe("pharmacore.com");
  });

  it.each([["invalid"], ["a@b"], ["a b@c.com"], [""]])("rejeita %p com INVALID_EMAIL", (raw) => {
    expect(issues(Email.create(raw))).toEqual([
      { field: "email", code: "INVALID_EMAIL", message: "email is invalid" },
    ]);
  });

  it("rejeita acima de 254 caracteres", () => {
    expect(codes(Email.create(`${"a".repeat(250)}@b.com`))).toEqual(["TOO_LONG"]);
  });

  it("aceita valores não-string vindos de JSON sem lançar", () => {
    expect(Email.create(undefined as unknown as string).isFail()).toBe(true);
  });

  it("usa o field informado nas issues", () => {
    expect(issues(Email.create("x", { field: "billingEmail" }))[0]?.field).toBe("billingEmail");
  });
});

describe("Text", () => {
  it("faz trim e exige ao menos 1 caractere por padrão", () => {
    expect(Text.create("  abc ").unwrap().value).toBe("abc");
    expect(codes(Text.create("   "))).toEqual(["EMPTY"]);
  });

  it("aplica minLength e maxLength", () => {
    expect(codes(Text.create("ab", { minLength: 3 }))).toEqual(["TOO_SHORT"]);
    expect(codes(Text.create("abcd", { maxLength: 3 }))).toEqual(["TOO_LONG"]);
    expect(Text.create("abc", { minLength: 3, maxLength: 3 }).isOk()).toBe(true);
  });

  it("minLength 0 aceita texto vazio", () => {
    expect(Text.create("", { minLength: 0 }).unwrap().value).toBe("");
  });

  it("usa o field informado", () => {
    expect(issues(Text.create("", { field: "name" }))[0]?.field).toBe("name");
  });
});

describe("Url", () => {
  it("aceita http(s) e faz trim", () => {
    expect(Url.create("  https://example.com/path  ").unwrap().value).toBe(
      "https://example.com/path",
    );
  });

  it("expõe hostname", () => {
    expect(Url.create("https://api.example.com:8080/x").unwrap().hostname).toBe("api.example.com");
  });

  it.each([["invalid-url"], [""], ["javascript:alert(1)"], ["ftp://files.example.com"]])(
    "rejeita %p com INVALID_URL",
    (raw) => {
      expect(codes(Url.create(raw))).toEqual(["INVALID_URL"]);
    },
  );

  it("aceita outros protocolos quando configurado", () => {
    expect(Url.create("ftp://files.example.com", { protocols: ["ftp:"] }).isOk()).toBe(true);
  });
});

describe("StrongPassword", () => {
  it("aceita senha que cumpre a política padrão", () => {
    expect(StrongPassword.create("Aa123456!").unwrap().value).toBe("Aa123456!");
  });

  it("devolve uma issue por regra violada", () => {
    expect(codes(StrongPassword.create("aaaa"))).toEqual([
      "TOO_SHORT",
      "MISSING_UPPERCASE",
      "MISSING_DIGIT",
      "MISSING_SYMBOL",
    ]);
  });

  it.each([
    ["aa123456!", "MISSING_UPPERCASE"],
    ["AA123456!", "MISSING_LOWERCASE"],
    ["AaBbCcDd!", "MISSING_DIGIT"],
    ["Aa1234567", "MISSING_SYMBOL"],
  ])("%p → %p", (raw, code) => {
    expect(codes(StrongPassword.create(raw))).toEqual([code]);
  });

  it("a política é configurável", () => {
    expect(
      StrongPassword.create("abcdef", {
        minLength: 6,
        uppercase: false,
        digit: false,
        symbol: false,
      }).isOk(),
    ).toBe(true);
  });

  it("não vaza a senha em toString nem em JSON", () => {
    const password = StrongPassword.create("Aa123456!").unwrap();

    expect(String(password)).toBe("********");
    expect(JSON.stringify({ password })).toBe('{"password":"********"}');
  });
});
