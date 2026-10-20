---
"core-kernel-check": minor
"core-kernel": patch
---

Hook `Stop`: ao fim de cada turno do agente, o `core-kernel-check --hook` analisa os `.ts` alterados ou novos segundo o git e, se houver achados, faz o agente corrigir antes de encerrar. Cobre as edições que o `PostToolUse` (`Edit`/`Write`) não vê, como as feitas por Bash (`sed`, heredoc, scripts), que foi o que aconteceu no teste com a API de exemplo. O plugin do core-kernel já registra o novo hook.
