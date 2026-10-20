import { Pool } from "pg";
import { PedidoId } from "../projeto/src/base.js";

// core-kernel-check-ignore CK001
await new Pool().query("select", [PedidoId.generate()]);
