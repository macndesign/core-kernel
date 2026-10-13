# Plano — `core-kernel`

Biblioteca base (DDD / Clean Architecture) para desacoplar o core business de aplicações e
bibliotecas em Bun ou Node (web, mobile, CLI, backend). Fornece os blocos genéricos —
`Result`, erros, `Entity`, `ValueObject`, `AggregateRoot`, `UseCase`, ports de repositório,
VOs comuns e kit de testes — além de skills para LLMs que ensinam a usá-los.

Origem: generalização do `packages/shared/core` do **pharmacore** e do `src/shared` do
**shift-swap**, com a estrutura de projeto/tooling do shift-swap.

- Nome no npm: `core-kernel` (livre em 2026-10-13; sem escopo — ver decisões em aberto)
- Runtime de desenvolvimento: Bun (`bun test`, `bun build`)
- Distribuição: npm, ESM + CJS + `.d.ts`

---

## 1. Diagnóstico do que já existe

| Tema | pharmacore `shared/core` | shift-swap `src/shared` | Decisão no `core-kernel` |
|---|---|---|---|
| **Result** | Erros `string[]`; `instance` retorna `undefined` silenciosamente em falha; `throwIfFailed` lança array | Erro único `string \| Error`; `combine` retorna `Result<any>`; use cases fazem `error as string \| Error` | `Result<T, E>` com erro **tipado**; acesso ao valor só após narrowing; `map/flatMap/match`; `combine` preservando tipos |
| **Erros** | Códigos soltos (`"INVALID_EMAIL"`) | Mensagens em PT não tratáveis por máquina | Hierarquia `AppError` com `code` estável + `message` + `details` + `kind` (validation, not_found, conflict…) que adapters mapeiam para HTTP/CLI |
| **Entity** | `props` públicas e mutáveis; timestamps obrigatórios; `cloneWith` com `as any`; depende de `uuid` | Enxuta; `equals` via `instanceof` | Base enxuta, `id` tipado, `props` protegidas, timestamps opcionais via interface, zero deps |
| **ValueObject** | `equals` por `===` (quebra em VO composto) | Congelado + igualdade estrutural profunda | Modelo do shift-swap |
| **Repository** | Interfaces segregadas (bom para ISP) | Classe abstrata com CRUD completo (força métodos não usados) | Modelo do pharmacore: interfaces pequenas + `CrudRepository` composto |
| **Either** | — | Existe, nada usa | Não incluir; `Result` cumpre o papel |
| **Tooling** | Jest + tsc | Bun test, Biome, ESM+CJS+d.ts, CI/publish por tag | Modelo do shift-swap + validação do pacote (`publint`, `attw`) |

## 2. Princípios

1. **Zero dependências de runtime** (`crypto.randomUUID()` em vez de `uuid`).
2. **Agnóstica de framework e runtime**: nada de HTTP, banco ou `Bun.*` no código publicado.
   Node ≥ 20 e Bun.
3. **Regra de negócio nunca lança exceção**: falhas esperadas são `Result.fail`; `throw` só
   para uso indevido da API ou bugs.
4. **Imutabilidade por padrão** (VOs congelados, `readonly`).
5. **ESM-first + CJS**, `sideEffects: false`, *subpath exports* para tree-shaking.
6. **Segura contra dual package hazard**: nada de `instanceof` em checagens internas — usar
   *brands* via `Symbol.for("core-kernel/...")`.
7. **Sem abstrações especulativas**: só entra no core o que tem ≥ 2 consumidores reais.
8. **Libs de domínio que dependem do `core-kernel` o declaram como `peerDependency`**, para
   evitar duas cópias no app final.

## 3. Estrutura

