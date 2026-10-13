# core-kernel

Blocos base de **DDD / Clean Architecture** para manter o core business desacoplado de
frameworks, banco e UI — em **Bun** e **Node ≥ 20**, para backend, web, mobile ou CLI.

- `Result<T, E>` com erros tipados, em vez de exceções para regras de negócio
- `Entity`, `AggregateRoot`, `ValueObject`, `UniqueId` e eventos de domínio
- `UseCase`, ports de repositório segregadas, `Clock`, paginação
- VOs prontos (`Email`, `Money`, `DateRange`, `Cpf`, `Cnpj` alfanumérico...)
- Kit de testes: repositório em memória, relógio fixo, ids previsíveis
- Skills para assistentes de código (Claude Code, Codex...) que ensinam os padrões da lib
- Zero dependências de runtime · ESM e CommonJS · TypeScript ≥ 5.4

> Versão 0.x: mudanças incompatíveis podem sair em versões *minor* (0.1 → 0.2), sempre
> descritas no CHANGELOG.

## Instalação

```bash
bun add core-kernel
```

O histórico de mudanças está no [CHANGELOG](./CHANGELOG.md).

| Import | Conteúdo |
|---|---|
| `core-kernel` | `Result`, erros, `Guard`, `Entity`, `AggregateRoot`, `ValueObject`, `UniqueId`, eventos, `UseCase`, ports, paginação |
| `core-kernel/vo` | `Email`, `Text`, `Url`, `Money`, `DateRange`, `StrongPassword` |
| `core-kernel/vo/br` | `Cpf`, `Cnpj` |
| `core-kernel/testing` | `InMemoryRepository`, `FixedClock`, `SequentialIdGenerator`, `InMemoryEventPublisher`, `assertOk`, `assertFail` |

Bibliotecas de domínio construídas sobre o `core-kernel` devem declará-lo como
`peerDependency`, para que a aplicação final tenha uma única cópia.

## Guia rápido

O exemplo completo (agregado, use cases, query paginada, mapper e testes) está em
[`examples/order`](./examples/order) e é verificado no CI. Os trechos abaixo são adaptados de lá.

### 1. Result e erros

Regras de negócio **não lançam exceção**: devolvem `Result`. O valor e o erro só ficam
acessíveis depois do narrowing.

```ts
import { NotFoundError, Result } from "core-kernel";

const order = await this.orders.findById(id.value);
if (!order) return Result.fail(new NotFoundError("Order not found", { code: "ORDER_NOT_FOUND" }));

const confirmed = order.confirm(this.clock.now());
if (confirmed.isFail()) return confirmed; // propaga a falha, mesmo com outro tipo de sucesso
```

| Erro | `kind` | Uso típico (o adapter decide o mapeamento) |
|---|---|---|
| `ValidationError` | `validation` | entrada inválida, com `issues[]` por campo (HTTP 400/422) |
| `NotFoundError` | `not_found` | recurso não existe (404) |
| `ConflictError` | `conflict` | estado não permite a operação (409) |
| `ForbiddenError` | `forbidden` | sem permissão (403) |
| `UnexpectedError` | `unexpected` | infraestrutura/bug, com a exceção original em `cause` (500) |

Todo erro tem `code` estável (ex.: `ORDER_NOT_FOUND`) e serializa com `toJSON()`.

Outras operações: `map`, `flatMap`, `mapError`, `match`, `unwrapOr`, `unwrap` (lança — só em
testes e bordas), `Result.combine([...])` (tupla tipada; agrega as issues de validação),
`Result.try`/`Result.tryAsync` (exceção de terceiros → `UnexpectedError`).

### 2. Value Objects

Imutáveis, comparados por valor, criados por uma fábrica que valida. Use os prontos ou crie
os seus com `Guard`:

```ts
import { Guard, type Result, type ValidationError, ValueObject } from "core-kernel";

export class OrderLine extends ValueObject<OrderLineValue> {
  private constructor(value: OrderLineValue) {
    super(value);
  }

  static create({ sku, quantity, unitPrice }: OrderLineValue, field = "line"): Result<OrderLine, ValidationError> {
    const normalizedSku = sku.trim().toUpperCase();
    return Guard.all([                                   // acumula as issues de todos os campos
      Guard.notEmpty(normalizedSku, { field: `${field}.sku` }),
      Guard.integer(quantity, { field: `${field}.quantity` }).flatMap(() =>
        Guard.inRange(quantity, { min: 1 }, { field: `${field}.quantity` }),
      ),
    ]).map(() => new OrderLine({ sku: normalizedSku, quantity, unitPrice }));
  }
}
```

`Guard`: `required`, `notEmpty`, `minLength`, `maxLength`, `inRange`, `integer`, `matches`,
`oneOf`, `all`. Todos aceitam `{ field, code, message }` para personalizar a issue.

### 3. Entidades e agregados

```ts
import { AggregateRoot, createDomainEvent, type DomainEvent, UniqueId } from "core-kernel";

export class OrderId extends UniqueId {
  declare private readonly __brand: "OrderId"; // ids de tipos diferentes não se misturam
}

type OrderConfirmed = DomainEvent<"order.confirmed", { confirmedAt: string }>;

export class Order extends AggregateRoot<OrderProps, OrderId, OrderPlaced | OrderConfirmed> {
  private constructor(props: OrderProps, id: OrderId) {
    super(props, id);
  }

  static place(props: PlaceOrderProps): Result<Order, ValidationError> { /* valida, OrderId.generate(), emite order.placed */ }
  static restore(props: OrderProps, id: OrderId): Order { return new Order(props, id); } // repositório

  confirm(now: Date): Result<void, ConflictError> {
    if (this.props.status !== "pending") {
      return Result.fail(new ConflictError(`Order is ${this.props.status}`, { code: "ORDER_NOT_PENDING" }));
    }
    this.props.status = "confirmed";
    this.addDomainEvent(createDomainEvent({ name: "order.confirmed", aggregateId: this.id.value, occurredAt: now, payload: { confirmedAt: now.toISOString() } }));
    return Result.ok();
  }
}
```

