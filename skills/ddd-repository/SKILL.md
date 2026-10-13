---
name: ddd-repository
description: Definir ports de repositório e implementar adapters de persistência com o core-kernel. Usar quando o pedido envolver "repositório", "repository", arquivos *.repository.ts, CrudRepository/FindByIdRepository, persistência de agregados, mapper toDomain/fromDomain (Mapper), implementação com ORM (Prisma, Drizzle, TypeORM...) ou SQL, repositório em memória para testes, ou métodos de busca específicos do domínio.
---

# Repository (core-kernel)

## Overview

Repositório é a **port** (interface no core) pela qual use cases salvam e recuperam agregados
inteiros. A implementação (adapter) fica na infraestrutura e converte entre o agregado e o
formato do banco com um `Mapper`, usando `restore` para reidratar.

## Guidelines

- Ler `references/repository-pattern.md` antes de criar ports ou adapters.
- Port no core: compor as interfaces segregadas do core-kernel (`CreateRepository`,
  `UpdateRepository`, `DeleteRepository`, `FindByIdRepository` ou `CrudRepository`) e só os
  métodos que algum use case usa.
- Contrato: escrita devolve `Promise<void>`; `findById` devolve `Promise<T | null>`; **falha de
  infraestrutura lança** (o `BaseUseCase` converte em `UnexpectedError`). Não devolver `Result`.
- `findById`/`delete` recebem o **id tipado** (`OrderId`), não `string`.
- Repositório é para escrita + leitura do agregado. Listagens e telas → port de query com DTOs
  (skill `ddd-query-cqrs`).
- Métodos extras só quando um use case real precisa, com nome do domínio
  (`findActiveByEmployee`). Devolvem agregados — ou um primitivo (`countActiveByMember`,
  `existsByEmail`) quando um **comando** precisa dele para decidir uma regra (limite,
  unicidade). Dados para mostrar em tela vão para uma query.
- Adapter: `Mapper<Agregado, Linha>` com `toDomain` (usa `restore`) e `fromDomain`; tipos do
  ORM nunca atravessam a port.
- Operação que grava várias tabelas do mesmo agregado = uma transação no adapter.
- Para testes, estender `InMemoryRepository` de `core-kernel/testing`.

## Workflow

1. Listar os métodos que os use cases do agregado precisam.
2. Declarar a port no core compondo as interfaces do core-kernel.
3. Implementar o mapper e testar o caminho domínio → linha → domínio.
4. Implementar o adapter com o ORM/driver do projeto.
5. Criar o dublê em memória estendendo `InMemoryRepository` (com os métodos extras).

## References

`references/repository-pattern.md`: port, mapper, adapter (com um client de banco genérico),
dublê em memória, testes e armadilhas.
