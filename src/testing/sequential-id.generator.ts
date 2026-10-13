import { type IdGenerator, UniqueId } from "../domain/unique-id.js";

/** Gera `id-1`, `id-2`, ... para asserções previsíveis. */
export class SequentialIdGenerator implements IdGenerator {
  #count = 0;

  constructor(private readonly prefix = "id") {}

  generate(): string {
    this.#count += 1;
    return `${this.prefix}-${this.#count}`;
  }

  /**
   * Passa a usar este gerador em `UniqueId.generate()` (e nos ids de eventos).
   * Devolve a função que restaura o gerador anterior — chame no `afterEach`.
   */
  install(): () => void {
    return UniqueId.useGenerator(this);
  }
}
