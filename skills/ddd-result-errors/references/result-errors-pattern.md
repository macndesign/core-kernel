# Result e erros: padrões

## API

```ts nocheck
type Result<T, E extends AppError = AppError> = Ok<T, E> | Fail<E>;

Result.ok(value) / Result.ok()            // Result<T, never> / Result<void, never>
Result.fail(error)                        // Result<never, E>
r.isOk() / r.isFail() / r.ok              // narrowing
r.map(fn)                                 // transforma o valor
r.flatMap(fn)                             // encadeia outra operação que devolve Result
r.mapError(fn)                            // transforma o erro
r.match({ ok, fail })                     // consome os dois casos
r.unwrapOr(fallback)                      // valor ou fallback
r.unwrap()                                // valor ou LANÇA o erro (testes/bordas)
Result.combine([a, b])                    // Result<[A, B], EA | EB>
Result.try(fn) / Result.tryAsync(fn)      // exceção → UnexpectedError (original em cause)
```

| Erro | `kind` | Quando |
|---|---|---|
| `ValidationError` | `validation` | entrada inválida; carrega `issues: { field?, code, message }[]` |
| `NotFoundError` | `not_found` | recurso procurado não existe |
| `ConflictError` | `conflict` | o estado atual não permite a operação (duplicado, transição inválida) |
| `ForbiddenError` | `forbidden` | quem pediu não tem permissão |
| `UnexpectedError` | `unexpected` | infraestrutura ou bug |

Todos aceitam `{ code?, details?, cause? }` e têm `toJSON()`.

## Propagação com retorno antecipado

```ts
// file: parse-quantity.ts
import { Result, ValidationError } from "core-kernel";

export function parseQuantity(raw: string): Result<number, ValidationError> {
  const quantity = Number(raw);
  if (!Number.isInteger(quantity) || quantity < 1) {
    return Result.fail(
      new ValidationError({ field: "quantity", code: "INVALID_QUANTITY", message: "quantity must be a positive integer" }),
    );
  }
  return Result.ok(quantity);
}
```

```ts
// file: reserve-stock.ts
import { ConflictError, Result, type ValidationError } from "core-kernel";
import { parseQuantity } from "./parse-quantity.js";

export function reserveStock(
  available: number,
  raw: string,
): Result<{ remaining: number }, ValidationError | ConflictError> {
  const quantity = parseQuantity(raw);
  if (quantity.isFail()) return quantity; // Fail<ValidationError> serve aqui, mesmo com outro T

  if (quantity.value > available) {
    return Result.fail(new ConflictError("Not enough stock", { code: "INSUFFICIENT_STOCK", details: { available } }));
  }
  return Result.ok({ remaining: available - quantity.value });
}
```

## Encadeamento funcional

Equivalente ao exemplo acima, útil para fluxos curtos:

```ts
// file: reserve-stock-chain.ts
import { ConflictError, Result } from "core-kernel";
import { parseQuantity } from "./parse-quantity.js";

export const reserveStockChain = (available: number, raw: string) =>
  parseQuantity(raw).flatMap((quantity) =>
    quantity > available
      ? Result.fail(new ConflictError("Not enough stock", { code: "INSUFFICIENT_STOCK" }))
      : Result.ok({ remaining: available - quantity }),
  );
```

## Validar vários campos de uma vez

`Result.combine` devolve a tupla tipada dos valores. Se todas as falhas forem de validação, junta
as issues num único `ValidationError` — a UI recebe todos os campos com problema de uma vez.

```ts
// file: signup-input.ts
import { Result, type ValidationError } from "core-kernel";
import { Email, StrongPassword, Text } from "core-kernel/vo";

export function parseSignup(input: { name: string; email: string; password: string }) {
  const fields = Result.combine([
    Text.create(input.name, { field: "name", maxLength: 120 }),
    Email.create(input.email),
    StrongPassword.create(input.password),
  ]);
  if (fields.isFail()) return fields;

  const [name, email, password] = fields.value;
  return Result.ok({ name, email, password }) satisfies Result<unknown, ValidationError>;
}
```

## Código de terceiros que lança

```ts
// file: parse-json.ts
import { Result, ValidationError } from "core-kernel";

/** Sem mapeador, a exceção vira UnexpectedError; aqui é entrada do usuário, então é validação. */
export const parsePayload = (raw: string) =>
  Result.try(
    () => JSON.parse(raw) as unknown,
    () => new ValidationError({ field: "body", code: "INVALID_JSON", message: "body is not valid JSON" }),
  );
```

## Mapeamento para HTTP (no adapter, fora do domínio)

```ts
// file: http-adapter.ts
import type { AppError, ErrorKind, Result } from "core-kernel";

const STATUS: Record<ErrorKind, number> = {
  validation: 422,
  not_found: 404,
  conflict: 409,
  forbidden: 403,
  unexpected: 500,
};

export function toHttp<T>(result: Result<T, AppError>): { status: number; body: unknown } {
  if (result.isOk()) return { status: 200, body: result.value };
  const { error } = result;
  // Não vaze detalhes internos de falhas inesperadas para o cliente.
  if (error.kind === "unexpected") return { status: 500, body: { code: error.code } };
  return { status: STATUS[error.kind], body: error.toJSON() };
}
```

## Checklist

- [ ] Nenhum `throw` para regra de negócio; falhas esperadas viram `Result.fail`.
- [ ] Tipo de retorno declara a união de erros possíveis.
- [ ] Cada erro tem `code` estável e específico.
- [ ] Propagação com `if (r.isFail()) return r;`.
- [ ] Validação de vários campos acumula issues (`combine`/`Guard.all`).
- [ ] `unwrap()` ausente do domínio e dos use cases.
- [ ] Mapeamento para protocolo (HTTP etc.) só no adapter.

## Armadilhas comuns

- `throw new Error("...")` dentro de entidade ou use case para regra de negócio.
- Ler `result.value` sem checar `isOk()` (o compilador impede; não force com cast).
- `Result.fail(new ValidationError(...))` para "não encontrado" ou "já existe" — use o tipo certo.
- Mensagem como contrato: a UI deve usar `code`, não comparar `message`.
- Devolver `UnexpectedError` com detalhes internos (stack, SQL) para o cliente.
