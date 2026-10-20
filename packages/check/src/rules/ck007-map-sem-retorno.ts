// CK007: `result.map(cb)` com `cb` sem valor de retorno: é efeito colateral disfarçado de
// transformação. Use retorno antecipado (`if (r.isFail()) return r;`) e faça o efeito depois.
import ts from "typescript";
import { inheritsCoreKernel, RESULT, typeOf } from "../core-kernel-types.js";
import type { Rule } from "../types.js";

const NO_VALUE = ts.TypeFlags.Void | ts.TypeFlags.Undefined;

export const ck007: Rule = {
  id: "CK007",
  skill: "ddd-result-errors",
  visit(node, ctx) {
    if (
      !ts.isCallExpression(node) ||
      !ts.isPropertyAccessExpression(node.expression) ||
      node.expression.name.text !== "map"
    ) {
      return;
    }
    const [callback] = node.arguments;
    if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) return;
    const { checker } = ctx;
    if (!inheritsCoreKernel(checker, typeOf(checker, node.expression.expression), RESULT)) return;
    const signature = checker.getSignatureFromDeclaration(callback);
    if (!signature) return;
    const returned = checker.getReturnTypeOfSignature(signature);
    const value = checker.getAwaitedType(returned) ?? returned;
    if (value.flags & NO_VALUE) {
      ctx.report(
        callback,
        "`map` com callback sem retorno (efeito colateral). Use retorno antecipado: `if (r.isFail()) return r;` e faça o efeito em seguida.",
      );
    }
  },
};
