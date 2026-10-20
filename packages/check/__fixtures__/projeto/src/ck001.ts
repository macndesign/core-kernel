import { Result } from "core-kernel";
import { Pool } from "pg";
import type { Pedido } from "./base.js";

const pool = new Pool();
declare function executar(sql: string, params: unknown[]): void;
declare function registrar(dado: unknown): void;
declare function porId(id: string): void;

export async function salvar(pedido: Pedido) {
  // Os bugs do backend: o id ia inteiro para o pg.
  await pool.query("insert", [pedido.id, "x"]); // espera: CK001
  await pool.query("insert", [pedido.clienteId]); // espera: CK001
  executar("delete", [pedido.id]); // espera: CK001
  registrar(pedido.id); // espera: CK001

  // Corretos.
  await pool.query("insert", [pedido.id.value, pedido.clienteId?.value ?? null]);
  executar("delete", [pedido.id.value]);
  porId(pedido.id.value);
  console.log(pedido.id);
  JSON.stringify({ id: pedido.id });
  String(pedido.id);
  Result.ok(pedido.id);
  const ids = new Set([pedido.id]);
  // core-kernel-check-ignore CK001: o logger serializa com toJSON
  registrar(pedido.id);
  return ids;
}
