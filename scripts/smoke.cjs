// Valida o pacote do ponto de vista de um consumidor CommonJS: subpaths resolvem e a API funciona.
const assert = require("node:assert/strict");

const entrypoints = ["core-kernel", "core-kernel/vo", "core-kernel/vo/br", "core-kernel/testing"];
for (const entry of entrypoints) require(entry);

const { Result, NotFoundError, isAppError } = require("core-kernel");
const result = Result.fail(new NotFoundError("x"));
assert.equal(result.unwrapOr(0), 0);
assert.ok(Result.isResult(result));
assert.ok(isAppError(result.error));

console.log(`CJS ok: ${entrypoints.join(", ")}`);
