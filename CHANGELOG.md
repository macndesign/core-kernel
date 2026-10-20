# core-kernel

## 0.3.0-beta.1

### Patch Changes

- Hook `Stop`: ao fim de cada turno do agente, o `core-kernel-check --hook` analisa os `.ts` alterados ou novos segundo o git e, se houver achados, faz o agente corrigir antes de encerrar. Cobre as edições que o `PostToolUse` (`Edit`/`Write`) não vê, como as feitas por Bash (`sed`, heredoc, scripts), que foi o que aconteceu no teste com a API de exemplo. O plugin do core-kernel já registra o novo hook.

## 0.3.0-beta.0

### Minor Changes

- c5982f9: Recursos para agentes de IA além das skills:
  
  - **Plugin do Claude Code** no próprio pacote (`.claude-plugin/plugin.json`, `skills/`, `agents/`, `hooks/`), com marketplace no repositório: `claude plugin marketplace add macndesign/core-kernel` e `claude plugin install core-kernel@core-kernel`. O hook `PostToolUse` roda o `core-kernel-check` (se instalado no projeto) a cada arquivo editado e devolve os achados ao agente; o `SessionStart` informa a versão do core-kernel, skills desatualizadas e o checker ausente.
  - **Agentes** `ddd-architect` (modela antes de codar), `ddd-reviewer` (revisa diffs, roda o checker) e `core-kernel-migrator` (migra projetos para o core-kernel), instaláveis com `bunx core-kernel agents add` em `.claude/agents` (Claude Code) e `.codex/agents` (Codex, gerados em TOML). Comandos `agents list|add|update|check`, com o mesmo lock das skills.
  - **Skill `ddd-migration`**: playbook de migração com os riscos que compilam (id tipado no SQL, erro decidido pelo texto, `try/catch` em volta de `execute()`) e o roteiro do teste de ponta a ponta.

### Patch Changes

- c862b79: Documentação: seção "Publicando uma lib sobre o core-kernel" no README (peerDependency, core-kernel externo no build, tipos com NodeNext e imports `.js`, validação com attw e `npm pack`) e a regra correspondente no `llms.txt` para assistentes.

## 0.2.0

### Minor Changes

- 3199cd9: Ajustes revelados pela migração do shift-swap (todos compatíveis com a 0.1):
  
  - VOs prontos (`Email`, `Text`, `Url`, `Money`, `DateRange`, `StrongPassword`, `Cpf`, `Cnpj`) aceitam `errors` para trocar o código e/ou a mensagem de cada issue, indexado pelo código padrão — útil para códigos e mensagens no idioma do projeto. Cada VO exporta o tipo com seus códigos (`EmailErrorCode`, `TextErrorCode`...).
  - `DateRange.create` aceita `{ field, errors }`; `field` prefixa as issues (`periodo.start`).
  - `UniqueId.from(raw, { field, code, message })` permite personalizar a issue de id vazio (antes fixa em `field: "id"`, `code: "INVALID_ID"`).
  - Skills e `llms.txt`: o padrão `result.map(() => { efeito })` foi trocado por retorno antecipado, porque reprova no lint `useIterableCallbackReturn` do Biome; o `check:skills` agora também roda o lint nos blocos de exemplo.

## 0.1.0

### Minor Changes

- e46450a: Primeira versão funcional da lib.
  
  - `Result<T, E>` com erros tipados (`ValidationError`, `NotFoundError`, `ConflictError`, `ForbiddenError`, `UnexpectedError`), `combine` que agrega issues de validação, `try`/`tryAsync`, e propagação de falhas com `if (r.isFail()) return r;`.
  - `Guard` com validações reutilizáveis e códigos de erro estáveis.
  - `ValueObject`, `UniqueId` (ids tipados), `Entity`, `AggregateRoot` e eventos de domínio.
  - `UseCase`/`BaseUseCase`, ports de repositório segregadas, `Clock`, `DomainEventPublisher`, `Mapper` e DTOs de paginação.
  - `core-kernel/vo`: `Email`, `Text`, `Url`, `Money`, `DateRange`, `StrongPassword`.
  - `core-kernel/vo/br`: `Cpf` e `Cnpj` (numérico e alfanumérico, IN RFB 2.229/2024).
  - `core-kernel/testing`: `InMemoryRepository`, `FixedClock`, `SequentialIdGenerator`, `InMemoryEventPublisher`, `assertOk`/`assertFail`.
  - 10 skills para assistentes de código e o CLI `core-kernel skills add|update|check|list`.
  - `llms.txt` com o resumo da API para LLMs.

## 0.1.0-beta.0

Pré-release com o mesmo conteúdo da 0.1.0, usada para validar o fluxo de publicação.
