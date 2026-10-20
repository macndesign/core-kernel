---
type: llm
weight: 2
---

A migração usa o core-kernel corretamente:
- o caso de uso estende `BaseUseCase` e implementa `handle`;
- as falhas viram erros tipados, `NotFoundError` para troca inexistente e `ConflictError` para status inválido, com `code` estável e as mesmas mensagens;
- o id de entrada é convertido para um id tipado (`XxxId.from(...)`) antes de buscar;
- a data vem de um `Clock` injetado (não `new Date()`), e a transição de estado fica num método da entidade que devolve `Result`, em vez de atribuições diretas no caso de uso;
- a port de repositório usa `findById`/`update` (não um `save` genérico) e é tipada pelo mínimo usado.
