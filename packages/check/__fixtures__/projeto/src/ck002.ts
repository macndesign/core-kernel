import type { AppError } from "core-kernel";
import { CancelarPedidoUseCase } from "./base.js";

declare const useCase: CancelarPedidoUseCase;

export async function statusHttp(): Promise<number> {
  const result = await useCase.execute({ pedidoId: "p-1" });
  if (result.isOk()) return 200;
  const error = result.error;

  // Os bugs do backend: status escolhido pelo texto do erro.
  if (String(error).startsWith("Forbidden")) return 403; // espera: CK002
  if (error.message.includes("não encontrado")) return 404; // espera: CK002
  if (error.message === "Conflito") return 409; // espera: CK002
  if (/conflito/i.test(error.message)) return 409; // espera: CK002
  const texto = `${error}`; // espera: CK002

  // Corretos.
  if (error.kind === "forbidden") return 403;
  if (error.code === "NOT_FOUND") return 404;
  console.error(`falhou: ${error.message}`, texto);
  return 500;
}

export const corpo = (error: AppError) => ({ error: error.message, code: error.code });
