# core-kernel

Blocos base de **DDD / Clean Architecture** para manter o core business desacoplado de
frameworks, banco e UI, em **Bun** e **Node ≥ 20**.

> 🚧 Em desenvolvimento (0.x). A API ainda vai mudar. Veja o [plano](./docs/PLAN.md).

## O que terá

- `Result<T, E>` com erros tipados (`ValidationError`, `NotFoundError`, ...)
- `Entity`, `AggregateRoot`, `ValueObject`, `DomainEvent`
- `UseCase` e ports (`CrudRepository`, `Clock`, `IdGenerator`, ...)
- VOs comuns (`core-kernel/vo`) e brasileiros (`core-kernel/vo/br`)
- Kit de testes (`core-kernel/testing`): repositório in-memory, relógio fixo, asserts de `Result`
- Skills para LLMs (Claude Code, Codex, ...) que ensinam a usar a lib

Zero dependências de runtime. ESM e CommonJS.

## Instalação

```bash
bun add core-kernel
```

## Desenvolvimento

```bash
bun install
bun run verify
```

Convenções de contribuição em [CLAUDE.md](./CLAUDE.md).

## Licença

MIT
