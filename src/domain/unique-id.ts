import type { ValidationError } from "../errors/validation-error.js";
import { Guard } from "../guard/guard.js";
import type { Result } from "../result/result.js";
import { ValueObject } from "./value-object.js";

// `crypto` é global no Node ≥ 20, Bun, navegadores e Deno. Declarado aqui porque o build
// usa só `lib: ES2022` (sem DOM nem @types/node), para manter a lib agnóstica de runtime.
declare const crypto: { randomUUID(): string };

/** Fonte de ids novos. Ver `UniqueId.useGenerator`. */
export interface IdGenerator {
  generate(): string;
}

const defaultGenerator: IdGenerator = { generate: () => crypto.randomUUID() };
let generator: IdGenerator = defaultGenerator;

/** Referência à classe (ou subclasse) de id, aceitando construtor `protected`. */
type IdClass<I extends UniqueId> = { prototype: I };

const construct = <I extends UniqueId>(cls: IdClass<I>, value: string): I =>
  Reflect.construct(cls as unknown as new (value: string) => I, [value]);

/**
 * Identidade de entidades. O valor é uma string não vazia em qualquer formato (UUID, cuid,
 * id de provedor externo), para permitir reaproveitar ids de fora do sistema.
 *
 * Para ids tipados que o compilador não deixa misturar, crie subclasses com um brand:
 *
 * ```ts
 * class OrderId extends UniqueId {
 *   declare private readonly __brand: "OrderId";
 * }
 * OrderId.generate(); // OrderId
 * ```
 */
export class UniqueId extends ValueObject<string> {
  protected constructor(value: string) {
    super(value);
  }

  /** Gera um id novo com o gerador atual (padrão: `crypto.randomUUID()`, UUID v4). */
  static generate<I extends UniqueId>(this: IdClass<I>): I {
    // biome-ignore lint/complexity/noThisInStatic: `this` é a subclasse chamada (OrderId.generate() → OrderId).
    return construct(this, generator.generate());
  }

  /** Reidrata um id existente (banco, request, provedor externo). */
  static from<I extends UniqueId>(this: IdClass<I>, raw: string): Result<I, ValidationError> {
    const value = raw.trim();
    return Guard.notEmpty(value, { field: "id", code: "INVALID_ID" }).map(() =>
      // biome-ignore lint/complexity/noThisInStatic: `this` é a subclasse chamada (OrderId.from() → OrderId).
      construct(this, value),
    );
  }

  /**
   * Troca o gerador global (ex.: UUID v7, ids sequenciais em testes, ou em runtimes sem
   * `crypto.randomUUID`, como React Native). Devolve uma função que restaura o anterior.
   */
  static useGenerator(next: IdGenerator): () => void {
    const previous = generator;
    generator = next;
    return () => {
      generator = previous;
    };
  }
}
