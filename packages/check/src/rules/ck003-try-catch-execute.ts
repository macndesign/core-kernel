// CK003: try/catch em volta de `await useCase.execute()`. O `BaseUseCase` já converte qualquer
// exceção em `UnexpectedError` (com a original em `cause`) e nunca rejeita: o catch não roda.
import ts from "typescript";
import { inheritsCoreKernel, typeOf, USE_CASE } from "../core-kernel-types.js";
import type { Rule } from "../types.js";

function containsExecute(checker: ts.TypeChecker, block: ts.Block): boolean {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (found || ts.isFunctionLike(node)) return;
    if (
      ts.isAwaitExpression(node) &&
      ts.isCallExpression(node.expression) &&
      ts.isPropertyAccessExpression(node.expression.expression) &&
      node.expression.expression.name.text === "execute" &&
      inheritsCoreKernel(checker, typeOf(checker, node.expression.expression.expression), USE_CASE)
    ) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(block);
  return found;
}

export const ck003: Rule = {
  id: "CK003",
  skill: "ddd-use-case",
  visit(node, ctx) {
    if (!ts.isTryStatement(node) || !node.catchClause) return;
    if (!containsExecute(ctx.checker, node.tryBlock)) return;
    ctx.report(
      node.catchClause,
      "Este catch nunca captura falhas do use case: `execute()` não rejeita, devolve `Result.fail(UnexpectedError)` com a exceção original em `error.cause`. Trate `result.error`.",
    );
  },
};
