// Valida o pacote do ponto de vista de um consumidor ESM: subpaths resolvem e a API funciona.
import assert from "node:assert/strict";

const entrypoints = ["core-kernel", "core-kernel/vo", "core-kernel/vo/br", "core-kernel/testing"];
for (const entry of entrypoints) await import(entry);

const { Result, ValidationError, isAppError } = await import("core-kernel");
const combined = Result.combine([
  Result.fail(new ValidationError({ field: "a", code: "A", message: "a" })),
  Result.fail(new ValidationError({ field: "b", code: "B", message: "b" })),
]);
assert.equal(Result.ok(1).unwrap(), 1);
assert.equal(combined.isFail() && combined.error.issues.length, 2);
assert.ok(isAppError(combined.error));

console.log(`ESM ok: ${entrypoints.join(", ")}`);
