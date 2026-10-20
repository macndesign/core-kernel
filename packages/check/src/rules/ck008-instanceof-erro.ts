// CK008: `instanceof` de erros do core-kernel falha quando o projeto carrega a cópia ESM e a CJS
// ao mesmo tempo (dual package hazard). Use `error.kind`, `error.code` ou `isAppError`.
import ts from "typescript";
import { APP_ERROR, inheritsCoreKernel } from "../core-kernel-types.js";
import type { Rule } from "../types.js";

export const ck008: Rule = {
  id: "CK008",
  skill: "ddd-result-errors",
  visit(node, ctx) {
    if (
      !ts.isBinaryExpression(node) ||
      node.operatorToken.kind !== ts.SyntaxKind.InstanceOfKeyword
    ) {
      return;
    }
    const { checker } = ctx;
    // O tipo do `prototype` serve também para classes abstratas (AppError), sem construct signature.
    const prototype = checker.getTypeAtLocation(node.right).getProperty("prototype");
    const instance = prototype && checker.getTypeOfSymbolAtLocation(prototype, node.right);
    if (instance && inheritsCoreKernel(checker, instance, APP_ERROR)) {
      ctx.report(
        node,
        "`instanceof` de erro do core-kernel falha entre cópias ESM e CJS. Compare `error.kind` ou `error.code` (ou use `isAppError`).",
      );
    }
  },
};
