# core-kernel-check

Verificador, com o type checker do TypeScript, dos padrões do
[core-kernel](https://github.com/macndesign/core-kernel) que **compilam mas estão errados**.
Feito para o CI e para o hook do plugin do Claude Code, que devolve os achados ao agente a cada
arquivo editado.

```bash
bun add -d core-kernel-check   # ou npm i -D core-kernel-check
bunx core-kernel-check          # projeto inteiro (tsconfig mais próximo)
bunx core-kernel-check src/rotas/pedidos.ts --json
```

Sai com 1 quando há achados (2 em erro de uso ou tsconfig ausente).

## Regras

As regras usam tipos, não nomes de pasta: reconhecem as classes do core-kernel (e subclasses,
como `PedidoId extends UniqueId`) pela origem da declaração.

| Id | Detecta | Em vez disso | Skill |
|---|---|---|---|
| CK001 | Id tipado passado a um parâmetro `any`/`unknown` (ex.: `pool.query(sql, [pedido.id])`): o driver grava `"abc"`, com aspas | `pedido.id.value` | `ddd-repository` |
| CK002 | `AppError` tratado como texto: `String(err)`, `` `${err}` ``, `err.message.includes(...)`, `err.message === ...` | `error.code` / `error.kind` | `ddd-result-errors` |
| CK003 | `try/catch` em volta de `await useCase.execute()`: `execute` nunca rejeita | tratar `result.error` (exceção original em `error.cause`) | `ddd-use-case` |
| CK004 | `throw` no domínio (`Entity`, `AggregateRoot`, `ValueObject`) ou no `handle` de um `BaseUseCase` | `Result.fail(...)` | `ddd-result-errors` |
| CK005 | `new Date()` / `Date.now()` nesses mesmos lugares | `agora` por parâmetro, `Clock` no use case | `ddd-entity` |
| CK006 | `.unwrap()` nesses mesmos lugares | `if (r.isFail()) return r;` | `ddd-result-errors` |
| CK007 | `result.map(cb)` com `cb` sem retorno (efeito colateral) | retorno antecipado | `ddd-result-errors` |
| CK008 | `instanceof` de erros do core-kernel (falha entre cópias ESM e CJS) | `error.kind` / `isAppError` | `ddd-result-errors` |

Fora do domínio e do `handle` (adapters, mappers, testes), `throw`, `new Date()` e `unwrap()`
são permitidos.

## Suprimir um achado

Na linha anterior (ou na mesma), com motivo obrigatório. Sem motivo, vira o achado CK000.

```ts
// core-kernel-check-ignore CK001: o logger serializa com toJSON
logger.info(pedido.id);
```

## Hook do Claude Code

O plugin do core-kernel já configura o hook. Para usar sem o plugin, em `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [{ "type": "command", "command": "npx core-kernel-check --hook", "timeout": 60 }]
      }
    ]
  }
}
```

Com `--hook`, lê o evento no stdin, analisa só o arquivo editado (`.ts`/`.tsx` dentro do
projeto) e, se houver achados, imprime no stderr e sai com 2: o Claude Code devolve o texto ao
agente. Qualquer erro interno sai com 0, para nunca travar o agente.

## API

```ts
import { check } from "core-kernel-check";

const findings = check({ files: ["src/a.ts"], project: "tsconfig.json" });
// [{ rule: "CK001", file, line, column, message, skill }]
```

Requer o `core-kernel` instalado no projeto (`peerDependency`). Traz o próprio TypeScript 5.9
(a API de compilador do TypeScript 7 não é estável), que analisa normalmente código escrito
para versões mais novas.
