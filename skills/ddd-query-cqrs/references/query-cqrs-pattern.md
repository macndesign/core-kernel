# Query / CQRS: padrões

## Port de query e DTOs

```ts
// file: customer.queries.ts
import type { PaginatedInputDTO, PaginatedResultDTO } from "core-kernel";

export interface CustomerListItemDTO {
  id: string;
  name: string;
  email: string;
}

export interface CustomerDetailsDTO extends CustomerListItemDTO {
  orderCount: number;
  lastOrderAt: string | null;
}

export interface ListCustomersInput extends PaginatedInputDTO {
  search?: string;
}

/** Leitura: devolve DTOs prontos para a tela. Não-encontrado é null. */
export interface CustomerQueries {
  list(input: ListCustomersInput): Promise<PaginatedResultDTO<CustomerListItemDTO>>;
  findDetailsById(id: string): Promise<CustomerDetailsDTO | null>;
}
```

## Use cases de leitura

```ts
// file: list-customers.usecase.ts
import { BaseUseCase, type PaginatedResultDTO, Result, type ValidationError, validatePagination } from "core-kernel";
import type { CustomerListItemDTO, CustomerQueries, ListCustomersInput } from "./customer.queries.js";

type Output = PaginatedResultDTO<CustomerListItemDTO>;

export class ListCustomersUseCase extends BaseUseCase<ListCustomersInput, Output, ValidationError> {
  constructor(private readonly queries: Pick<CustomerQueries, "list">) {
    super();
  }

  protected async handle(input: ListCustomersInput): Promise<Result<Output, ValidationError>> {
    const valid = validatePagination(input, { maxPageSize: 50 });
    if (valid.isFail()) return valid;
    const search = input.search?.trim();
    const { page, pageSize } = valid.value;
    return Result.ok(await this.queries.list(search ? { page, pageSize, search } : { page, pageSize }));
  }
}
```

```ts
// file: get-customer-details.usecase.ts
import { BaseUseCase, NotFoundError, Result } from "core-kernel";
import type { CustomerDetailsDTO, CustomerQueries } from "./customer.queries.js";

export class GetCustomerDetailsUseCase extends BaseUseCase<{ customerId: string }, CustomerDetailsDTO, NotFoundError> {
  constructor(private readonly queries: Pick<CustomerQueries, "findDetailsById">) {
    super();
  }

  protected async handle({ customerId }: { customerId: string }): Promise<Result<CustomerDetailsDTO, NotFoundError>> {
    const details = await this.queries.findDetailsById(customerId);
    if (!details) return Result.fail(new NotFoundError("Customer not found", { code: "CUSTOMER_NOT_FOUND" }));
    return Result.ok(details);
  }
}
```

## Adapter em memória (testes) — o real usa SQL/ORM com joins

```ts
// file: in-memory-customer.queries.ts
import { toPaginatedResult } from "core-kernel";
import type { CustomerDetailsDTO, CustomerQueries, ListCustomersInput } from "./customer.queries.js";

export class InMemoryCustomerQueries implements CustomerQueries {
  constructor(private readonly rows: CustomerDetailsDTO[] = []) {}

  async list({ page, pageSize, search }: ListCustomersInput) {
    const term = search?.toLowerCase();
    const matching = this.rows.filter((row) => !term || row.name.toLowerCase().includes(term));
    const data = matching
      .slice((page - 1) * pageSize, page * pageSize)
      .map(({ id, name, email }) => ({ id, name, email }));
    return toPaginatedResult(data, matching.length, { page, pageSize });
  }

  async findDetailsById(id: string) {
    return this.rows.find((row) => row.id === id) ?? null;
  }
}
```

## Testes

```ts
// file: customer-queries.test.ts
import { describe, expect, it } from "bun:test";
import { assertFail, assertOk } from "core-kernel/testing";
import { GetCustomerDetailsUseCase } from "./get-customer-details.usecase.js";
import { InMemoryCustomerQueries } from "./in-memory-customer.queries.js";
import { ListCustomersUseCase } from "./list-customers.usecase.js";

const rows = ["Ana", "Bruno", "Bianca"].map((name, i) => ({
  id: `c-${i + 1}`,
  name,
  email: `${name.toLowerCase()}@example.com`,
  orderCount: i,
  lastOrderAt: null,
}));

describe("ListCustomersUseCase", () => {
  it("pagina e filtra", async () => {
    const result = await new ListCustomersUseCase(new InMemoryCustomerQueries(rows)).execute({
      page: 1,
      pageSize: 1,
      search: " b ",
    });

    assertOk(result);
    expect(result.value.data.map((c) => c.name)).toEqual(["Bruno"]);
    expect(result.value.meta).toEqual({ page: 1, pageSize: 1, total: 2, totalPages: 2 });
  });

  it("rejeita página inválida", async () => {
    const useCase = new ListCustomersUseCase(new InMemoryCustomerQueries(rows));

    assertFail(await useCase.execute({ page: 0, pageSize: 10 }), "TOO_SMALL");
    assertFail(await useCase.execute({ page: 1, pageSize: 51 }), "TOO_LARGE");
  });
});

describe("GetCustomerDetailsUseCase", () => {
  it("devolve o DTO ou CUSTOMER_NOT_FOUND", async () => {
    const useCase = new GetCustomerDetailsUseCase(new InMemoryCustomerQueries(rows));

    assertOk(await useCase.execute({ customerId: "c-2" }));
    assertFail(await useCase.execute({ customerId: "c-9" }), "CUSTOMER_NOT_FOUND");
  });
});
```

## Checklist

- [ ] É leitura pura (nada é alterado).
- [ ] Port de query no core devolvendo DTOs; `findDetailsById` (não `findById`).
- [ ] Use case valida paginação/filtros e delega.
- [ ] `null` → `NotFoundError` no use case.
- [ ] `PaginatedResultDTO` montado com `toPaginatedResult`.
- [ ] Testes de paginação, filtro, vazio e not found.

## Armadilhas comuns

- Carregar agregados e convertê-los um a um para montar uma listagem (N+1, lento).
- Query que altera estado.
- Usar o repositório de escrita para telas e inflá-lo com `findAllWith...`.
- `pageSize` sem limite máximo.