Convenções: construtor privado; `create`/`place` valida e emite eventos; `restore` reidrata
do banco sem validar; estado só muda por métodos de domínio que devolvem `Result`.

### 4. Use cases e ports

```ts
import { BaseUseCase, type Clock, type DomainEventPublisher, type FindByIdRepository,
         type UpdateRepository } from "core-kernel";

export class ConfirmOrderUseCase extends BaseUseCase<ConfirmOrderInput, void, ConfirmOrderError> {
  constructor(
    private readonly orders: FindByIdRepository<Order> & UpdateRepository<Order>, // só o que usa
    private readonly events: DomainEventPublisher,
    private readonly clock: Clock,
  ) {
    super();
  }

  protected async handle({ orderId }: ConfirmOrderInput): Promise<Result<void, ConfirmOrderError>> {
    // ... (ver acima)
    await this.orders.update(order);
    await this.events.publish(order.pullDomainEvents());
    return Result.ok();
  }
}
```

- Repositórios devolvem `T | null` e **lançam** em falha de infraestrutura; o `BaseUseCase`
  converte exceções em `UnexpectedError`, então `execute()` nunca rejeita.
- Repositório = escrita + `findById`. Consultas para telas ficam em ports de *query* que
  devolvem DTOs (`PaginatedResultDTO<T>`, `validatePagination`, `toPaginatedResult`).
- `Mapper<Domain, Raw>` converte entre domínio e persistência (`toDomain` usa `restore`).

### 5. Testes

```ts
import { assertFail, assertOk, FixedClock, InMemoryEventPublisher,
         InMemoryRepository, SequentialIdGenerator } from "core-kernel/testing";

const orders = new InMemoryRepository<Order>([pendingOrder]);
const events = new InMemoryEventPublisher();
const useCase = new ConfirmOrderUseCase(orders, events, new FixedClock("2026-10-13T12:00:00Z"));

assertOk(await useCase.execute({ orderId: pendingOrder.id.value }));
expect(events.namesOf()).toEqual(["order.confirmed"]);

orders.failNext(new Error("connection refused"));            // simula queda do banco
assertFail(await useCase.execute({ orderId: "..." }), "UNEXPECTED");
```

`assertOk`/`assertFail` funcionam com qualquer test runner. `SequentialIdGenerator().install()`
torna ids previsíveis (lembre que ids de eventos também consomem a sequência).

## Skills para assistentes de código

O pacote traz 10 skills (formato Agent Skills) que ensinam um assistente de código a usar a
lib nos padrões dela. Instale no projeto:

```bash
bunx core-kernel skills add
```

| Comando | O que faz |
|---|---|
| `skills add [--target claude\|agents\|all]` | Copia as skills para `.claude/skills` (Claude Code) e/ou `.agents/skills` (Codex e outros). Sem `--target`, usa as pastas que já existem no projeto (ou `.claude`). |
| `skills update` | Atualiza para a versão instalada do core-kernel. |
| `skills check` | Falha (exit 1) se estiverem ausentes, editadas ou desatualizadas — útil no CI. |
| `skills list` | Lista as skills disponíveis. |

O estado fica em `core-kernel.skills.json` (versione junto com as skills). Skills editadas
localmente ou com o mesmo nome de outra origem **nunca são sobrescritas** sem `--force`.

Skills: `ddd-result-errors`, `ddd-value-object`, `ddd-entity`, `ddd-aggregate-events`,
`ddd-use-case`, `ddd-repository`, `ddd-domain-service`, `ddd-dto`, `ddd-query-cqrs`,
`ddd-testing`. Todo exemplo de código delas é compilado e testado no CI desta lib.

O pacote também publica um `llms.txt` com o resumo da API e as regras para assistentes.

## Value Objects disponíveis

| VO | Destaques |
|---|---|
| `Email` | trim + lowercase, até 254 caracteres, `local`/`domain` |
| `Text` | trim, `minLength` (padrão 1) e `maxLength` |
| `Url` | só `http`/`https` por padrão (configurável), `hostname` |
| `Money` | centavos inteiros + moeda ISO 4217; `add`/`subtract` (falham com moedas diferentes), `multiply`, `fromDecimal`, `format(locale)` |
| `DateRange` | intervalo `[start, end)`, `overlaps`, `contains`, `durationMs` |
| `StrongPassword` | uma issue por regra violada; `toString`/`toJSON` mascarados |
| `Cpf` | dígitos verificadores, `formatted` |
| `Cnpj` | numérico **e alfanumérico** (IN RFB 2.229/2024), `formatted`, `root` |

Todos seguem `Xxx.create(raw, { field? }): Result<Xxx, ValidationError>`.

## Desenvolvimento

```bash
bun install
bun run verify   # lint, typecheck, testes + cobertura, build, validação do pacote e exemplo
```

Convenções de contribuição em [CLAUDE.md](./CLAUDE.md); plano e decisões em
[docs/PLAN.md](./docs/PLAN.md).

## Licença

MIT
