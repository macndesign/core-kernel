import { describe, expect, it } from "bun:test";
import { NotFoundError, UnexpectedError, ValidationError } from "../../errors/index.js";
import { Result } from "../index.js";

const invalid = (field: string) => new ValidationError({ field, code: "INVALID", message: field });

describe("Result.ok / Result.fail", () => {
  it("ok guarda o valor", () => {
    const result = Result.ok(42);

    expect(result.isOk()).toBe(true);
    expect(result.isFail()).toBe(false);
    if (result.isOk()) expect(result.value).toBe(42);
  });

  it("ok sem argumento representa void", () => {
    const result: Result<void> = Result.ok();

    expect(result.isOk()).toBe(true);
  });

  it("fail guarda o erro", () => {
    const error = new NotFoundError("x");
    const result = Result.fail(error);

    expect(result.isFail()).toBe(true);
    expect(result.isOk()).toBe(false);
    if (result.isFail()) expect(result.error).toBe(error);
  });

  it("é imutável", () => {
    expect(Object.isFrozen(Result.ok(1))).toBe(true);
    expect(Object.isFrozen(Result.fail(new NotFoundError("x")))).toBe(true);
  });

  it("só expõe value/error depois do narrowing", () => {
    const result = Result.ok(1) as Result<number, NotFoundError>;

    // @ts-expect-error value não existe em Result sem narrowing
    result.value;
    // @ts-expect-error error não existe em Result sem narrowing
    result.error;
    if (result.isFail()) {
      // @ts-expect-error Fail não tem value
      result.value;
    }
    expect(result.isOk()).toBe(true);
  });

  it("fail só aceita AppError", () => {
    // @ts-expect-error string não é AppError
    expect(Result.fail("x").isFail()).toBe(true);
  });
});

describe("propagação de falha com retorno antecipado", () => {
  const parse = (raw: string): Result<number, ValidationError> =>
    Number.isNaN(Number(raw)) ? Result.fail(invalid("raw")) : Result.ok(Number(raw));

  it("isFail() permite devolver a falha com outro tipo de sucesso", () => {
    const double = (raw: string): Result<string, ValidationError | NotFoundError> => {
      const parsed = parse(raw);
      if (parsed.isFail()) return parsed; // Fail<ValidationError> serve como Result<string, ...>
      return Result.ok(String(parsed.value * 2));
    };

    expect(double("21").unwrap()).toBe("42");
    expect(double("x").isFail()).toBe(true);
  });

  it("o discriminante ok também propaga", () => {
    const toVoid = (raw: string): Result<void, ValidationError> => {
      const parsed = parse(raw);
      if (!parsed.ok) return parsed;
      return Result.ok();
    };

    expect(toVoid("x").isFail()).toBe(true);
  });

  it("não permite propagar um erro fora da união declarada", () => {
    const strict = (): Result<void, ValidationError> => {
      const missing: Result<number, NotFoundError> = Result.fail(new NotFoundError("x"));
      // @ts-expect-error NotFoundError não faz parte de ValidationError
      if (missing.isFail()) return missing;
      return Result.ok();
    };

    expect(strict().isFail()).toBe(true);
  });
});

describe("map / flatMap / mapError", () => {
  it("map transforma o valor de um ok", () => {
    expect(
      Result.ok(2)
        .map((n) => n * 10)
        .unwrap(),
    ).toBe(20);
  });

  it("map não executa em fail", () => {
    let called = false;
    const result = Result.fail(new NotFoundError("x")).map(() => {
      called = true;
      return 1;
    });

    expect(called).toBe(false);
    expect(result.isFail()).toBe(true);
  });

  it("flatMap encadeia operações que retornam Result", () => {
    const half = (n: number): Result<number, ValidationError> =>
      n % 2 === 0 ? Result.ok(n / 2) : Result.fail(invalid("odd"));

    expect(Result.ok(8).flatMap(half).flatMap(half).unwrap()).toBe(2);
    expect(Result.ok(6).flatMap(half).flatMap(half).isFail()).toBe(true);
  });

  it("flatMap acumula os tipos de erro", () => {
    const step1 = (): Result<number, NotFoundError> => Result.ok(1);
    const step2 = (n: number): Result<string, ValidationError> => Result.ok(String(n));

    const result: Result<string, NotFoundError | ValidationError> = step1().flatMap(step2);
    expect(result.unwrap()).toBe("1");
  });

  it("flatMap não executa em fail", () => {
    const error = new NotFoundError("x");
    const result = Result.fail(error).flatMap(() => Result.ok(1));

    expect(result.isFail() && result.error).toBe(error);
  });

  it("mapError transforma o erro de um fail", () => {
    const result = Result.fail(new NotFoundError("Order")).mapError(
      (e) => new UnexpectedError(`wrapped: ${e.message}`),
    );

    expect(result.isFail() && result.error.message).toBe("wrapped: Order");
  });

  it("mapError não executa em ok", () => {
    expect(
      Result.ok(1)
        .mapError(() => new UnexpectedError("x"))
        .unwrap(),
    ).toBe(1);
  });
});

