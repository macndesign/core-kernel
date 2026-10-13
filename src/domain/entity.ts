import type { UniqueId } from "./unique-id.js";

const ENTITY_BRAND = Symbol.for("core-kernel/Entity");

/**
 * Objeto com identidade: duas entidades são a mesma quando têm a mesma classe e o mesmo id,
 * independentemente do estado.
 *
 * Convenção para subclasses (construtor `private`):
 * - `static create(input): Result<X, ...>` valida invariantes, gera o id e emite eventos;
 * - `static restore(props, id): X` reidrata do repositório, sem validar nem emitir eventos;
 * - mudanças de estado só por métodos de domínio que devolvem `Result` (nunca setters).
 */
export abstract class Entity<P extends object, Id extends UniqueId = UniqueId> {
  readonly id: Id;
  protected readonly props: P;

  protected constructor(props: P, id: Id) {
    this.id = id;
    this.props = { ...props };
  }

  equals(other: Entity<P, Id> | null | undefined): boolean {
    if (!isEntity(other) || other.constructor !== this.constructor) return false;
    return this === other || this.id.equals(other.id);
  }

  toString(): string {
    return `${this.constructor.name}(${this.id.value})`;
  }
}

Object.defineProperty(Entity.prototype, ENTITY_BRAND, { value: true });

/** Checa se um valor é uma `Entity` pelo brand (funciona entre cópias ESM/CJS da lib). */
export function isEntity(value: unknown): value is Entity<object, UniqueId> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[ENTITY_BRAND] === true
  );
}
