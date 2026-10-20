import { CancelarPedidoUseCase } from "./base.js";

declare const useCase: CancelarPedidoUseCase;
declare function gravar(): Promise<void>;

export async function rota() {
  // O bug do backend: esperava pegar a violação de FK do Postgres aqui.
  try {
    const result = await useCase.execute({ pedidoId: "p-1" });
    return result.isOk() ? 200 : 400;
  } catch { // espera: CK003
    return 409;
  }
}

export async function correto() {
  const result = await useCase.execute({ pedidoId: "p-1" });
  if (result.isFail() && result.error.kind === "unexpected") return 500;
  try {
    await gravar();
  } catch {
    return 500;
  }
  return 200;
}
