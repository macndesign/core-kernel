---
name: ddd-aggregate-events
description: Modelar agregados e eventos de domínio com o core-kernel. Usar quando o pedido envolver "agregado", "aggregate root", fronteira de consistência, "evento de domínio", "domain event", createDomainEvent, pullDomainEvents, publicar eventos depois de salvar, DomainEventPublisher, outbox, ou reagir a algo que aconteceu no domínio.
---

# Agregados e eventos de domínio (core-kernel)

## Overview

Agregado é um grupo de objetos alterado como uma unidade, com uma **raiz** (`AggregateRoot`)
que é a única porta de entrada e garante as invariantes do grupo. Eventos de domínio registram
fatos relevantes (`order.confirmed`) emitidos pela raiz e publicados pelo use case **depois** de
persistir.

## Guidelines

- Ler `references/aggregate-events-pattern.md` antes de modelar.
- Estender `AggregateRoot<Props, Id, Events>`, onde `Events` é a **união tipada** dos eventos
  que o agregado emite (`DomainEvent<"order.confirmed", { ... }>`).
- Nome do evento no passado e com namespace: `order.placed`, `employee.deactivated`.
- Emitir com `this.addDomainEvent(createDomainEvent({ name, aggregateId, occurredAt: now, payload }))`
  **só depois** de a regra passar.
- Payload pequeno, com primitivos serializáveis (ids, valores), não entidades/VOs.
- O use case salva o agregado e então publica: `await events.publish(aggregate.pullDomainEvents())`.
- `restore` não emite eventos.
- Um use case altera **um** agregado por transação. Efeitos em outros agregados vão por
  evento (consistência eventual) ou por um use case que orquestra explicitamente.
- Agregados se referenciam por id, nunca por instância.
- Manter agregados pequenos: só o que precisa ser consistente na mesma transação.

## Workflow

1. Identificar a invariante que exige consistência imediata → define a fronteira.
2. Escolher a raiz e o que fica dentro (entidades filhas, VOs).
3. Declarar os eventos como tipos e a união do agregado.
4. Emitir eventos nos métodos de domínio após validar.
5. No use case: persistir, depois `publish(pullDomainEvents())`.
6. Testar: evento emitido no sucesso, nenhum evento na falha, payload correto.

## References

`references/aggregate-events-pattern.md`: template, entidade filha, publicação, consumidores de
eventos, testes e armadilhas.
