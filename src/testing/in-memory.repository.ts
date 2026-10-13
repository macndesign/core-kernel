import type { CrudRepository, EntityId } from "../application/ports/repository.js";
import type { Entity } from "../domain/entity.js";
import type { UniqueId } from "../domain/unique-id.js";

/**
 * Repositório em memória para testes de use case. Estenda para adicionar as queries
 * específicas do seu port usando `find`/`filter`:
 *
 * ```ts
 * class InMemoryOrderRepository extends InMemoryRepository<Order> implements OrderRepository {
 *   async findByCustomer(id: CustomerId) {
 *     return this.filter((order) => order.customerId.equals(id));
 *   }
 * }
 * ```
 *
 * Guarda as próprias instâncias (como um identity map): alterar a entidade depois de salvá-la
 * altera o que está "no banco".
 */
export class InMemoryRepository<T extends Entity<object, UniqueId>> implements CrudRepository<T> {
  protected readonly store = new Map<string, T>();
  #pendingFailure: { error: unknown } | undefined;

  constructor(initial: Iterable<T> = []) {
    this.seed(...initial);
  }

  async create(entity: T): Promise<void> {
    this.throwPendingFailure();
    if (this.store.has(entity.id.value)) throw new Error(`${entity} already exists`);
    this.store.set(entity.id.value, entity);
  }

  async update(entity: T): Promise<void> {
    this.throwPendingFailure();
    if (!this.store.has(entity.id.value)) throw new Error(`${entity} does not exist`);
    this.store.set(entity.id.value, entity);
  }

  async delete(id: EntityId<T>): Promise<void> {
    this.throwPendingFailure();
    this.store.delete(id.value);
  }

  async findById(id: EntityId<T>): Promise<T | null> {
    this.throwPendingFailure();
    return this.store.get(id.value) ?? null;
  }

  /** Snapshot das entidades guardadas, na ordem de inserção. */
  get items(): T[] {
    return [...this.store.values()];
  }

  get size(): number {
    return this.store.size;
  }

  /** Insere dados de teste diretamente (sem as checagens do `create`). */
  seed(...entities: T[]): void {
    for (const entity of entities) this.store.set(entity.id.value, entity);
  }

  clear(): void {
    this.store.clear();
  }

  /** Faz a próxima operação lançar `error`, simulando falha de infraestrutura. */
  failNext(error: unknown): void {
    this.#pendingFailure = { error };
  }

  protected find(predicate: (entity: T) => boolean): T | null {
    this.throwPendingFailure();
    return this.items.find(predicate) ?? null;
  }

  protected filter(predicate: (entity: T) => boolean): T[] {
    this.throwPendingFailure();
    return this.items.filter(predicate);
  }

  /** Chame no início de queries próprias que não usem `find`/`filter`. */
  protected throwPendingFailure(): void {
    const pending = this.#pendingFailure;
    if (!pending) return;
    this.#pendingFailure = undefined;
    throw pending.error;
  }
}
