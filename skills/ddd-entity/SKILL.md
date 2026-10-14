---
name: ddd-entity
description: Criar, revisar ou orientar Entidades de domínio com o core-kernel. Usar quando o pedido envolver "entidade", "entity", arquivos *.entity.ts, ids tipados (UniqueId), invariantes, métodos de domínio que mudam estado, create/restore, reidratação a partir do banco, campos de auditoria (Auditable) ou herança entre tipos de entidade.
---

# Entity (core-kernel)

## Overview

Entidade é um objeto com **identidade**: continua a mesma ao longo do tempo mesmo mudando de
estado. No core-kernel ela estende `Entity<Props, Id>` (ou `AggregateRoot`, quando é raiz de
agregado — ver skill `ddd-aggregate-events`), tem id tipado e muda de estado só por métodos de
domínio que devolvem `Result`.

## Guidelines

- Ler `references/entity-pattern.md` antes de criar ou alterar entidades.
- Criar um id tipado por entidade: `class OrderId extends UniqueId { declare private readonly __brand: "OrderId" }`.
- Construtor `private` (ou `protected` se for base de herança). Duas fábricas estáticas:
  - `create(input)`: valida invariantes (VOs + `Guard`), gera o id, devolve `Result`;
  - `restore(props, id)`: reidrata do banco **sem validar** — usada só por mappers/repositórios.
- `props` são `protected`: expor getters para o que o mundo externo precisa ler.
- Mudança de estado só por **métodos de domínio com nome do negócio** (`confirm`, `cancel`,
  `reassign`), que devolvem `Result<void, ...>`. Nunca setters. Valide com retorno antecipado e
  altere depois; não altere estado dentro de `result.map(...)`.
- Atributos com regras próprias viram VOs dentro das props (`Email`, `Money`, `DateRange`).
- Referenciar outras entidades/agregados **pelo id**, não pela instância.
- Datas de negócio vêm por parâmetro (`now: Date`) a partir do `Clock` do use case; não chamar
  `new Date()` sem argumentos (hora atual) no domínio. Derivar datas de `now` é normal
  (`new Date(now.getTime() + 14 * DAY_MS)`). Getters de `Date` devolvem cópia.
- Extrair validação compartilhada entre `create` e um método de atualização para uma função
  privada estática, em vez de duplicar regras.

## Workflow

1. Definir o id tipado, as props (com VOs) e as invariantes.
2. Implementar `create` (validação acumulando issues) e `restore`.
3. Implementar os métodos de domínio de cada transição de estado.
4. Decidir se é raiz de agregado (eventos, fronteira de consistência) → `AggregateRoot`.
5. Testar: criação válida/inválida (por `code`), cada transição permitida e proibida,
   igualdade por id.

## References

`references/entity-pattern.md`: template completo, atualização, herança, testes e armadilhas.
