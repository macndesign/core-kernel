# core-kernel

## 0.2.0

### Minor Changes

- 3199cd9: Ajustes revelados pela migração do shift-swap (todos compatíveis com a 0.1):
  
  - VOs prontos (`Email`, `Text`, `Url`, `Money`, `DateRange`, `StrongPassword`, `Cpf`, `Cnpj`) aceitam `errors` para trocar o código e/ou a mensagem de cada issue, indexado pelo código padrão — útil para códigos e mensagens no idioma do projeto. Cada VO exporta o tipo com seus códigos (`EmailErrorCode`, `TextErrorCode`...).
  - `DateRange.create` aceita `{ field, errors }`; `field` prefixa as issues (`periodo.start`).
  - `UniqueId.from(raw, { field, code, message })` permite personalizar a issue de id vazio (antes fixa em `field: "id"`, `code: "INVALID_ID"`).
  - Skills e `llms.txt`: o padrão `result.map(() => { efeito })` foi trocado por retorno antecipado, porque reprova no lint `useIterableCallbackReturn` do Biome; o `check:skills` agora também roda o lint nos blocos de exemplo.

## 0.1.0

### Minor Changes

- e46450a: Primeira versão funcional da lib.
  
  - `Result<T, E>` com erros tipados (`ValidationError`, `NotFoundError`, `ConflictError`, `ForbiddenError`, `UnexpectedError`), `combine` que agrega issues de validação, `try`/`tryAsync`, e propagação de falhas com `if (r.isFail()) return r;`.
  - `Guard` com validações reutilizáveis e códigos de erro estáveis.
  - `ValueObject`, `UniqueId` (ids tipados), `Entity`, `AggregateRoot` e eventos de domínio.
  - `UseCase`/`BaseUseCase`, ports de repositório segregadas, `Clock`, `DomainEventPublisher`, `Mapper` e DTOs de paginação.
  - `core-kernel/vo`: `Email`, `Text`, `Url`, `Money`, `DateRange`, `StrongPassword`.
  - `core-kernel/vo/br`: `Cpf` e `Cnpj` (numérico e alfanumérico, IN RFB 2.229/2024).
  - `core-kernel/testing`: `InMemoryRepository`, `FixedClock`, `SequentialIdGenerator`, `InMemoryEventPublisher`, `assertOk`/`assertFail`.
  - 10 skills para assistentes de código e o CLI `core-kernel skills add|update|check|list`.
  - `llms.txt` com o resumo da API para LLMs.

## 0.1.0-beta.0

Pré-release com o mesmo conteúdo da 0.1.0, usada para validar o fluxo de publicação.
