---
name: ddd-query-cqrs
description: Implementar leituras no estilo CQRS com o core-kernel. Usar quando o pedido envolver listagens, telas de detalhe, busca com filtros, paginação, dashboards ou relatórios, "query", "consulta", arquivos *.query.ts / *.queries.ts, findDetailsById, validatePagination/toPaginatedResult, ou decidir entre repositório e query para uma leitura.
---

# Query / CQRS (core-kernel)

## Overview

Leituras para telas e APIs não passam pelo agregado: uma **port de query** devolve DTOs já no
formato do consumidor (com joins, filtros, paginação, agregações). O repositório fica para
escrita e para carregar o agregado que vai ser alterado.

## Guidelines

- Ler `references/query-cqrs-pattern.md` antes de criar queries.
- Decisão:
  - vai **alterar** estado → repositório + agregado;
  - só **mostra** dados → query + DTO.
- Port de query no core (`OrderQueries`), com métodos nomeados pela intenção:
  `list(input)`, `findDetailsById(id)` (o `findById` é do repositório), `summary(...)`.
- Saída sempre DTO (skill `ddd-dto`); lista paginada = `PaginatedResultDTO<Item>`.
- Detalhe inexistente → a query devolve `null`; o use case transforma em `NotFoundError`.
- Use case de leitura valida a entrada (`validatePagination(input, { maxPageSize })`, filtros)
  e delega; não carrega agregados para montar a resposta.
- A implementação da query pode usar SQL/ORM direto, views, cache — sem passar por entidades.
- Montar o envelope com `toPaginatedResult(data, total, input)`.

## Workflow

1. Confirmar que é leitura pura.
2. Definir input (filtros + `PaginatedInputDTO`) e o DTO de saída.
3. Declarar a port de query.
4. Criar o use case de leitura (validação + delegação).
5. Implementar o adapter e um dublê em memória para testes.
6. Testar: paginação, filtros, vazio, not found, entrada inválida.

## References

`references/query-cqrs-pattern.md`: port, use cases de lista e detalhe, adapter em memória,
testes e armadilhas.
