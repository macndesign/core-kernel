import type { Entity } from "../../domain/entity.js";
import type { UniqueId } from "../../domain/unique-id.js";

type AnyEntity = Entity<object, UniqueId>;

/** Tipo do id da entidade (ex.: `OrderId`). */
export type EntityId<T extends AnyEntity> = T["id"];

// Contratos segregados (ISP): cada use case depende só do que usa.
// Repositórios cuidam de escrita + `findById`; demais consultas ficam em *queries* que
// devolvem DTOs. Falhas de infraestrutura são lançadas (o use case as converte em
// `UnexpectedError`); "não encontrado" é `null`, não erro.

export interface CreateRepository<T extends AnyEntity> {
  create(entity: T): Promise<void>;
}

export interface UpdateRepository<T extends AnyEntity> {
  update(entity: T): Promise<void>;
}

export interface DeleteRepository<T extends AnyEntity> {
  delete(id: EntityId<T>): Promise<void>;
}

export interface FindByIdRepository<T extends AnyEntity> {
  findById(id: EntityId<T>): Promise<T | null>;
}

export interface CrudRepository<T extends AnyEntity>
  extends CreateRepository<T>,
    UpdateRepository<T>,
    DeleteRepository<T>,
    FindByIdRepository<T> {}
