---
"core-kernel": minor
---

Recursos para agentes de IA além das skills:

- **Plugin do Claude Code** no próprio pacote (`.claude-plugin/plugin.json`, `skills/`, `agents/`, `hooks/`), com marketplace no repositório: `claude plugin marketplace add macndesign/core-kernel` e `claude plugin install core-kernel@core-kernel`. O hook `PostToolUse` roda o `core-kernel-check` (se instalado no projeto) a cada arquivo editado e devolve os achados ao agente; o `SessionStart` informa a versão do core-kernel, skills desatualizadas e o checker ausente.
- **Agentes** `ddd-architect` (modela antes de codar), `ddd-reviewer` (revisa diffs, roda o checker) e `core-kernel-migrator` (migra projetos para o core-kernel), instaláveis com `bunx core-kernel agents add` em `.claude/agents` (Claude Code) e `.codex/agents` (Codex, gerados em TOML). Comandos `agents list|add|update|check`, com o mesmo lock das skills.
- **Skill `ddd-migration`**: playbook de migração com os riscos que compilam (id tipado no SQL, erro decidido pelo texto, `try/catch` em volta de `execute()`) e o roteiro do teste de ponta a ponta.