describe("match / unwrap / unwrapOr", () => {
  it("match chama o handler correspondente", () => {
    const handlers = {
      ok: (n: number) => `ok:${n}`,
      fail: (e: NotFoundError) => `fail:${e.code}`,
    };
    const ok: Result<number, NotFoundError> = Result.ok(1);
    const fail: Result<number, NotFoundError> = Result.fail(new NotFoundError("x"));

    expect(ok.match(handlers)).toBe("ok:1");
    expect(fail.match(handlers)).toBe("fail:NOT_FOUND");
  });

  it("unwrap lança o próprio AppError em fail", () => {
    const error = new NotFoundError("x");

    expect(() => Result.fail(error).unwrap()).toThrow(error);
  });

  it("unwrapOr devolve o fallback em fail", () => {
    expect(Result.fail(new NotFoundError("x")).unwrapOr(0)).toBe(0);
    expect(Result.ok(5).unwrapOr(0)).toBe(5);
  });
});

describe("Result.combine", () => {
  it("devolve uma tupla tipada quando todos são ok", () => {
    const result = Result.combine([Result.ok("a"), Result.ok(1), Result.ok(true)]);
    const [a, b, c]: [string, number, boolean] = result.unwrap();

    expect([a, b, c]).toEqual(["a", 1, true]);
  });

  it("aceita lista vazia", () => {
    expect(Result.combine([]).unwrap()).toEqual([]);
  });

  it("agrega as issues quando todas as falhas são de validação", () => {
    const result = Result.combine([
      Result.ok(1),
      Result.fail(invalid("a")),
      Result.fail(invalid("b")),
    ]);

    expect(result.isFail()).toBe(true);
    if (result.isFail() && result.error.kind === "validation") {
      expect(result.error.issues.map((i) => i.field)).toEqual(["a", "b"]);
    }
  });

  it("preserva o erro original quando há uma única falha", () => {
    const error = invalid("only");
    const result = Result.combine([Result.ok(1), Result.fail(error)]);

    expect(result.isFail() && result.error).toBe(error);
  });

  it("devolve a primeira falha que não é de validação", () => {
    const notFound = new NotFoundError("x");
    const result = Result.combine([Result.fail(invalid("a")), Result.fail(notFound)]);

    expect(result.isFail() && result.error).toBe(notFound);
  });

  it("une os tipos de erro", () => {
    const a: Result<number, NotFoundError> = Result.ok(1);
    const b: Result<string, ValidationError> = Result.ok("x");
    const result: Result<[number, string], NotFoundError | ValidationError> = Result.combine([
      a,
      b,
    ]);

    expect(result.isOk()).toBe(true);
  });
});

describe("Result.try / Result.tryAsync", () => {
  it("try devolve ok com o retorno da função", () => {
    expect(Result.try(() => JSON.parse('{"a":1}')).unwrap()).toEqual({ a: 1 });
  });

  it("try converte exceção em UnexpectedError", () => {
    const result = Result.try(() => JSON.parse("{"));

    expect(result.isFail() && result.error.kind).toBe("unexpected");
    expect(result.isFail() && result.error.cause).toBeInstanceOf(SyntaxError);
  });

  it("try aceita um mapeador de erro", () => {
    const result = Result.try(
      () => {
        throw new Error("missing");
      },
      (e) => new NotFoundError((e as Error).message),
    );

    expect(result.isFail() && result.error.kind).toBe("not_found");
  });

  it("tryAsync devolve ok com o valor resolvido", async () => {
    expect((await Result.tryAsync(async () => 7)).unwrap()).toBe(7);
  });

  it("tryAsync converte rejeição em UnexpectedError", async () => {
    const result = await Result.tryAsync(async () => {
      throw new Error("timeout");
    });

    expect(result.isFail() && result.error.message).toBe("timeout");
  });

  it("tryAsync captura exceção síncrona da função", async () => {
    const result = await Result.tryAsync((): Promise<number> => {
      throw new Error("sync");
    });

    expect(result.isFail()).toBe(true);
  });

  it("tryAsync aceita um mapeador de erro", async () => {
    const result = await Result.tryAsync(
      () => Promise.reject(new Error("x")),
      () => new NotFoundError("mapped"),
    );

    expect(result.isFail() && result.error.message).toBe("mapped");
  });
});

describe("Result.isResult", () => {
  it("reconhece Results pelo brand", () => {
    expect(Result.isResult(Result.ok(1))).toBe(true);
    expect(Result.isResult(Result.fail(new NotFoundError("x")))).toBe(true);
    expect(Result.isResult({ ok: true, value: 1 })).toBe(false);
    expect(Result.isResult(null)).toBe(false);
  });
});