```
core-kernel/
  .github/workflows/ci.yml, publish.yml
  .claude/skills/          skills para quem MANTÉM a lib (não publicadas)
  docs/PLAN.md
  skills/                  skills para quem USA a lib (publicadas no pacote)
  src/
    result/                result.ts, index.ts, __tests__/
    errors/                app-error.ts, validation-error.ts, not-found-error.ts,
                           conflict-error.ts, forbidden-error.ts, unexpected-error.ts
    guard/                 guard.ts
    domain/                identifier.ts, value-object.ts, entity.ts,
                           aggregate-root.ts, domain-event.ts
    application/
      use-case.ts
      ports/               repository.ts, clock.ts, id-generator.ts,
                           domain-event-publisher.ts
      dto/                 pagination.dto.ts
      mapper.ts
    vo/                    email, text, url, money, positive-number, date-range (./vo)
      br/                  cpf, cnpj, strong-password (./vo/br)
    testing/               in-memory.repository.ts, fixed.clock.ts,
                           sequential-id.generator.ts, result-asserts.ts (./testing)
    cli/                   skills.ts (bin, entry separado)
    index.ts               superfície pública do core
  examples/                mini domínio de exemplo (não publicado; type-checked no CI)
  llms.txt
  biome.json, tsconfig.json, tsconfig.build.json, package.json,
  CLAUDE.md, README.md, LICENSE
```

Testes ficam em `__tests__/` ao lado do código. Arquivos em kebab-case com sufixo do tipo
(`*.vo.ts`, `*.entity.ts`, `*.usecase.ts`, `*.repository.ts`).

`package.json` (essencial):

```jsonc
{
  "name": "core-kernel",
  "type": "module",
  "sideEffects": false,
  "engines": { "node": ">=20" },
  "files": ["dist", "skills", "llms.txt"],
  "bin": { "core-kernel": "./dist/cli.js" },
  "exports": {
    ".":         { "types": "./dist/index.d.ts",         "import": "./dist/index.js",         "require": "./dist/index.cjs" },
    "./vo":      { "types": "./dist/vo/index.d.ts",      "import": "./dist/vo/index.js",      "require": "./dist/vo/index.cjs" },
    "./vo/br":   { "types": "./dist/vo/br/index.d.ts",   "import": "./dist/vo/br/index.js",   "require": "./dist/vo/br/index.cjs" },
    "./testing": { "types": "./dist/testing/index.d.ts", "import": "./dist/testing/index.js", "require": "./dist/testing/index.cjs" }
  }
}
```

## 4. Esboço das APIs principais

```ts
// result
type Result<T, E extends AppError = AppError> = Ok<T, E> | Fail<T, E>;
Result.ok(value) / Result.fail(error)
r.isOk() / r.isFail()                          // type guards; .value só existe após narrowing
r.map(fn) / r.flatMap(fn) / r.mapError(fn) / r.match({ ok, fail })
r.unwrap() / r.unwrapOr(fallback)              // unwrap lança — uso em testes e bordas
Result.combine([a, b] as const)                // Result<[A, B]>; agrega ValidationErrors
Result.try(fn) / Result.tryAsync(fn)           // exceção → UnexpectedError

// errors
abstract class AppError extends Error {
  abstract readonly kind: ErrorKind;           // "validation" | "not_found" | "conflict" | "forbidden" | "unexpected"
  readonly code: string;
  readonly details?: unknown;
}
class ValidationError extends AppError {
  readonly issues: { field?: string; code: string; message: string }[];
}

// domain
abstract class ValueObject<P> { protected constructor(readonly props: P); equals(o): boolean }
abstract class Entity<P, Id extends Identifier = UniqueId> {
  readonly id: Id;
  protected props: P;
  protected constructor(props: P, id?: Id);
  equals(o): boolean;
}
abstract class AggregateRoot<P> extends Entity<P> {
  protected addDomainEvent(e: DomainEvent): void;
  pullDomainEvents(): DomainEvent[];
}
// Convenção: static create(raw): Result<X>  e  static restore(props, id): X  (reidratação)

// application
interface UseCase<I, O, E extends AppError = AppError> { execute(input: I): Promise<Result<O, E>> }
interface FindByIdRepository<T> { findById(id: string): Promise<T | null> }
interface CrudRepository<T> extends CreateRepository<T>, UpdateRepository<T>,
  DeleteRepository<T>, FindByIdRepository<T> {}
interface Clock { now(): Date }
interface IdGenerator { generate(): string }
```

