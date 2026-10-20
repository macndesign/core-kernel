import { AppError, isAppError, NotFoundError, Result } from "core-kernel";
import { PedidoId } from "./base.js";

declare function salvar(id: PedidoId): Promise<void>;
const ids: PedidoId[] = [];

export function mapComEfeito(raw: string) {
  const result = PedidoId.from(raw);
  result.map((id) => { // espera: CK007
    ids.push(id);
  });
  result.map(async (id) => { // espera: CK007
    await salvar(id);
  });
  result.map((id) => ids.push(id));
  result.map((id) => id.value);
  [1, 2].map((n) => {
    console.log(n);
  });
  return Result.ok(ids.length);
}

export function classificar(error: unknown): string {
  if (error instanceof NotFoundError) return "404"; // espera: CK008
  if (error instanceof AppError) return "4xx"; // espera: CK008
  if (error instanceof TypeError) return "type";
  if (isAppError(error) && error.kind === "not_found") return "404";
  return "500";
}
