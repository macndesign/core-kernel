# core-kernel-check

## 0.1.0-beta.0

### Minor Changes

- c5982f9: Primeira versão do `core-kernel-check`: verificador com o type checker do TypeScript para os padrões do core-kernel que compilam mas estão errados (CK001 id tipado em parâmetro sem tipo, CK002 erro decidido pelo texto, CK003 `try/catch` em volta de `execute()`, CK004–CK006 `throw`/relógio/`unwrap()` no domínio, CK007 `map` sem retorno, CK008 `instanceof` de erros). CLI com `--json` para o CI e `--hook` para o `PostToolUse` do Claude Code.

### Patch Changes

- Updated dependencies [c862b79]
- Updated dependencies [c5982f9]
  - core-kernel@0.3.0-beta.0
