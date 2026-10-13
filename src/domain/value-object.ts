const VALUE_OBJECT_BRAND = Symbol.for("core-kernel/ValueObject");

/**
 * Objeto definido pelo seu valor, não por identidade. Imutável e comparado por igualdade
 * estrutural.
 *
 * O construtor só guarda o valor: a validação fica em uma fábrica estática da subclasse
 * (`static create(raw): Result<Vo, ValidationError>`), porque um construtor não pode
 * devolver `Result`. Mantenha o construtor `protected`/`private`.
 *
 * O valor é copiado e congelado em profundidade (objetos simples, arrays e `Date`). Instâncias
 * de outras classes (exceto VOs, que já são imutáveis) são guardadas como recebidas; evite-as.
 */
export abstract class ValueObject<T> {
  declare readonly value: T;

  protected constructor(value: T) {
    Object.defineProperty(this, "value", {
      value: freezeCopy(value),
      enumerable: true,
      writable: false,
      configurable: false,
    });
  }

  /** Igual quando é da mesma classe e tem o mesmo valor (comparação profunda). */
  equals(other: ValueObject<T> | null | undefined): boolean {
    if (!isValueObject(other) || other.constructor !== this.constructor) return false;
    return deepEqual(this.value, other.value);
  }

  toJSON(): T {
    return this.value;
  }

  toString(): string {
    return typeof this.value === "object" && this.value !== null
      ? JSON.stringify(this.value)
      : String(this.value);
  }
}

Object.defineProperty(ValueObject.prototype, VALUE_OBJECT_BRAND, { value: true });

/** Checa se um valor é um `ValueObject` pelo brand (funciona entre cópias ESM/CJS da lib). */
export function isValueObject(value: unknown): value is ValueObject<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[VALUE_OBJECT_BRAND] === true
  );
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function freezeCopy<T>(value: T): T {
  if (typeof value !== "object" || value === null || isValueObject(value)) return value;
  if (value instanceof Date) return Object.freeze(new Date(value.getTime())) as T;
  if (Array.isArray(value)) return Object.freeze(value.map(freezeCopy)) as T;
  if (isPlainObject(value)) {
    const copy: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) copy[key] = freezeCopy(entry);
    return Object.freeze(copy) as T;
  }
  return value;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (isValueObject(a)) return a.equals(b as ValueObject<unknown>);
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => deepEqual(item, b[index]))
    );
  }
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]))
  );
}
