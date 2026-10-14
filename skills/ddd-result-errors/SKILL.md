---
name: ddd-result-errors
description: Tratar falhas com Result e erros tipados do core-kernel. Usar quando o código precisar devolver, propagar, combinar ou converter falhas (Result.ok/fail, isFail, combine, try/tryAsync), escolher entre ValidationError, NotFoundError, ConflictError, ForbiddenError e UnexpectedError, definir códigos de erro, ou mapear erros para HTTP/CLI/UI num adapter.
---

# Result e erros (core-kernel)

## Overview

No core-kernel, regra de negócio **não lança exceção**: toda operação que pode falhar de forma
esperada devolve `Result<T, E>`, com o tipo do erro na assinatura. Exceções ficam para bugs,
uso indevido da API e falhas de infraestrutura (que o `BaseUseCase` converte em
`UnexpectedError`).

## Guidelines

- Ler `references/result-errors-pattern.md` antes de escrever código com `Result`.
- Devolver `Result.fail(new XxxError(message, { code }))` com `code` estável em
  `UPPER_SNAKE_CASE` e específico do domínio (`ORDER_NOT_FOUND`, não só `NOT_FOUND`).
- Escolher o erro pelo **significado**, não pelo status HTTP:
  `ValidationError` (entrada inválida), `NotFoundError` (não existe), `ConflictError` (estado
  não permite), `ForbiddenError` (sem permissão), `UnexpectedError` (infra/bug).
- Propagar com retorno antecipado: `if (r.isFail()) return r;` — funciona mesmo quando o tipo
  de sucesso muda. Nunca reconstruir o erro (`Result.fail(r.error)`) sem motivo.
- Ler `.value`/`.error` só depois do narrowing (`isOk()`, `isFail()` ou `ok`).
- `map`/`flatMap` são para **transformar valores**. Efeito colateral (alterar estado, gravar)
  vai depois de um retorno antecipado, não dentro de um callback de `map`.
- Validar vários campos com `Result.combine([...])` ou `Guard.all([...])` para devolver todas
  as issues de uma vez.
- Envolver código de terceiros que lança com `Result.try`/`Result.tryAsync`.
- `unwrap()` só em testes, scripts e bordas da aplicação — nunca no domínio.
- Mapear `error.kind` para HTTP/CLI/UI **no adapter**, nunca no domínio.

## Workflow

1. Listar as falhas esperadas da operação e escolher o tipo de erro de cada uma.
2. Declarar a união de erros no tipo de retorno (`Result<Order, ValidationError | NotFoundError>`).
3. Implementar com retorno antecipado em cada falha.
4. Testar cada falha verificando `code` (ou o `code` de uma issue de validação).

## References

`references/result-errors-pattern.md`: API completa, padrões de propagação, combine,
conversão de exceções, mapeamento para HTTP e armadilhas.
