---
"core-kernel": minor
---

Ajustes revelados pela migração do shift-swap (todos compatíveis com a 0.1):

- VOs prontos (`Email`, `Text`, `Url`, `Money`, `DateRange`, `StrongPassword`, `Cpf`, `Cnpj`) aceitam `errors` para trocar o código e/ou a mensagem de cada issue, indexado pelo código padrão — útil para códigos e mensagens no idioma do projeto. Cada VO exporta o tipo com seus códigos (`EmailErrorCode`, `TextErrorCode`...).
- `DateRange.create` aceita `{ field, errors }`; `field` prefixa as issues (`periodo.start`).
- `UniqueId.from(raw, { field, code, message })` permite personalizar a issue de id vazio (antes fixa em `field: "id"`, `code: "INVALID_ID"`).
- Skills e `llms.txt`: o padrão `result.map(() => { efeito })` foi trocado por retorno antecipado, porque reprova no lint `useIterableCallbackReturn` do Biome; o `check:skills` agora também roda o lint nos blocos de exemplo.
