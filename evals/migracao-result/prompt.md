---
name: migracao-result
tags: [migracao]
runs: 3
max_turns: 25
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

Quero migrar este caso de uso, que usa um `Result` próprio, para o pacote `core-kernel`. Escreva a versão migrada em `src/aprovar-troca.usecase.ts` (e o que mais for preciso), mantendo as mesmas regras e mensagens.

```ts
import { Result } from "../shared/result";

export class AprovarTrocaUseCase {
  constructor(private repo: TrocaRepository) {}

  async execute(input: { trocaId: string; supervisorId: string }): Promise<Result<Troca>> {
    const troca = await this.repo.findById(input.trocaId);
    if (!troca) return Result.fail("Troca não encontrada");
    if (troca.status !== "aguardando") return Result.fail("Troca não pode ser aprovada");
    troca.status = "aprovada";
    troca.aprovadaEm = new Date();
    troca.aprovadaPor = input.supervisorId;
    await this.repo.save(troca);
    return Result.ok(troca);
  }
}
```

Não precisa rodar nada.
