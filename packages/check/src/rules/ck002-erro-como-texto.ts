// CK002: AppError tratado como texto. Decidir pelo texto (`String(err).startsWith(...)`,
// `err.message.includes(...)`) quebra quando a mensagem muda; o contrato estável é `code`/`kind`.
import ts from "typescript";
import { APP_ERROR, inheritsCoreKernel, typeOf } from "../core-kernel-types.js";
import type { Rule, RuleContext } from "../types.js";

const STRING_TESTS = new Set(["includes", "startsWith", "endsWith", "match", "indexOf", "search"]);
const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

const MESSAGE = "Erro do core-kernel tratado como texto. Decida por `error.code` ou `error.kind`.";

const isAppError = (ctx: RuleContext, node: ts.Node) =>
  inheritsCoreKernel(ctx.checker, typeOf(ctx.checker, node), APP_ERROR);

/** `err.message` de um AppError. */
const isErrorMessage = (ctx: RuleContext, node: ts.Node): node is ts.PropertyAccessExpression =>
  ts.isPropertyAccessExpression(node) &&
  node.name.text === "message" &&
  isAppError(ctx, node.expression);

/** `err.message` usado para decidir: `.includes(...)`, `=== "..."`, `/re/.test(...)`, `switch`. */
function decidesByMessage(node: ts.PropertyAccessExpression): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent)) {
    return STRING_TESTS.has(parent.name.text) && ts.isCallExpression(parent.parent);
  }
  if (ts.isBinaryExpression(parent)) return COMPARISONS.has(parent.operatorToken.kind);
  if (ts.isCallExpression(parent)) {
    return (
      ts.isPropertyAccessExpression(parent.expression) && parent.expression.name.text === "test"
    );
  }
  return ts.isSwitchStatement(parent) && parent.expression === node;
}

export const ck002: Rule = {
  id: "CK002",
  skill: "ddd-result-errors",
  visit(node, ctx) {
    if (ts.isCallExpression(node) && node.expression.getText() === "String") {
      const [arg] = node.arguments;
      if (arg && isAppError(ctx, arg)) ctx.report(node, MESSAGE);
    } else if (ts.isTemplateSpan(node)) {
      if (isAppError(ctx, node.expression)) ctx.report(node.expression, MESSAGE);
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      for (const side of [node.left, node.right]) {
        if (isAppError(ctx, side)) ctx.report(side, MESSAGE);
      }
    } else if (isErrorMessage(ctx, node) && decidesByMessage(node)) {
      ctx.report(node, MESSAGE);
    }
  },
};
