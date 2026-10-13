---
name: ddd-dto
description: Modelar DTOs de entrada, saída e leitura com o core-kernel. Usar quando o pedido envolver "DTO", tipos In/Out de casos de uso, payload de API, itens de lista e detalhes (ListItem/Details), filtros, DTOs paginados (PaginatedInputDTO, PaginatedResultDTO), conversão de entidade para DTO, ou contratos entre o core e o front/back.
---

# DTO (core-kernel)

## Overview

DTO é um tipo de dados **sem comportamento** que atravessa fronteiras: entrada de use case,
saída para a API/UI, projeção de leitura. Usa só primitivos e outros DTOs — nunca entidades,
VOs ou tipos do ORM.

## Guidelines

- Ler `references/dto-pattern.md` antes de criar DTOs.
- Três tipos, com nomes que revelam a intenção:
  - **Input** de use case: `ConfirmOrderInput` (primitivos, como chegam da borda);
  - **Output** de use case: `PlaceOrderOutput` (`{ orderId: string }`);
  - **Leitura (query)**: `OrderListItemDTO`, `OrderDetailsDTO` — forma pensada para quem consome.
- Tipos In/Out só são usados no use case (e na borda que o chama).
- `interface`/`type` com primitivos (`string`, `number`, `boolean`, datas como ISO `string`),
  arrays e outros DTOs. Nada de classes.
- Não estender a entidade nem as `Props`; se reaproveitar, derive com `Omit`/`Pick` das props e
  troque VOs por primitivos.
- Paginação: estender `PaginatedInputDTO` (`page`, `pageSize`) e devolver
  `PaginatedResultDTO<Item>` (`{ data, meta }`).
- Conversão entidade → DTO numa função explícita (`toOrderDetailsDTO`), não em `toJSON`.
- Formatação para exibição (moeda, data) pode ir no DTO de leitura, feita na query/conversão.

## Workflow

1. Identificar o tipo (input, output, leitura) e quem consome.
2. Definir o tipo com primitivos e nomes de intenção.
3. Escrever a função de conversão (para output/leitura).
4. Testar a conversão com uma entidade real.

## References

`references/dto-pattern.md`: exemplos de cada tipo, paginação, conversão e armadilhas.
