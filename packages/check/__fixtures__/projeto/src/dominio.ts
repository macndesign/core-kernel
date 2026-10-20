// CK004 (throw), CK005 (relógio) e CK006 (unwrap): proibidos no domínio e no handle.
import { BaseUseCase, Entity, Result, ValidationError, ValueObject } from "core-kernel";
import { PedidoId } from "./base.js";

interface ItemProps {
  quantidade: number;
  criadoEm: Date;
}

export class Item extends Entity<ItemProps, PedidoId> {
  static create(quantidade: number, agora: Date): Result<Item, ValidationError> {
    if (quantidade <= 0) throw new Error("quantidade inválida"); // espera: CK004
    const criadoEm = new Date(); // espera: CK005
    const id = PedidoId.from("x").unwrap(); // espera: CK006
    const ontem = new Date(agora.getTime() - 86_400_000);
    return Result.ok(new Item({ quantidade, criadoEm: ontem ?? criadoEm }, id));
  }

  expirou(): boolean {
    return this.props.criadoEm.getTime() < Date.now(); // espera: CK005
  }
}

export class Quantidade extends ValueObject<number> {
  static create(valor: number): Quantidade {
    if (valor < 0) throw new RangeError("negativa"); // espera: CK004
    return new Quantidade(valor);
  }
}

export class CriarItemUseCase extends BaseUseCase<number, Item> {
  protected async handle(quantidade: number): Promise<Result<Item, never>> {
    const agora = new Date(); // espera: CK005
    return Result.ok(Item.create(quantidade, agora).unwrap()); // espera: CK006
  }

  // Fora do handle: permitido.
  descrever(): string {
    return new Date().toISOString();
  }
}

// Fora do domínio (adapter, mapper, teste): permitido.
export function reidratar(raw: string): PedidoId {
  if (!raw) throw new Error("vazio");
  console.log(Date.now(), new Date());
  return PedidoId.from(raw).unwrap();
}
