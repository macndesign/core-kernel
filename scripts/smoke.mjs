// Valida que todos os subpaths resolvem via import (consumidor ESM).
const entrypoints = ["core-kernel", "core-kernel/vo", "core-kernel/vo/br", "core-kernel/testing"];
for (const entry of entrypoints) await import(entry);
console.log(`ESM ok: ${entrypoints.join(", ")}`);
