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

## Skills e CLI (`skills/`, `cli/`, `llms.txt`)

- `skills/<nome>/` é publicado no pacote e instalado nos projetos consumidores pelo CLI
  (`bunx core-kernel skills add`). Cada skill: `SKILL.md` (frontmatter `name` = pasta,
  `description` com os gatilhos), `references/*.md` com os padrões e exemplos, e
  `agents/openai.yaml` (metadados do Codex). Skills para quem **mantém** a lib ficam em
  `.claude/skills/`, que não é publicado.
- **Toda mudança na API pública atualiza as skills e o `llms.txt` no mesmo PR.**
- Exemplos nas references e no `llms.txt` são código real: `bun run check:skills` compila
  todo bloco ```ts contra o pacote buildado e roda os blocos de teste. Convenções:
  `// file: nome.ts` na primeira linha nomeia o arquivo (blocos do mesmo documento se
  importam); ```ts nocheck marca pseudocódigo/assinaturas.
- `cli/` usa `node:fs` e por isso fica **fora** de `src/` (que é agnóstico de runtime), com
  build próprio (`tsconfig.cli.json`, só ESM) e testes em `cli/__tests__/`. Mensagens do CLI em
  português.

## Build

`scripts/build.ts` roda o `tsc` para a lib duas vezes (`tsconfig.esm.json` → `dist/esm`,
`tsconfig.cjs.json` → `dist/cjs`) e uma para o CLI (`tsconfig.cli.json` → `dist/cli`) e grava `dist/cjs/package.json` com `"type": "commonjs"`.
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

## Release (Changesets)

1. **Todo PR com mudança visível para quem usa a lib** inclui um changeset: `bun run changeset`
   (ou um arquivo `.changeset/<nome>.md` com o frontmatter `"core-kernel": patch|minor`).
   Em 0.x, mudança incompatível é **minor**.
2. Para lançar: `bun run version-packages` aplica os changesets, atualiza a versão e o
   `CHANGELOG.md`. Commit: `chore: release vX.Y.Z`.
3. `git tag vX.Y.Z && git push origin main --tags` → o `publish.yml` confere se a tag bate com
   o `package.json`, roda o `verify` e publica com provenance. Prerelease (`-beta.N`) vai
   para a dist-tag `beta`, nunca para `latest`. Requer o secret `NPM_TOKEN` no GitHub.

Modo pré-release: enquanto `.changeset/pre.json` existir, as versões saem como `-beta.N`, e os
changesets consumidos ficam em `.changeset/pre/` (vão para o git). Para a versão estável:
`bunx changeset pre exit` e depois `bun run version-packages`.

Nunca envie uma tag de versão já publicada (ex.: `v0.0.0`, publicada manualmente).

## Comandos

```bash
bun run verify          # lint, typecheck, testes+coverage, build, check:package, check:examples, check:skills
bun run lint:fix        # Biome corrige formatação/lint
bun run check:package   # publint + attw + smoke ESM/CJS + smoke do CLI (requer build)
bun run check:skills    # frontmatter + blocos de código das skills/llms.txt (requer build)
```

Neste ambiente, `tsc` global falha com uma mensagem enganosa. Use os scripts do
`package.json` ou `./node_modules/.bin/tsc`.

Os git hooks (`simple-git-hooks` + `lint-staged`) são instalados pelo script `prepare`. Não use
`postinstall`: ele vai junto no pacote publicado e quebraria o `npm install` de quem consome a lib.
