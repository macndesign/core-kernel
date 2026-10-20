---
type: llm
weight: 2
---

O código usa o core-kernel corretamente:
- o agregado estende `AggregateRoot` (ou `Entity`) com um id tipado (classe que estende `UniqueId`);
- criação por `static create(...)` que devolve `Result`, e as regras (limite, devolução repetida) falham com erros tipados do core-kernel (`ConflictError`, `ValidationError`...) com `code`, sem `throw`;
- a data atual entra por parâmetro e o caso de uso a obtém de um `Clock` (não usa `new Date()` no domínio);
- o caso de uso estende `BaseUseCase` e implementa `handle`, recebendo a port do repositório pelo construtor;
- o teste usa `core-kernel/testing` (`FixedClock`, `InMemoryRepository`, `assertOk`/`assertFail`) ou equivalente sem relógio real.