Convenções arquiteturais (herdadas de `pharmacore/docs/project/coding-standards.md`):

- Repositório tem só operações de escrita (`create`/`update`/`delete`, retornando `void`) e
  `findById`. Demais consultas ficam num arquivo irmão de *queries* que retorna DTOs de
  lista/detalhe (`findDetailsById`, `findAll…`).
- Tipos de entrada/saída (`In`/`Out`) existem só nos casos de uso.
- Nomenclatura: buscar = `find…`, editar = `update…`.

## 5. Fases

Toda fase segue **TDD** com `bun:test` (teste vermelho → implementação) e termina com
`bun run lint`, `bun test`, `tsc --noEmit` e `bun run build` verdes.

### Fase 0 — Fundação do repositório
- [ ] `bun init`; `package.json` com `type: module`, `files`, `exports`, `sideEffects`,
      `engines`, `bin`.
- [ ] `tsconfig.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
      `target ES2022`) + `tsconfig.build.json` excluindo testes.
- [ ] Biome + `simple-git-hooks` + `lint-staged` (copiar do shift-swap).
- [ ] Scripts de build ESM/CJS/d.ts com múltiplas entrypoints (`index`, `vo`, `vo/br`,
      `testing`, `cli`).
- [ ] `publint` + `@arethetypeswrong/cli` em `check:package`.
- [ ] CI (lint → test com coverage → build → check:package) e publish por tag `v*.*.*`.
- [ ] LICENSE, README, `CLAUDE.md` com convenções.
- **DoD:** um export dummy builda, passa no `attw` e é importado em ESM e CJS.

### Fase 1 — Result + Errors
- [ ] `AppError` e subclasses (`ValidationError`, `NotFoundError`, `ConflictError`,
      `ForbiddenError`, `UnexpectedError`).
- [ ] `Result` (`Ok`/`Fail`, type guards, `map`, `flatMap`, `mapError`, `match`, `unwrap`,
      `unwrapOr`, `combine`, `try`, `tryAsync`).
- [ ] Testes de comportamento + testes de tipo (`// @ts-expect-error`).
- **DoD:** cobertura > 95%; impossível ler `.value` sem narrowing.

### Fase 2 — Guard
- [ ] `Guard.required`, `notEmpty`, `minLength`, `maxLength`, `inRange`, `matches`, `oneOf`
      → `Result<void, ValidationError>`.
- [ ] `Guard.all([...])` agregando *issues* de vários campos.

### Fase 3 — Identifier + ValueObject
- [ ] `Identifier` / `UniqueId` com gerador plugável (padrão `crypto.randomUUID`).
- [ ] `ValueObject` congelado, igualdade estrutural profunda, brand em vez de `instanceof`.

### Fase 4 — Entity, AggregateRoot e DomainEvent
- [ ] `Entity` com igualdade por id e convenção `create`/`restore`.
- [ ] `DomainEvent` (`name`, `occurredAt`, `aggregateId`, `payload`) e `AggregateRoot`
      com `addDomainEvent`/`pullDomainEvents`.
- [ ] Interface opcional `Auditable` (`createdAt`, `updatedAt`, `deletedAt`).

### Fase 5 — Camada de aplicação
- [ ] `UseCase<I, O, E>` (interface + base abstrata opcional).
- [ ] Ports de repositório segregadas + `CrudRepository`.
- [ ] Ports `Clock`, `IdGenerator`, `DomainEventPublisher`.
- [ ] DTOs de paginação e interface `Mapper<Domain, Dto>`.

### Fase 6 — VOs comuns (`./vo`, `./vo/br`)
- [ ] Genéricos: `Email`, `Text`, `Url`, `Money` (centavos inteiros + moeda),
      `PositiveNumber`, `DateRange`.
- [ ] BR: `Cpf`, `Cnpj`, `StrongPassword`.
- [ ] Portar os testes existentes do pharmacore para `bun:test`.

