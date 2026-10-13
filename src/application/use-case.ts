import type { AppError } from "../errors/app-error.js";
import { UnexpectedError } from "../errors/unexpected-error.js";
import { Result } from "../result/result.js";

/**
 * Caso de uso: orquestra entidades e ports para cumprir uma intenção do usuário.
 * Sempre assíncrono e sempre devolve `Result` — nunca lança para falhas esperadas.
 * Use `I = void` para casos de uso sem entrada.
 */
export interface UseCase<I, O, E extends AppError = AppError> {
  execute(input: I): Promise<Result<O, E>>;
}

/**
 * Base opcional que implementa `execute` capturando exceções inesperadas (ex.: banco fora do
 * ar lançado pelo repositório) e devolvendo-as como `UnexpectedError`. A subclasse
 * implementa só `handle`, com as falhas esperadas tipadas em `E`.
 */
export abstract class BaseUseCase<I, O, E extends AppError = never>
  implements UseCase<I, O, E | UnexpectedError>
{
  async execute(input: I): Promise<Result<O, E | UnexpectedError>> {
    try {
      return await this.handle(input);
    } catch (thrown) {
      return Result.fail(UnexpectedError.from(thrown));
    }
  }

  protected abstract handle(input: I): Promise<Result<O, E>>;
}
