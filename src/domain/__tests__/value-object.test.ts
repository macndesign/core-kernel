import { describe, expect, it } from "bun:test";
import { isValueObject, ValueObject } from "../index.js";

class Code extends ValueObject<string> {
  static of(value: string) {
    return new Code(value);
  }
}

class Label extends ValueObject<string> {
  static of(value: string) {
    return new Label(value);
  }
}

interface AddressProps {
  street: string;
  lines: string[];
  geo: { lat: number; lng: number };
  code?: Code;
  since?: Date;
}

class Address extends ValueObject<AddressProps> {
  static of(props: AddressProps) {
    return new Address(props);
  }

  get street() {
    return this.value.street;
  }
}

const props = (): AddressProps => ({
  street: "Rua A",
  lines: ["apto 1"],
  geo: { lat: 1, lng: 2 },
});

describe("ValueObject — imutabilidade", () => {
  it("congela o valor em profundidade e impede reatribuir value", () => {
    const address = Address.of(props());

    expect(() => {
      (address as { value: unknown }).value = props();
    }).toThrow(TypeError);
    expect(Object.isFrozen(address.value)).toBe(true);
    expect(Object.isFrozen(address.value.lines)).toBe(true);
    expect(Object.isFrozen(address.value.geo)).toBe(true);
    expect(() => {
      (address.value.geo as { lat: number }).lat = 9;
    }).toThrow(TypeError);
  });

  it("não congela nem compartilha o objeto recebido", () => {
    const input = props();
    const address = Address.of(input);
    input.lines.push("mutated");

    expect(Object.isFrozen(input)).toBe(false);
    expect(address.value.lines).toEqual(["apto 1"]);
  });

  it("copia Date para que o original não altere o VO", () => {
    const since = new Date("2026-01-01T00:00:00Z");
    const address = Address.of({ ...props(), since });
    since.setFullYear(2000);

    expect(address.value.since?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("guarda instâncias de outras classes sem copiar", () => {
    class Point {
      constructor(readonly x: number) {}
    }
    class Holder extends ValueObject<{ point: Point }> {
      static of(point: Point) {
        return new Holder({ point });
      }
    }
    const point = new Point(1);
    const holder = Holder.of(point);

    expect(holder.value.point).toBe(point);
    expect(holder.equals(Holder.of(point))).toBe(true); // mesma referência
    expect(holder.equals(Holder.of(new Point(1)))).toBe(false); // classes comparam por referência
  });

  it("preserva VOs aninhados como instâncias", () => {
    const code = Code.of("X1");
    const address = Address.of({ ...props(), code });

    expect(address.value.code).toBe(code);
  });

  it("permite campos declarados em subclasses (ex.: brand de tipo)", () => {
    class Branded extends ValueObject<string> {
      private readonly kind = "branded";
      static of(value: string) {
        return new Branded(value);
      }
      describe() {
        return `${this.kind}:${this.value}`;
      }
    }

    expect(Branded.of("x").describe()).toBe("branded:x");
  });

  it("expõe getters derivados do valor", () => {
    expect(Address.of(props()).street).toBe("Rua A");
  });
});

describe("ValueObject — igualdade", () => {
  it("VOs primitivos são iguais pelo valor", () => {
    expect(Code.of("a").equals(Code.of("a"))).toBe(true);
    expect(Code.of("a").equals(Code.of("b"))).toBe(false);
  });

  it("VOs compostos usam igualdade estrutural profunda", () => {
    expect(Address.of(props()).equals(Address.of(props()))).toBe(true);
    expect(Address.of(props()).equals(Address.of({ ...props(), lines: ["apto 2"] }))).toBe(false);
    expect(Address.of(props()).equals(Address.of({ ...props(), lines: [] }))).toBe(false);
    expect(Address.of(props()).equals(Address.of({ ...props(), geo: { lat: 1, lng: 3 } }))).toBe(
      false,
    );
  });

  it("compara Dates pelo instante e VOs aninhados por equals", () => {
    const a = Address.of({ ...props(), since: new Date(0), code: Code.of("X") });
    const b = Address.of({ ...props(), since: new Date(0), code: Code.of("X") });
    const c = Address.of({ ...props(), since: new Date(1), code: Code.of("X") });
    const d = Address.of({ ...props(), since: new Date(0), code: Code.of("Y") });

    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.equals(d)).toBe(false);
  });

  it("propriedade opcional ausente difere de presente", () => {
    expect(Address.of(props()).equals(Address.of({ ...props(), code: Code.of("X") }))).toBe(false);
  });

  it("VOs de classes diferentes nunca são iguais", () => {
    expect(Code.of("a").equals(Label.of("a"))).toBe(false);
  });

  it("trata NaN como igual a NaN", () => {
    class Amount extends ValueObject<number> {
      static of(value: number) {
        return new Amount(value);
      }
    }

    expect(Amount.of(Number.NaN).equals(Amount.of(Number.NaN))).toBe(true);
  });

  it("é falso para null, undefined e não-VOs", () => {
    expect(Code.of("a").equals(null)).toBe(false);
    expect(Code.of("a").equals(undefined)).toBe(false);
    expect(Code.of("a").equals({ value: "a" } as unknown as Code)).toBe(false);
  });
});

describe("ValueObject — serialização", () => {
  it("toJSON devolve o valor", () => {
    expect(JSON.stringify({ code: Code.of("a") })).toBe('{"code":"a"}');
    expect(JSON.parse(JSON.stringify(Address.of(props())))).toEqual(props());
  });

  it("toString devolve o valor em texto", () => {
    expect(Code.of("a").toString()).toBe("a");
    expect(Address.of(props()).toString()).toBe(JSON.stringify(props()));
  });
});

describe("isValueObject", () => {
  it("reconhece VOs pelo brand", () => {
    expect(isValueObject(Code.of("a"))).toBe(true);
    expect(isValueObject({ value: "a" })).toBe(false);
    expect(isValueObject(null)).toBe(false);
  });
});
