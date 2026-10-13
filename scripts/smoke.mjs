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

// Subpaths compartilham as mesmas classes (build sem bundler): um erro criado em
// core-kernel/vo é instância da ValidationError exportada por core-kernel.
const { Email } = await import("core-kernel/vo");
const { Cnpj } = await import("core-kernel/vo/br");
const { ValidationError: CoreValidationError } = await import("core-kernel");
const invalidEmail = Email.create("x");
assert.ok(invalidEmail.error instanceof CoreValidationError);
assert.equal(Cnpj.create("12.ABC.345/01DE-35").unwrap().formatted, "12.ABC.345/01DE-35");

console.log(`ESM ok: ${entrypoints.join(", ")}`);
