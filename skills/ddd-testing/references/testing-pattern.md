# Testes: padrões

Código testado nos exemplos — uma conta com saldo e um use case de saque:

```ts
// file: account.ts
import {
  AggregateRoot,
  ConflictError,
  createDomainEvent,
  type DomainEvent,
  Result,
  UniqueId,
  ValidationError,
} from "core-kernel";
import type { Money } from "core-kernel/vo";

export class AccountId extends UniqueId {
  declare private readonly __brand: "AccountId";
}

type Withdrawn = DomainEvent<"account.withdrawn", { amount: number }>;

export interface AccountProps {
  ownerId: string;
  balance: Money;
}

export class Account extends AggregateRoot<AccountProps, AccountId, Withdrawn> {
  private constructor(props: AccountProps, id: AccountId) {
    super(props, id);
  }

  static open(ownerId: string, balance: Money): Account {
    return new Account({ ownerId, balance }, AccountId.generate());
  }

  get ownerId(): string {
    return this.props.ownerId;
  }

  get balance(): Money {
    return this.props.balance;
  }

  withdraw(amount: Money, now: Date): Result<void, ValidationError | ConflictError> {
    if (!amount.isPositive()) {
      return Result.fail(new ValidationError({ field: "amount", code: "INVALID_AMOUNT", message: "amount must be positive" }));
    }
    const next = this.props.balance.subtract(amount);
    if (next.isFail() || next.value.isNegative()) {
      return Result.fail(new ConflictError("Insufficient funds", { code: "INSUFFICIENT_FUNDS" }));
    }
    this.props.balance = next.value;
    this.addDomainEvent(
      createDomainEvent({ name: "account.withdrawn", aggregateId: this.id.value, occurredAt: now, payload: { amount: amount.amount } }),
    );
    return Result.ok();
  }
}
```

```ts
// file: withdraw.usecase.ts
import {
  BaseUseCase,
  type Clock,
  type ConflictError,
  type DomainEventPublisher,
  type FindByIdRepository,
  NotFoundError,
  Result,
  type UpdateRepository,
  type ValidationError,
} from "core-kernel";
import { Money } from "core-kernel/vo";
import { type Account, AccountId } from "./account.js";

type Input = { accountId: string; amount: number };
type WithdrawError = ValidationError | NotFoundError | ConflictError;

export class WithdrawUseCase extends BaseUseCase<Input, { balance: number }, WithdrawError> {
  constructor(
    private readonly accounts: FindByIdRepository<Account> & UpdateRepository<Account>,
    private readonly events: DomainEventPublisher,
    private readonly clock: Clock,
  ) {
    super();
  }

  protected async handle(input: Input): Promise<Result<{ balance: number }, WithdrawError>> {
    const fields = Result.combine([AccountId.from(input.accountId), Money.fromDecimal(input.amount, "BRL", { field: "amount" })]);
    if (fields.isFail()) return fields;
    const [id, amount] = fields.value;

    const account = await this.accounts.findById(id);
    if (!account) return Result.fail(new NotFoundError("Account not found", { code: "ACCOUNT_NOT_FOUND" }));

    const withdrawn = account.withdraw(amount, this.clock.now());
    if (withdrawn.isFail()) return withdrawn;

    await this.accounts.update(account);
    await this.events.publish(account.pullDomainEvents());
    return Result.ok({ balance: account.balance.toDecimal() });
  }
}
```

## API do InMemoryRepository

| Membro | Uso |
|---|---|
| `new InMemoryRepository<T>(iniciais?)` | dados iniciais (sem as checagens do `create`) |
| `create` / `update` / `delete` / `findById` | contrato `CrudRepository`; `create` duplicado e `update` inexistente **lançam** (como um banco) |
| `items` / `size` | snapshot para asserções |
| `seed(...entidades)` / `clear()` | preparar/limpar dados no meio do teste |
| `failNext(error)` | a **próxima** operação lança `error` (simula queda do banco) |
| `protected find(pred)` / `filter(pred)` | base para queries próprias; respeitam `failNext` |
| `protected store` (`Map<id, T>`) + `throwPendingFailure()` | acesso direto; chame `throwPendingFailure()` para respeitar `failNext` |

## Repositório em memória com query própria

```ts
// file: in-memory-account.repository.ts
import { InMemoryRepository } from "core-kernel/testing";
import type { Account } from "./account.js";

export class InMemoryAccountRepository extends InMemoryRepository<Account> {
  async findByOwner(ownerId: string): Promise<Account[]> {
    return this.filter((account) => account.ownerId === ownerId); // respeita failNext
  }

  /** Lendo o store direto: chame throwPendingFailure() para respeitar failNext. */
  async countByOwner(ownerId: string): Promise<number> {
    this.throwPendingFailure();
    return [...this.store.values()].filter((account) => account.ownerId === ownerId).length;
  }
}
```

