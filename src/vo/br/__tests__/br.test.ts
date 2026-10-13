import { describe, expect, it } from "bun:test";
import { Cnpj, Cpf } from "../index.js";

describe("Cpf", () => {
  it("normaliza para dígitos", () => {
    expect(Cpf.create("  529.982.247-25  ").unwrap().value).toBe("52998224725");
  });

  it("expõe formatted, baseDigits e checkDigits", () => {
    const cpf = Cpf.create("52998224725").unwrap();

    expect(cpf.formatted).toBe("529.982.247-25");
    expect(cpf.baseDigits).toBe("529982247");
    expect(cpf.checkDigits).toBe("25");
  });

  it.each([
    ["1234567890"], // curto
    ["111.111.111-11"], // repetido
    ["529.982.247-26"], // dígito verificador errado
    [""],
  ])("rejeita %p com INVALID_CPF", (raw) => {
    const result = Cpf.create(raw);

    expect(result.isFail() && result.error.issues).toEqual([
      { field: "cpf", code: "INVALID_CPF", message: "cpf is invalid" },
    ]);
  });

  it("não lança com valor não-string", () => {
    expect(Cpf.create(undefined as unknown as string).isFail()).toBe(true);
  });
});

describe("Cnpj numérico", () => {
  it("normaliza e valida os dígitos verificadores", () => {
    const cnpj = Cnpj.create("11.222.333/0001-81").unwrap();

    expect(cnpj.value).toBe("11222333000181");
    expect(cnpj.formatted).toBe("11.222.333/0001-81");
    expect(cnpj.root).toBe("11222333");
  });

  it.each([
    ["11.222.333/0001-82"], // dígito verificador errado
    ["11111111111111"], // repetido
    ["1122233300018"], // curto
    [""],
  ])("rejeita %p com INVALID_CNPJ", (raw) => {
    const result = Cnpj.create(raw);

    expect(result.isFail() && result.error.issues[0]?.code).toBe("INVALID_CNPJ");
  });
});

describe("Cnpj alfanumérico (IN RFB 2.229/2024, a partir de jul/2026)", () => {
  it("aceita o exemplo oficial da Receita e normaliza para maiúsculas", () => {
    const cnpj = Cnpj.create("12.abc.345/01de-35").unwrap();

    expect(cnpj.value).toBe("12ABC34501DE35");
    expect(cnpj.formatted).toBe("12.ABC.345/01DE-35");
    expect(cnpj.root).toBe("12ABC345");
  });

  it("rejeita dígito verificador errado", () => {
    expect(Cnpj.create("12.ABC.345/01DE-36").isFail()).toBe(true);
  });

  it("rejeita letras nos dígitos verificadores", () => {
    expect(Cnpj.create("12.ABC.345/01DE-3A").isFail()).toBe(true);
  });

  it("rejeita caracteres fora de A–Z e 0–9", () => {
    expect(Cnpj.create("12.ABÇ.345/01DE-35").isFail()).toBe(true);
  });
});

describe("raízes iguais", () => {
  it("matriz e filial compartilham a raiz", () => {
    const matriz = Cnpj.create("11.222.333/0001-81").unwrap();
    const filial = Cnpj.create("11.222.333/0002-62").unwrap();

    expect(matriz.root).toBe(filial.root);
    expect(matriz.equals(filial)).toBe(false);
  });
});
