# Changesets

Cada mudança que afeta quem usa a lib ganha um arquivo aqui (`bun run changeset`), dizendo o
tipo de versão (patch/minor/major) e o que mudou. Na release, `bun run version` consome esses
arquivos, atualiza a versão do `package.json` e escreve o `CHANGELOG.md`.

Enquanto a lib estiver em 0.x, mudanças incompatíveis entram como **minor** (0.1 → 0.2).

Fluxo completo de release em `CLAUDE.md` (seção Release).
