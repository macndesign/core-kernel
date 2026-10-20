# Evals do plugin

Os casos de `evals/` medem se o plugin do core-kernel (skills, agentes e hooks) faz um agente
escrever código melhor. O `claude plugin eval` roda cada caso **com** e **sem** o plugin e
reporta a diferença (Δ).

| Caso | Situação real que reproduz | Graders |
|---|---|---|
| `novo-agregado` | Domínio inédito (empréstimo de livros com limite e atraso) | regex: sem `new Date()` nem `throw` no agregado; llm: `Result`, ids tipados, `Clock`, `BaseUseCase`, testes com `core-kernel/testing` |
| `adapter-postgres` | Repositório com `pg` | regex: usa `.value`; llm: `.value` em **todo** parâmetro de SQL, `restore`, `null` quando não acha |
| `rota-http` | Mapear erros para HTTP no Express | regex: não decide pelo texto do erro; llm: status por `kind`, corpo com `error` + `code`, sem `try/catch` em volta de `execute()` |
| `migracao-result` | Migrar um use case com `Result` próprio | regex: sem `new Date()`; llm: `BaseUseCase`, erros tipados, id tipado, `Clock`, transição na entidade |

Os três primeiros reproduzem os bugs que apareceram na migração do backend piloto
(CK001–CK003 do `core-kernel-check`).

## Como rodar

Tem custo de API (cada caso roda `runs` vezes em cada braço), então não roda a cada push.

- **No GitHub:** workflow **Evals** (Actions → Evals → Run workflow), com teto de custo,
  número de execuções e filtro de casos. Requer o secret `ANTHROPIC_API_KEY`. O relatório sai
  como artifact.
- **Localmente (macOS/Linux):**

  ```bash
  claude plugin eval . --allow-tools Write Edit --max-cost-usd 10 --no-publish
  ```

  Um caso só, uma execução por braço: `--case rota-http --runs 1`.

No Windows, o `claude plugin eval` 2.1.286 falha ao iniciar os agentes com
`ENAMETOOLONG: name too long, uv_spawn` (limite de tamanho da linha de comando). Use o workflow
ou WSL.

Os resultados vão para `evals/results/` (ignorado pelo git).

## Baseline

Registre aqui cada rodada completa (versão do plugin, modelo, data, WITH / W/OUT / Δ por caso).

| Data | Versão | Modelo | novo-agregado | adapter-postgres | rota-http | migracao-result |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |

Ainda sem rodada completa: a primeira deve ser feita pelo workflow depois do merge.
