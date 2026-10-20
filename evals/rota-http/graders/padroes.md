---
type: llm
weight: 2
---

A rota trata os erros do core-kernel corretamente:
- o status HTTP é escolhido pelo `error.kind` (ou `error.code`), nunca pelo texto da mensagem;
- o corpo de erro mantém `error` com a mensagem e inclui `code`;
- não há `try/catch` em volta de `useCase.execute()` esperando pegar erros de banco: `execute` nunca rejeita, e falhas inesperadas chegam como `UnexpectedError` (`kind: "unexpected"`) com a exceção original em `error.cause` (onde estaria o código `23503` do Postgres);
- não usa `instanceof` para classificar os erros do core-kernel.
