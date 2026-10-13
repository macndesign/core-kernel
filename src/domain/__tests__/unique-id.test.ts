import { afterEach, describe, expect, it } from "bun:test";
import { UniqueId } from "../index.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class OrderId extends UniqueId {
  declare private readonly __brand: "OrderId";
}

class CustomerId extends UniqueId {
  declare private readonly __brand: "CustomerId";
}

describe("UniqueId.generate", () => {
  it("gera UUID v4 por padrão", () => {
    expect(UniqueId.generate().value).toMatch(UUID);
  });

  it("gera ids diferentes a cada chamada", () => {
    expect(UniqueId.generate().equals(UniqueId.generate())).toBe(false);
  });

  it("subclasses geram instâncias da própria subclasse", () => {
    const id: OrderId = OrderId.generate();

    expect(id).toBeInstanceOf(OrderId);
  });
});

describe("UniqueId.from", () => {
  it("aceita qualquer string não vazia (UUID, cuid, id de provedor externo)", () => {
    expect(UniqueId.from("user_2abc").unwrap().value).toBe("user_2abc");
  });

  it("remove espaços nas pontas", () => {
    expect(UniqueId.from("  abc  ").unwrap().value).toBe("abc");
  });

  it.each([[""], ["   "]])("rejeita %p com INVALID_ID", (raw) => {
    const result = UniqueId.from(raw);

    expect(result.isFail() && result.error.issues).toEqual([
      { field: "id", code: "INVALID_ID", message: "id must not be empty" },
    ]);
  });

  it("subclasses reidratam instâncias da própria subclasse", () => {
    const id: OrderId = OrderId.from("o-1").unwrap();

    expect(id).toBeInstanceOf(OrderId);
  });
});

describe("ids tipados", () => {
  it("ids de tipos diferentes com o mesmo valor não são iguais", () => {
    const order = OrderId.from("1").unwrap();
    const customer = CustomerId.from("1").unwrap();

    expect(order.equals(customer)).toBe(false);
    expect(order.equals(OrderId.from("1").unwrap())).toBe(true);
  });

  it("o compilador impede misturar tipos de id", () => {
    const takesOrderId = (id: OrderId) => id.value;

    // @ts-expect-error CustomerId não é OrderId
    expect(takesOrderId(CustomerId.generate())).toBeString();
  });
});

describe("UniqueId.useGenerator", () => {
  let restore: (() => void) | undefined;
  afterEach(() => restore?.());

  it("troca o gerador padrão e devolve uma função que restaura o anterior", () => {
    let n = 0;
    restore = UniqueId.useGenerator({ generate: () => `id-${++n}` });

    expect(UniqueId.generate().value).toBe("id-1");
    expect(OrderId.generate().value).toBe("id-2");

    restore();
    restore = undefined;
    expect(UniqueId.generate().value).toMatch(UUID);
  });
});
