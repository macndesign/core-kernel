// CK004–CK006: o que não pode aparecer no domínio (Entity, AggregateRoot, ValueObject) nem no
// `handle` de um BaseUseCase: `throw`, relógio do sistema e `unwrap()`.
import ts from "typescript";
import { codeContext, inheritsCoreKernel, RESULT, typeOf } from "../core-kernel-types.js";
import type { Rule, RuleContext } from "../types.js";

function where(ctx: RuleContext, node: ts.Node): string | undefined {
  const context = codeContext(ctx.checker, node);
  if (context === "domain") return "no domínio";
  if (context === "use-case-handle") return "no handle do use case";
  return undefined;
}

export const ck004: Rule = {
  id: "CK004",
  skill: "ddd-result-errors",
  visit(node, ctx) {
    if (!ts.isThrowStatement(node)) return;
    const place = where(ctx, node);
    if (place) {
      ctx.report(
        node,
        `\`throw\` ${place}: falha esperada é \`Result.fail(...)\` com erro tipado.`,
      );
    }
  },
};

/** `Date` global (não uma classe `Date` do projeto). */
function isGlobalDate(ctx: RuleContext, expression: ts.Expression): boolean {
  if (!ts.isIdentifier(expression) || expression.text !== "Date") return false;
  const declarations = ctx.checker.getSymbolAtLocation(expression)?.declarations ?? [];
  return declarations.every((decl) => decl.getSourceFile().isDeclarationFile);
}

export const ck005: Rule = {
  id: "CK005",
  skill: "ddd-entity",
  visit(node, ctx) {
    const isNewDate =
      ts.isNewExpression(node) &&
      (node.arguments?.length ?? 0) === 0 &&
      isGlobalDate(ctx, node.expression);
    const isDateNow =
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "now" &&
      isGlobalDate(ctx, node.expression.expression);
    if (!isNewDate && !isDateNow) return;
    const place = where(ctx, node);
    if (place) {
      ctx.report(
        node,
        `Relógio do sistema ${place}: receba \`agora\` por parâmetro (o use case obtém de um \`Clock\`).`,
      );
    }
  },
};

export const ck006: Rule = {
  id: "CK006",
  skill: "ddd-result-errors",
  visit(node, ctx) {
    if (
      !ts.isCallExpression(node) ||
      !ts.isPropertyAccessExpression(node.expression) ||
      node.expression.name.text !== "unwrap" ||
      !inheritsCoreKernel(ctx.checker, typeOf(ctx.checker, node.expression.expression), RESULT)
    ) {
      return;
    }
    const place = where(ctx, node);
    if (place) {
      ctx.report(
        node,
        `\`unwrap()\` ${place} lança em caso de falha. Propague com \`if (r.isFail()) return r;\`.`,
      );
    }
  },
};