### Fase 7 — Kit de testes (`./testing`)
- [ ] `InMemoryRepository<T>` (baseado em `Map`), `FixedClock`, `SequentialIdGenerator`.
- [ ] `assertOk(result)` / `assertFail(result, code?)` com narrowing, sem depender de runner.

### Fase 8 — Documentação e exemplo
- [ ] `examples/` com mini domínio (`Order`: create, eventos, use case) que funciona como
      teste de integração da API pública.
- [ ] README: instalação, conceitos, receita por bloco, convenções.
- [ ] `llms.txt` com resumo da API para LLMs.

### Fase 8b — Recursos para LLMs
Base: skills do pharmacore (`.claude/skills` e `.agents/skills`, hoje cópias idênticas e
acopladas a caminhos/API do pharmacore).

| Skill pharmacore | Decisão |
|---|---|
| `value-object`, `entity`, `use-case` | Reescrever como `ddd-value-object`, `ddd-entity`, `ddd-use-case` |
| `repository` (contrato) | Reescrever como `ddd-repository` (sem parte Prisma) |
| `domain-service`, `dto`, `query-cqrs` | Reescrever como `ddd-domain-service`, `ddd-dto`, `ddd-query-cqrs` |
| — | Criar `ddd-aggregate-events`, `ddd-result-errors`, `ddd-testing` |
| `controller`, `prisma`, `frontend-form-schema` | Fora — dependem de stack; futuros pacotes de adapter |
| `openspec-*` | Fora — gerados pelo `openspec init` do projeto consumidor |
| MCP de banco | Fora — específico do projeto |

- [ ] Skills em `skills/<nome>/SKILL.md` + `references/*.md` + `agents/openai.yaml`
      (formato Agent Skills), sem caminhos fixos, importando de `core-kernel`,
      `core-kernel/vo` e `core-kernel/testing`.
- [ ] CLI `bunx core-kernel skills add | update | check` com `--target claude|agents|all`:
      copia para `.claude/skills/` e `.agents/skills/`, grava `skills.lock.json` com a versão
      da lib e opcionalmente injeta bloco gerenciado no `CLAUDE.md`/`AGENTS.md` do projeto.
      Zero deps (`node:fs`, `node:path`); **sem `postinstall`**.
- [ ] CI: frontmatter válido + blocos ```ts das references compilando (extraídos de
      `examples/` e checados pelo `tsc`).
- [ ] (Opcional) `.claude-plugin/marketplace.json` apontando para `skills/`.
- [ ] Regra no `CLAUDE.md`: mudança de API pública atualiza a skill no mesmo PR.
- **DoD:** num projeto vazio, `bun add core-kernel && bunx core-kernel skills add` permite
  ao Claude e ao Codex gerar uma entidade e um use case que compilam e passam nos testes.

### Fase 9 — Release
- [ ] Changesets para SemVer; permanecer em 0.x até a API estabilizar.
- [ ] Publicar `0.1.0-beta` e validar o tarball (`npm pack`) em consumidores Node ESM,
      Node CJS e Bun.
- [ ] Publicar com `npm publish --provenance` no CI.

### Fase 10 — Migração piloto
- [ ] shift-swap: substituir `src/shared/*` e ajustar use cases ao `Result` tipado.
- [ ] pharmacore: substituir `packages/shared/core`.

## 6. Decisões

| # | Decisão | Status |
|---|---|---|
| 1 | Nome no npm | **`core-kernel`** (sem escopo). Reservar cedo publicando `0.0.0`, ou usar `@macndesign/core-kernel` se o npm recusar por similaridade |
| 2 | Repositório retorna `T \| null` ou `Result<T>` | Em aberto — recomendação: `T \| null` |
| 3 | Idioma da API e dos códigos de erro | Em aberto — recomendação: inglês, mensagens sobrescrevíveis |
| 4 | VOs brasileiros no mesmo pacote (`./vo/br`) ou separado | Em aberto — recomendação: subpath `./vo/br` |
