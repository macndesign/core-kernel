// Valida o pacote do ponto de vista de um consumidor CommonJS: subpaths resolvem e a API funciona.
const assert = require("node:assert/strict");

const entrypoints = ["core-kernel", "core-kernel/vo", "core-kernel/vo/br", "core-kernel/testing"];
for (const entry of entrypoints) require(entry);

const { Result, NotFoundError, isAppError } = require("core-kernel");
const result = Result.fail(new NotFoundError("x"));
assert.equal(result.unwrapOr(0), 0);
assert.ok(Result.isResult(result));
assert.ok(isAppError(result.error));

// Subpaths compartilham as mesmas classes (build sem bundler): um erro criado em
// core-kernel/vo é instância da ValidationError exportada por core-kernel.
const { Email } = require("core-kernel/vo");
const { Cnpj } = require("core-kernel/vo/br");
const { ValidationError: CoreValidationError } = require("core-kernel");
const invalidEmail = Email.create("x");
assert.ok(invalidEmail.error instanceof CoreValidationError);
assert.equal(Cnpj.create("12.ABC.345/01DE-35").unwrap().formatted, "12.ABC.345/01DE-35");

console.log(`CJS ok: ${entrypoints.join(", ")}`);
