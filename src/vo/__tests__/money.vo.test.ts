import { describe, expect, it } from "bun:test";
import { Money } from "../index.js";

const brl = (amount: number) => Money.create({ amount, currency: "BRL" }).unwrap();

describe("Money.create", () => {
  it("guarda o valor em unidades mínimas (centavos) e a moeda em maiúsculas", () => {
    expect(Money.create({ amount: 1050, currency: "brl" }).unwrap().value).toEqual({
      amount: 1050,
      currency: "BRL",
    });
  });

  it("aceita valores negativos (estornos, saldos)", () => {
    expect(brl(-100).isNegative()).toBe(true);
  });

  it("rejeita valor não inteiro e moeda inválida, acumulando issues", () => {
    const result = Money.create({ amount: 10.5, currency: "real" });

    expect(result.isFail() && result.error.issues.map((i) => [i.field, i.code])).toEqual([
      ["amount", "NOT_AN_INTEGER"],
      ["currency", "INVALID_CURRENCY"],
    ]);
  });
});

describe("Money.fromDecimal / toDecimal", () => {
  it("converte usando as casas decimais da moeda", () => {
    expect(Money.fromDecimal(10.5, "BRL").unwrap().amount).toBe(1050);
    expect(Money.fromDecimal(1000, "JPY").unwrap().amount).toBe(1000);
    expect(brl(1050).toDecimal()).toBe(10.5);
  });

  it("arredonda para a unidade mínima", () => {
    expect(Money.fromDecimal(0.1 + 0.2, "BRL").unwrap().amount).toBe(30);
  });

  it("rejeita moeda inválida", () => {
    expect(Money.fromDecimal(1, "XX").isFail()).toBe(true);
  });
});

describe("aritmética", () => {
  it("soma e subtrai na mesma moeda", () => {
    expect(brl(1000).add(brl(50)).unwrap().amount).toBe(1050);
    expect(brl(1000).subtract(brl(1050)).unwrap().amount).toBe(-50);
  });

  it("falha com CURRENCY_MISMATCH entre moedas diferentes", () => {
    const usd = Money.create({ amount: 1, currency: "USD" }).unwrap();
    const result = brl(1).add(usd);

    expect(result.isFail() && result.error.issues[0]?.code).toBe("CURRENCY_MISMATCH");
    expect(brl(1).subtract(usd).isFail()).toBe(true);
  });

  it("multiplica arredondando para a unidade mínima", () => {
    expect(brl(999).multiply(3).amount).toBe(2997);
    expect(brl(1000).multiply(0.333).amount).toBe(333);
  });

  it("é imutável: operações devolvem novas instâncias", () => {
    const original = brl(100);
    original.multiply(2);

    expect(original.amount).toBe(100);
  });
});

describe("consultas e formatação", () => {
  it("isZero / isPositive / isNegative", () => {
    expect(brl(0).isZero()).toBe(true);
    expect(brl(1).isPositive()).toBe(true);
    expect(brl(0).isPositive()).toBe(false);
  });

  it("formata com Intl no locale informado (padrão pt-BR)", () => {
    expect(brl(123456).format().replace(/\s/g, " ")).toBe("R$ 1.234,56");
    expect(Money.create({ amount: 1050, currency: "USD" }).unwrap().format("en-US")).toBe("$10.50");
  });

  it("igualdade considera valor e moeda", () => {
    expect(brl(1).equals(brl(1))).toBe(true);
    expect(brl(1).equals(Money.create({ amount: 1, currency: "USD" }).unwrap())).toBe(false);
  });
});
