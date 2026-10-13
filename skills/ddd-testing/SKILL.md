---
name: ddd-testing
description: Escrever testes de domínio e de casos de uso com core-kernel/testing. Usar quando o pedido envolver testes de entidade, VO, agregado ou use case, dublês (repositório em memória, relógio fixo, ids previsíveis, publicador de eventos), simular falha de banco, asserções sobre Result (assertOk/assertFail), TDD, ou createSut.
---

# Testes com core-kernel/testing

## Overview

O core é testado sem banco, rede ou mocks de framework: o domínio é puro e os use cases recebem
dublês prontos de `core-kernel/testing`. As asserções `assertOk`/`assertFail` fazem o
narrowing do `Result` e funcionam com qualquer test runner.

## Guidelines

- Ler `references/testing-pattern.md` antes de escrever os testes.
- Dublês:
  - `InMemoryRepository<T>` (`new InMemoryRepository([...entidades])`, `items`, `size`,
    `seed(...)`, `clear()`; estenda para queries próprias com `this.find`/`this.filter`;
    `failNext(error)` faz a **próxima** operação lançar — inclusive queries próprias que usam
    `find`/`filter`; se a query ler `this.store` direto, chame `this.throwPendingFailure()` antes);
  - `FixedClock` (`set`, `advance`);
  - `SequentialIdGenerator` (`install()` devolve a função de restauração; ids de eventos também
    consomem a sequência);
  - `InMemoryEventPublisher` (`published`, `namesOf()`).
- Asserções: `assertOk(result)`; `assertFail(result, "CODE")` — o code pode ser do erro ou de
  uma issue de validação. Verificar sempre pelo `code`, nunca pela `message`.
- Um `createSut()` por arquivo de use case monta o use case e os dublês.
- Cobrir em use cases: sucesso + efeitos (persistido, eventos), cada falha esperada por `code`,
  falha de infraestrutura (`failNext` → `"UNEXPECTED"`).
- Cobrir em entidades/VOs: criação válida (normalizada), cada invariante, cada transição
  permitida/proibida, eventos emitidos ou não.
- TDD: escrever o teste, ver falhar, implementar.
- `await` em asserções de promise (`await expect(p).rejects...`).

## Workflow

1. Listar os comportamentos (sucesso, cada falha, efeitos colaterais).
2. Montar `createSut()` com os dublês.
3. Escrever um teste por comportamento, verificando `code`s e efeitos.
4. Rodar e ver falhar antes de implementar (TDD).

## References

`references/testing-pattern.md`: exemplos de cada dublê, `createSut`, repositório com query
própria, ids previsíveis e armadilhas.
