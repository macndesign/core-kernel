// Valida que todos os subpaths resolvem via require() (consumidor CommonJS).
const entrypoints = ["core-kernel", "core-kernel/vo", "core-kernel/vo/br", "core-kernel/testing"];
for (const entry of entrypoints) require(entry);
console.log(`CJS ok: ${entrypoints.join(", ")}`);
