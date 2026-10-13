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
    vo/                    email, text, url, money, date-range, strong-password (./vo)
      br/                  cpf, cnpj (./vo/br)
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

`package.json` (essencial; versão real no repositório):

```jsonc
{
  "name": "core-kernel",
  "type": "module",
  "sideEffects": false,
  "engines": { "node": ">=20" },
  "files": ["dist"],                       // + "skills", "llms.txt" na Fase 8b
  // "bin": { "core-kernel": ... }          // entra na Fase 8b, junto com o CLI de skills
  "exports": {
    ".": {
      "import":  { "types": "./dist/esm/index.d.ts", "default": "./dist/esm/index.js" },
      "require": { "types": "./dist/cjs/index.d.ts", "default": "./dist/cjs/index.js" }
    }
    // idem para "./vo", "./vo/br", "./testing"
  }
}
```

Build: `tsc` duas vezes (ESM em `dist/esm`, CJS em `dist/cjs` com `package.json`
`"type": "commonjs"`), **sem bundler**, emitindo um arquivo por módulo. Um bundler
(`bun build`, como no shift-swap) duplicaria o código compartilhado em cada subpath e
quebraria a identidade das classes entre `core-kernel` e `core-kernel/vo`.

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
abstract class ValueObject<T> { readonly value: T; protected constructor(value: T); equals(o): boolean }
abstract class Entity<P, Id extends UniqueId = UniqueId> {
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
interface IdGenerator { generate(): string }   // definido em domain/unique-id.ts
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
- [x] `package.json` com `type: module`, `files`, `exports` (import/require com types
      próprios), `sideEffects`, `engines`. (`bin` adiado para a Fase 8b.)
- [x] `tsconfig.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
      `NodeNext`, `ES2022`) + `tsconfig.esm.json` / `tsconfig.cjs.json` excluindo testes
      e sem tipos de Bun/Node (garante código agnóstico de runtime).
- [x] Biome + `simple-git-hooks` + `lint-staged` via `prepare` (não `postinstall`, que
      iria no pacote publicado e quebraria a instalação dos consumidores).
- [x] Build dual ESM/CJS com `tsc` (`scripts/build.ts`) para `index`, `vo`, `vo/br`,
      `testing`.
- [x] `check:package`: `publint --strict` + `attw` + smoke test ESM/CJS.
- [x] CI (lint → typecheck → test+coverage → build → check:package; smoke em Node 20/22/24)
      e publish por tag `v*.*.*` com `npm publish --provenance`.
- [x] LICENSE, README, `CLAUDE.md`, `bunfig.toml` (coverage ≥ 95%), `.gitattributes`.
- [ ] Reservar o nome publicando `0.0.0` no npm (manual, requer sua conta).
- **DoD:** um export dummy builda, passa no `attw` e é importado em ESM e CJS.

### Fase 1 — Result + Errors
- [x] `AppError` e subclasses (`ValidationError`, `NotFoundError`, `ConflictError`,
      `ForbiddenError`, `UnexpectedError`).
- [x] `Result` (`Ok`/`Fail`, type guards, `map`, `flatMap`, `mapError`, `match`, `unwrap`,
      `unwrapOr`, `combine`, `try`, `tryAsync`).
- [x] Testes de comportamento + testes de tipo (`// @ts-expect-error`).
- **DoD:** cobertura > 95%; impossível ler `.value` sem narrowing. ✅ (100%, 53 testes)
- Notas de implementação:
  - `Result` é um tipo união (`Ok | Fail`) + um objeto `Result` com as fábricas; também
    aceita narrowing por `result.ok`.
  - `combine` com uma única falha devolve o erro original; com várias falhas só de
    validação, faz merge das issues; senão devolve a primeira falha não-validação.
  - `Result.try`/`tryAsync` aceitam um `mapError` opcional (padrão: `UnexpectedError.from`).
  - Erros serializam via `toJSON()` (`name`, `kind`, `code`, `message`, `details`, `issues`).

### Fase 2 — Guard
- [x] `Guard.required`, `notEmpty`, `minLength`, `maxLength`, `inRange`, `integer`, `matches`, `oneOf`
      → `Result<void, ValidationError>`.
- [x] `Guard.all([...])` agregando *issues* de vários campos.
- Notas: todo guard aceita `{ field, code, message }` para personalizar a issue (ex.:
  `code: "INVALID_EMAIL"`, mensagem traduzida). `Guard.all` acumula; `flatMap` para na
  primeira falha. Guards só verificam — normalização é do VO. `integer` entrou por causa
  do `Money` (centavos) da Fase 6.

### Fase 3 — Identifier + ValueObject
- [x] `UniqueId` com gerador plugável (`UniqueId.useGenerator`, padrão `crypto.randomUUID`).
- [x] `ValueObject` congelado, igualdade estrutural profunda, brand em vez de `instanceof`.
- Notas de implementação:
  - O campo é `value` (não `props`), como no pharmacore e no shift-swap: `email.value`.
  - Sem classe `Identifier` separada: `UniqueId` é subclassável e ids tipados são
    subclasses com brand (`declare private readonly __brand: "OrderId"`), que o compilador
    não deixa misturar e que não são iguais entre si em runtime.
  - `UniqueId.from(raw)` aceita qualquer string não vazia (UUID, cuid, id do BetterAuth...).
  - O VO não congela `this` (quebraria campos de subclasses com ES2022 class fields); o
    `value` é não-gravável e copiado + congelado em profundidade (objetos simples, arrays,
    `Date`). Instâncias de outras classes são guardadas por referência.
  - `IdGenerator` nasceu aqui; a Fase 5 reaproveita a mesma interface como port.

### Fase 4 — Entity, AggregateRoot e DomainEvent
- [x] `Entity` com igualdade por id e convenção `create`/`restore`.
- [x] `DomainEvent` (`id`, `name`, `occurredAt`, `aggregateId`, `payload`) + `createDomainEvent`
      e `AggregateRoot` com `addDomainEvent`/`pullDomainEvents`/`domainEvents`.
- [x] Interface opcional `Auditable` (`createdAt`, `updatedAt`, `deletedAt`).
- Notas de implementação:
  - O construtor exige o `id`: a base não sabe qual subclasse de id gerar, então o
    `create` da entidade faz `OrderId.generate()` explicitamente.
  - `props` é `protected readonly` (a referência não muda; os métodos de domínio alteram
    campos) e é copiada rasa no construtor.
  - Igualdade exige mesma classe + mesmo id.
  - `AggregateRoot<P, Id, E>`: `E` é a união tipada dos eventos do agregado.
  - Eventos ganharam `id` (para idempotência/outbox), gerado pelo gerador do `UniqueId`.
  - Sem `toJSON` em entidades: a conversão para DTO/persistência é explícita via `Mapper`
    (Fase 5), para não vazar estado interno.

### Fase 5 — Camada de aplicação
- [x] `UseCase<I, O, E>` (interface) + `BaseUseCase` (converte exceções em `UnexpectedError`).
- [x] Ports de repositório segregadas + `CrudRepository`, tipadas pelo id da entidade.
- [x] Ports `Clock` (+ `systemClock`), `IdGenerator` (da Fase 3), `DomainEventPublisher`.
- [x] DTOs de paginação e interface `Mapper<Domain, Raw>` (`toDomain`/`fromDomain`).
- Notas de implementação:
  - Decisão 2: repositórios devolvem `T | null` e **lançam** em falha de infraestrutura;
    o use case converte `null` em `NotFoundError` e o `BaseUseCase` converte exceções em
    `UnexpectedError` (com a original em `cause`).
  - `findById`/`delete` recebem o id tipado (`OrderId`), não `string`.
  - Paginação mantém os nomes e o envelope do contrato do pharmacore
    (`PaginatedInputDTO`, `PaginationMetaDTO`, `PaginatedResultDTO<T>`, `totalPages =
    ceil(total / pageSize)`) e ganhou `validatePagination` e `toPaginatedResult`.
  - Coverage: o limite de 95% vale só para linhas; a métrica de funções do Bun tem falsos
    negativos (construtores implícitos e inicializadores de campo).

### Fase 6 — VOs comuns (`./vo`, `./vo/br`)
- [x] Genéricos: `Email`, `Text`, `Url`, `Money` (centavos inteiros + moeda),
      `DateRange`, `StrongPassword`.
- [x] BR: `Cpf`, `Cnpj` (numérico **e alfanumérico**).
- [x] Portar os casos de teste do pharmacore para `bun:test`.
- Notas de implementação:
  - Padrão de todos os VOs: `static create(raw, { field? }): Result<Vo, ValidationError>`,
    construtor privado, entrada não-string (JSON) vira falha em vez de exceção.
  - `Cnpj` segue a IN RFB nº 2.229/2024 (CNPJ alfanumérico, emitido desde jul/2026):
    12 caracteres A–Z/0–9 + 2 DVs numéricos, valor de cada caractere = ASCII − 48. Validado
    com o exemplo oficial `12.ABC.345/01DE-35`. O VO do pharmacore não calculava os DVs.
  - `StrongPassword` foi para `./vo` (não é brasileiro), devolve uma issue por regra
    violada e mascara `toString`/`toJSON` para não vazar a senha em logs.
  - `PositiveNumber` saiu do escopo: `Guard.inRange`/`Guard.integer` cobrem o `Number` VO
    do pharmacore sem criar um VO genérico demais.
  - `Money` aceita negativos (estornos); "preço ≥ 0" é regra da entidade. Casas decimais
    por moeda vêm do `Intl` (BRL 2, JPY 0).
  - `DateRange` é semiaberto `[start, end)`; `overlaps` substitui o
    `temConflitoDeHorario` do shift-swap.
  - O smoke test verifica que um erro criado em `core-kernel/vo` é `instanceof` da
    `ValidationError` de `core-kernel` (justificativa do build sem bundler).

### Fase 7 — Kit de testes (`./testing`)
- [x] `InMemoryRepository<T>` (baseado em `Map`), `FixedClock`, `SequentialIdGenerator`,
      `InMemoryEventPublisher`.
- [x] `assertOk(result)` / `assertFail(result, code?)` com narrowing, sem depender de runner.
- Notas de implementação:
  - `InMemoryRepository` imita um banco: `create` duplicado e `update` inexistente lançam;
    `failNext(error)` simula falha de infraestrutura na próxima operação (para testar o
    caminho `UnexpectedError`); subclasses implementam queries com `find`/`filter`.
  - `SequentialIdGenerator.install()` troca o gerador do `UniqueId` e devolve o restore.
  - `InMemoryEventPublisher` entrou por ser o dublê natural do port `DomainEventPublisher`.
  - `assertFail(result, code)` aceita o `code` do erro ou de uma issue de validação.

### Fase 8 — Documentação e exemplo
- [x] `examples/order` com mini domínio (agregado + VO composto + eventos, ports de
      repositório e de query, use cases place/confirm/list, mapper, testes) que funciona como
      teste de integração da API pública.
- [x] README: instalação, conceitos, receita por bloco, convenções.
- [x] `llms.txt` com resumo da API para LLMs (publicado no pacote).
- Notas de implementação:
  - O exemplo importa `core-kernel` pelo nome do pacote, então compila e roda contra o
    `dist` buildado (`check:examples`, no `verify` e no CI). Também é checado com
    TypeScript 5.4 (`check:ts-compat`, no CI), a versão mínima declarada no README.
  - **O exemplo encontrou um problema de API**: `if (r.isFail()) return r;` não compilava
    quando o tipo de sucesso mudava. `Fail<T, E>` virou `Fail<E>` (commit `fe682ab`,
    breaking change), validado em TS 5.4, 5.9 e 7.
  - Ids de eventos consomem a sequência do `SequentialIdGenerator`; documentado.
  - ~~Pendente para a 8b~~ Resolvido na 8b: os templates de código do `llms.txt` agora são checados pelo
    `tsc` (entram no mesmo mecanismo das references das skills).

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

- [x] Skills em `skills/<nome>/SKILL.md` + `references/*.md` + `agents/openai.yaml`
      (formato Agent Skills), sem caminhos fixos, importando de `core-kernel`,
      `core-kernel/vo` e `core-kernel/testing`. São 10: as 7 reescritas + `ddd-result-errors`,
      `ddd-aggregate-events`, `ddd-testing`.
- [x] CLI `bunx core-kernel skills add | update | check | list` com
      `--target claude|agents|all`: copia para `.claude/skills/` e `.agents/skills/`, grava
      `core-kernel.skills.json` (versão + hash por target/skill). Zero deps; sem `postinstall`.
      Nunca sobrescreve skill editada ou de outra origem sem `--force`; remove skills que saíram
      do pacote; hash ignora CRLF/LF. **Não feito:** injetar bloco no `CLAUDE.md`/`AGENTS.md`
      do consumidor (intrusivo; as `description` das skills já fazem o roteamento).
- [x] CI: `check:skills` valida frontmatter, compila todo bloco ```ts das references e do
      `llms.txt` contra o `dist` e **roda os blocos de teste** (exemplo errado reprova o CI).
- [ ] (Opcional, não feito) `.claude-plugin/marketplace.json` apontando para `skills/`.
- [x] Regra no `CLAUDE.md`: mudança de API pública atualiza a skill no mesmo PR.
- [x] Smoke do CLI publicado (`scripts/smoke-cli.mjs`) em `check:package` e na matriz Node 20/22/24.
- **DoD:** num projeto vazio, `bun add core-kernel && bunx core-kernel skills add` permite
  ao Claude e ao Codex gerar uma entidade e um use case que compilam e passam nos testes.
  ✅ Validado (2026-10-13) com o Claude: projeto novo fora do repo, lib instalada do tarball,
  agente sem contexto implementou um domínio inédito (empréstimo de livros: agregado, port,
  2 use cases, política de limite, 17 testes) consultando só as skills/`llms.txt`; `tsc` e
  testes passaram na primeira tentativa. Os atritos relatados viraram correções nas skills
  (API do `InMemoryRepository`, `count`/`exists` em repositório para regras de comando,
  padrão de limite/cota, códigos padrão do `Guard`/`UniqueId`, derivar datas de `now`).
  Não validado com o Codex. A validação também achou o `prepare` quebrando `bun pm pack`
  (corrigido com `scripts/prepare.mjs`).

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
| 2 | Repositório retorna `T \| null` ou `Result<T>` | **`T \| null`**; falha de infra é exceção → `UnexpectedError` no use case |
| 3 | Idioma da API e dos códigos de erro | **Inglês** (API, nomes e `code`); mensagens são sobrescrevíveis via construtor |
| 4 | VOs brasileiros no mesmo pacote (`./vo/br`) ou separado | **Subpath `./vo/br`** |
