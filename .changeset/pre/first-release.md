---
"core-kernel": minor
---

Primeira versão funcional da lib.

- `Result<T, E>` com erros tipados (`ValidationError`, `NotFoundError`, `ConflictError`, `ForbiddenError`, `UnexpectedError`), `combine` que agrega issues de validação, `try`/`tryAsync`, e propagação de falhas com `if (r.isFail()) return r;`.
- `Guard` com validações reutilizáveis e códigos de erro estáveis.
- `ValueObject`, `UniqueId` (ids tipados), `Entity`, `AggregateRoot` e eventos de domínio.
- `UseCase`/`BaseUseCase`, ports de repositório segregadas, `Clock`, `DomainEventPublisher`, `Mapper` e DTOs de paginação.
- `core-kernel/vo`: `Email`, `Text`, `Url`, `Money`, `DateRange`, `StrongPassword`.
- `core-kernel/vo/br`: `Cpf` e `Cnpj` (numérico e alfanumérico, IN RFB 2.229/2024).
- `core-kernel/testing`: `InMemoryRepository`, `FixedClock`, `SequentialIdGenerator`, `InMemoryEventPublisher`, `assertOk`/`assertFail`.
- 10 skills para assistentes de código e o CLI `core-kernel skills add|update|check|list`.
- `llms.txt` com o resumo da API para LLMs.
