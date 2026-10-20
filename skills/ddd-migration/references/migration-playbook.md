# Migração para o core-kernel: playbook

## 1. Tabela de mapeamento

Monte esta tabela para o projeto antes de mexer no código. A coluna da direita é sempre do
core-kernel; o que não tiver equivalente fica no projeto.

| Bloco próprio (típico) | core-kernel | Atenção |
|---|---|---|
| `Result<T>` com `isSuccess`/`getValue()` | `Result<T, E>` (`isOk()`/`isFail()`, `value`/`error` só depois do narrowing) | `Fail` não carrega o tipo de sucesso: `if (r.isFail()) return r;` propaga |
| `Result.fail("texto")` | `Result.fail(new ValidationError(...))` etc. | Erro é objeto com `code` e `kind`, não string |
| `DomainError`, `AppException` | `AppError` e subclasses (`ValidationError`, `NotFoundError`, `ConflictError`, `ForbiddenError`, `UnexpectedError`) | Decidir por `code`/`kind`, nunca pela mensagem |
| `Entity` com `id: string` | `Entity<Props, XxxId>` com `XxxId extends UniqueId` | `entity.id` passa a ser **objeto**: `.value` nas bordas |
| `ValueObject` próprio | `ValueObject<T>` | `value` é imutável (congelado) |
| `UseCase.execute` que lança | `BaseUseCase` + `handle` | `execute` **nunca rejeita**: exceção vira `UnexpectedError` com `cause` |
| `new Date()` no domínio | `Clock` (`systemClock`, `FixedClock` nos testes) | O use case lê o relógio e passa `agora` ao domínio |
| Repositório genérico `save` | ports segregadas (`CreateRepository`, `UpdateRepository`, ...) | `findById` devolve `T \| null`; falha de infra lança |

Decisões que são do usuário (pergunte, não presuma): idioma dos códigos de erro, se os use
cases devolvem entidades ou DTOs, e se o contrato HTTP (corpo de erro) pode mudar.

## 2. Riscos que compilam

O `tsc` não acusa nenhum destes. O `core-kernel-check` acusa os marcados com o código da regra.

### CK001: id tipado no parâmetro do driver

O `pg` (e outros drivers) aceita `any[]`. O id tipado vai inteiro, é serializado com
`JSON.stringify` e o banco grava `"abc"`, **com as aspas**. Consultas por id param de achar.

```ts nocheck
// Antes (compila e grava errado)
await db.query("insert into pedidos (id) values ($1)", [pedido.id]);
```

```ts
// file: pedido.ts
import { UniqueId } from "core-kernel";

export class PedidoId extends UniqueId {
  declare private readonly __brand: "PedidoId";
}

export interface Pedido {
  id: PedidoId;
  total: number;
}

/** O client de banco do projeto (pg, postgres.js, PGlite...): parâmetros sem tipo. */
export interface Db {
  query(sql: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}
```

```ts
// file: pedido.repository.ts
import type { Db, Pedido, PedidoId } from "./pedido.js";

// Depois: sempre `.value` na fronteira com o banco.
export async function inserir(db: Db, pedido: Pedido): Promise<void> {
  await db.query("insert into pedidos (id, total) values ($1, $2)", [
    pedido.id.value,
    pedido.total,
  ]);
}

export async function existe(db: Db, id: PedidoId): Promise<boolean> {
  const { rows } = await db.query("select 1 from pedidos where id = $1", [id.value]);
  return rows.length > 0;
}
```

Também quebra em silêncio: comparar id com `===` (`pedido.id === input.id` é sempre `false`
entre objeto e string, ou entre duas instâncias). Use `a.equals(b)` ou compare `.value`.

### CK002: status HTTP pelo texto do erro

```ts nocheck
// Antes: a mensagem mudou na migração e 403/409 viraram 400.
if (String(error).startsWith("Forbidden")) return res.status(403);
if (error.message.includes("já existe")) return res.status(409);
```

```ts
// file: http.ts
import type { AppError, ErrorKind } from "core-kernel";

const STATUS: Record<ErrorKind, number> = {
  validation: 400,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unexpected: 500,
};

/** Depois: status pelo `kind`; o corpo mantém `error` (texto) e ganha `code`. */
export function respostaDeErro(error: AppError): { status: number; body: object } {
  return { status: STATUS[error.kind], body: { error: error.message, code: error.code } };
}
```

Se o frontend lê o corpo antigo, mantenha os campos que ele usa e **acrescente** `code`.

### CK003: try/catch em volta de `execute()`

```ts nocheck
// Antes: a ideia era pegar a violação de FK do Postgres. O catch nunca roda.
try {
  const result = await criarPedido.execute(input);
} catch (e) {
  if (e.code === "23503") return res.status(404);
}
```

O `BaseUseCase` converte qualquer exceção do `handle` (inclusive a do driver) em
`Result.fail(UnexpectedError)` com a exceção original em `error.cause`. Trate o resultado:

```ts
// file: codigo-postgres.ts
import type { AppError } from "core-kernel";

/** Código SQLSTATE do Postgres guardado em `cause` (ex.: "23503", violação de FK). */
export function codigoPostgres(error: AppError): string | undefined {
  const cause = error.cause;
  if (typeof cause !== "object" || cause === null || !("code" in cause)) return undefined;
  return typeof cause.code === "string" ? cause.code : undefined;
}
```

Melhor ainda: verificar a existência no use case (`findById` → `NotFoundError`) e deixar o
`23503` só como rede de segurança.

### CK004–CK006: `throw`, relógio e `unwrap()` no domínio

Falha esperada é `Result.fail(...)`; o relógio vem de um `Clock`; `unwrap()` só em testes,
mappers e adapters. Ver as skills `ddd-result-errors` e `ddd-entity`.

### CK007: `map` com efeito colateral

```ts nocheck
// Antes: map usado como "if ok, faça".
resultado.map((pedido) => { fila.push(pedido); });
```

Depois: retorno antecipado (`if (resultado.isFail()) return resultado;`) e o efeito em seguida.

### CK008: `instanceof` de erros

Um projeto pode carregar a cópia ESM e a CJS do core-kernel ao mesmo tempo; `instanceof`
falha entre elas. Use `error.kind`, `error.code` ou `isAppError(x)`.

## 3. Prova de ponta a ponta

Testes unitários com repositórios em memória não pegam CK001. Antes de dar a migração por
concluída:

1. Suba um banco descartável com o schema real (PGlite em processo, SQLite em memória ou um
   container).
2. Rode os fluxos principais pela borda (HTTP ou CLI): criar, buscar por id, a transição mais
   importante, um erro de cada `kind`.
3. Inspecione os dados gravados: nenhum id com aspas (`select id from x where id like '"%'`),
   datas no formato esperado.
4. Confira os status HTTP e o corpo de erro contra o contrato anterior.

## 4. Checklist final

- [ ] `tsc --noEmit` sem erros e os blocos antigos apagados (sem reexport de compatibilidade).
- [ ] `bunx core-kernel-check` sem achados (ou com supressões justificadas).
- [ ] Nenhuma comparação de id com `===`; nenhum `new Date()` no domínio.
- [ ] Teste de ponta a ponta passando e dados gravados conferidos.
- [ ] Contrato externo (HTTP, eventos) igual ao anterior, ou mudança aprovada pelo usuário.
