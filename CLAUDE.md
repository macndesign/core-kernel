# CLAUDE.md

Contexto e convenções para quem **mantém** o `core-kernel`.

## O que é

Biblioteca base de DDD / Clean Architecture para Bun e Node: `Result`, erros, `Entity`,
`ValueObject`, `AggregateRoot`, `UseCase`, ports de repositório, VOs comuns e kit de testes.
Outras bibliotecas de domínio e aplicações (web, mobile, CLI, backend) a usam como fundação.
O plano de implementação, com as fases e decisões, está em [docs/PLAN.md](./docs/PLAN.md).
Atualize os checkboxes de lá ao concluir uma fase.

## Regras inegociáveis

- **Zero dependências de runtime.** `dependencies` fica vazio. Nada de `uuid` e afins: use APIs
  padrão (`crypto.randomUUID()`).
- **Agnóstica de runtime.** O código em `src/` (fora de `__tests__`) não usa `Bun.*`, `node:*`
  nem APIs de DOM. Os builds compilam com `types: []` e `lib: ["ES2022"]` justamente para
  falhar se algo assim escapar.
- **Regra de negócio nunca lança exceção.** Falha esperada é `Result.fail(...)`. `throw` só
  para uso indevido da API (ex.: `unwrap()` num `Fail`).
- **Sem `instanceof` em checagens internas.** Use *brands* com `Symbol.for("core-kernel/<tipo>")`.
  Um consumidor pode carregar a cópia ESM e a CJS ao mesmo tempo (dual package hazard).
- **Sem abstrações especulativas.** Só entra o que tem consumidor real (shift-swap, pharmacore).

## Estrutura e nomenclatura

- Ver a seção 3 de `docs/PLAN.md`. Testes em `__tests__/` ao lado do código.
- Arquivos em kebab-case com sufixo do tipo (`*.vo.ts`, `*.entity.ts`, `*.usecase.ts`).
- API, nomes e códigos de erro em **inglês**. Comentários e docs internas podem ser em português.
- **Imports relativos sempre com extensão `.js`** (`import { Result } from "../result/index.js"`).
  O projeto usa `module: NodeNext` e o build não passa por bundler, então o `.js` é obrigatório
  para o ESM funcionar no Node.

## Superfície pública

Cada subpath tem um `index.ts` que é o contrato público:

| Import | Arquivo |
|---|---|
| `core-kernel` | `src/index.ts` |
| `core-kernel/vo` | `src/vo/index.ts` |
| `core-kernel/vo/br` | `src/vo/br/index.ts` |
| `core-kernel/testing` | `src/testing/index.ts` |

Ao criar um subpath novo, atualize ao mesmo tempo:
1. `exports` no `package.json`
2. `scripts/smoke.mjs` e `scripts/smoke.cjs`
3. `src/__tests__/entrypoints.test.ts`

Mudança incompatível na API pública é *breaking change* (SemVer). Quando as skills de
`skills/` existirem (Fase 8b), elas devem ser atualizadas no mesmo PR que muda a API.

## Build

`scripts/build.ts` roda o `tsc` duas vezes (`tsconfig.esm.json` → `dist/esm`,
`tsconfig.cjs.json` → `dist/cjs`) e grava `dist/cjs/package.json` com `"type": "commonjs"`.
Não há bundler **de propósito**: emitir um arquivo por módulo mantém cada classe única por
formato, mesmo quando importada por subpaths diferentes. Não troque por `bun build` sem
resolver isso.

## Testes

- `bun:test` com TDD: escreva o teste, veja falhar e depois implemente.
- Cobertura mínima de 95% das linhas (`bunfig.toml`). O `test:coverage` falha abaixo disso.
- Para garantias de tipo (ex.: não dá para ler `.value` sem narrowing), use `// @ts-expect-error`
  nos testes. O `typecheck` valida.
- O limite de cobertura vale só para **linhas** (`bunfig.toml`). A métrica de funções do Bun
  tem falsos negativos (construtores implícitos, inicializadores de campo); não escreva código
  artificial para satisfazê-la.
- Asserções de promise precisam de `await` (`await expect(p).rejects...`); sem ele o teste
  termina antes e passa mesmo se a asserção falhar.
- Em `it.each` com arrays, embrulhe cada linha numa tupla (`[[[]], [[1]]]`): o Bun espalha
  arrays como argumentos.

## Comandos

```bash
bun run verify          # tudo que o CI roda: lint, typecheck, testes+coverage, build, check:package
bun run lint:fix        # Biome corrige formatação/lint
bun run check:package   # publint + attw + smoke test ESM/CJS do pacote (requer build)
```

Neste ambiente, `tsc` global falha com uma mensagem enganosa. Use os scripts do
`package.json` ou `./node_modules/.bin/tsc`.

Os git hooks (`simple-git-hooks` + `lint-staged`) são instalados pelo script `prepare`. Não use
`postinstall`: ele vai junto no pacote publicado e quebraria o `npm install` de quem consome a lib.
