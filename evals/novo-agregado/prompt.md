---
name: novo-agregado
tags: [dominio]
runs: 3
max_turns: 25
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

Estou criando uma biblioteca de domínio para uma biblioteca de bairro, em TypeScript, usando o pacote npm `core-kernel` (já instalado). Implemente o agregado de empréstimo de livros:

- Um membro pode ter no máximo 3 empréstimos ativos.
- O empréstimo vence 14 dias depois de criado; devolver depois disso marca o empréstimo como atrasado.
- Um empréstimo devolvido não pode ser devolvido de novo.

Crie `src/emprestimo.entity.ts` com o agregado e `src/emprestar-livro.usecase.ts` com o caso de uso que cria o empréstimo (verificando o limite de 3 pelo repositório). Inclua um teste em `src/__tests__/emprestimo.test.ts` com `bun:test`. Não precisa rodar nada.