## Teste de use case com createSut

```ts
// file: withdraw.usecase.test.ts
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  assertFail,
  assertOk,
  FixedClock,
  InMemoryEventPublisher,
  SequentialIdGenerator,
} from "core-kernel/testing";
import { Money } from "core-kernel/vo";
import { Account } from "./account.js";
import { InMemoryAccountRepository } from "./in-memory-account.repository.js";
import { WithdrawUseCase } from "./withdraw.usecase.js";

let restoreIds: () => void;
beforeEach(() => {
  restoreIds = new SequentialIdGenerator("acc").install();
});
afterEach(() => restoreIds()); // sempre restaurar o gerador global

const createSut = (balanceCents = 10_000) => {
  const account = Account.open("owner-1", Money.create({ amount: balanceCents, currency: "BRL" }).unwrap());
  const accounts = new InMemoryAccountRepository([account]);
  const events = new InMemoryEventPublisher();
  const clock = new FixedClock("2026-01-01T10:00:00Z");
  return { account, accounts, events, clock, useCase: new WithdrawUseCase(accounts, events, clock) };
};

describe("WithdrawUseCase", () => {
  it("debita, persiste e publica o evento", async () => {
    const { account, events, useCase } = createSut();

    const result = await useCase.execute({ accountId: account.id.value, amount: 25.5 });

    assertOk(result);
    expect(result.value.balance).toBe(74.5);
    expect(events.published.map((e) => [e.name, e.payload, e.occurredAt.toISOString()])).toEqual([
      ["account.withdrawn", { amount: 2550 }, "2026-01-01T10:00:00.000Z"],
    ]);
  });

  it("ids previsíveis (o id de evento também consome a sequência)", () => {
    expect(createSut().account.id.value).toBe("acc-1");
  });

  it.each([
    [{ accountId: "", amount: 1 }, "INVALID_ID"],
    [{ accountId: "acc-1", amount: 0.001 }, "INVALID_AMOUNT"], // arredonda para 0 centavos
    [{ accountId: "acc-9", amount: 1 }, "ACCOUNT_NOT_FOUND"],
    [{ accountId: "acc-1", amount: 1000 }, "INSUFFICIENT_FUNDS"],
  ])("%p → %p", async (input, code) => {
    const { useCase } = createSut();

    assertFail(await useCase.execute(input), code);
  });

  it("falha do banco vira UnexpectedError e nada é publicado", async () => {
    const { account, accounts, events, useCase } = createSut();
    accounts.failNext(new Error("connection refused"));

    assertFail(await useCase.execute({ accountId: account.id.value, amount: 1 }), "UNEXPECTED");
    expect(events.published).toEqual([]);
  });

  it("repositório com query própria (e failNext também vale para ela)", async () => {
    const { accounts } = createSut();

    expect(await accounts.findByOwner("owner-1")).toHaveLength(1);
    accounts.failNext(new Error("db down"));
    await expect(accounts.countByOwner("owner-1")).rejects.toThrow("db down");
    expect(await accounts.countByOwner("owner-1")).toBe(1);
  });
});
```

## Relógio controlado

```ts
// file: clock.test.ts
import { expect, it } from "bun:test";
import { FixedClock } from "core-kernel/testing";

it("FixedClock parado até avançar", () => {
  const clock = new FixedClock("2026-01-01T00:00:00Z");
  clock.advance(15 * 60_000);

  expect(clock.now().toISOString()).toBe("2026-01-01T00:15:00.000Z");
});
```

## Checklist

- [ ] `createSut()` monta use case + dublês.
- [ ] Sucesso verifica retorno **e** efeitos (estado persistido, eventos).
- [ ] Cada falha esperada verificada pelo `code`.
- [ ] `failNext` cobre falha de infraestrutura.
- [ ] `SequentialIdGenerator` restaurado no `afterEach`.
- [ ] Nada de `new Date()`/aleatoriedade sem controle nos testes.

## Armadilhas comuns

- Verificar `message` em vez de `code`.
- Testar só o caminho feliz do use case.
- Assumir ids "adivinhados" com `SequentialIdGenerator` sem contar os ids de eventos.
- Mockar o domínio (entidades/VOs) em teste de use case: use os reais.
- Esquecer `await` em `expect(promise).rejects`.
