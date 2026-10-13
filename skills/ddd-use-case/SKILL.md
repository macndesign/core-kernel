---
name: ddd-use-case
description: Criar, revisar ou orientar casos de uso (application services) com o core-kernel. Usar quando o pedido envolver "caso de uso", "use case", arquivos *.usecase.ts, BaseUseCase, orquestração de entidades, repositórios, queries, Clock e publicação de eventos, entrada/saída de um fluxo da aplicação, ou testes de use case.
---

# Use Case (core-kernel)

## Overview

Use case orquestra **uma intenção do usuário** (confirmar pedido, trocar turno): converte a
entrada em VOs, carrega agregados pelas ports, delega as regras ao domínio, persiste e publica
eventos. Não contém regra de negócio nem detalhe de infraestrutura.

## Guidelines

- Ler `references/use-case-pattern.md` antes de criar ou alterar use cases.
- Estender `BaseUseCase<Input, Output, Erros>` e implementar `protected handle(input)`. O
  `execute` já converte exceções de infraestrutura em `UnexpectedError` e nunca rejeita.
- Declarar a **união de erros esperados** no terceiro parâmetro de tipo.
- Receber dependências pelo construtor, tipadas pela **menor port necessária**
  (`FindByIdRepository<Order> & UpdateRepository<Order>` ou `Pick<OrderRepository, "create">`).
- Entrada e saída são DTOs com primitivos (`{ orderId: string }`), não entidades.
- Converter ids e campos com as fábricas (`OrderId.from`, `Email.create`) e propagar falhas com
  `if (r.isFail()) return r;`.
- `findById` devolve `null` → o use case decide o `NotFoundError` com `code` específico.
- Regra de negócio fica na entidade/VO/serviço de domínio; o use case só chama.
- Hora atual vem do `Clock` injetado e é passada ao domínio.
- Ordem: carregar → regra de domínio → persistir → `publish(pullDomainEvents())` → devolver DTO.
- Leitura para tela usa uma port de query (skill `ddd-query-cqrs`), não o repositório.

## Workflow

1. Definir `Input`, `Output` e a união de erros.
2. Listar as ports necessárias (só os métodos usados).
3. Implementar `handle` com retorno antecipado em cada falha.
4. Testar com `createSut()` e os dublês de `core-kernel/testing`: sucesso, cada falha por
   `code`, falha de infraestrutura (`failNext`) e efeitos colaterais (persistido, eventos).

## References

`references/use-case-pattern.md`: templates de comando (criar e alterar), leitura, testes e
armadilhas.
