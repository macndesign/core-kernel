// CK001: id tipado (`UniqueId`) passado a uma API sem tipo (`any`/`unknown`), como os parâmetros
// do `pg`. O driver serializa o objeto com `JSON.stringify` e grava `"abc"`, com as aspas.
import ts from "typescript";
import { inheritsCoreKernel, typeOf, UNIQUE_ID } from "../core-kernel-types.js";
import type { Rule, RuleContext } from "../types.js";

const LOOSE = ts.TypeFlags.Any | ts.TypeFlags.Unknown;

/** `any`, `unknown` ou array/tupla só deles. */
function isLooseType(checker: ts.TypeChecker, type: ts.Type): boolean {
  if (type.flags & LOOSE) return true;
  if (type.isUnion()) {
    return type.types.every(
      (member) => member.flags & ts.TypeFlags.Undefined || isLooseType(checker, member),
    );
  }
  if (checker.isArrayType(type)) {
    const [element] = checker.getTypeArguments(type as ts.TypeReference);
    return element !== undefined && (element.flags & LOOSE) !== 0;
  }
  return false;
}

const isLooseNode = (node: ts.TypeNode | undefined): boolean =>
  node !== undefined &&
  (node.kind === ts.SyntaxKind.AnyKeyword ||
    node.kind === ts.SyntaxKind.UnknownKeyword ||
    (ts.isArrayTypeNode(node) && isLooseNode(node.elementType)));

/**
 * O parâmetro declarado usa um type parameter da própria assinatura com padrão `any`/`any[]`
 * (ex.: `query<R, I = any[]>(text, values?: QueryConfigValues<I>)`): o tipo "resolvido" vem da
 * inferência sobre o próprio argumento e não diz nada. Um type parameter puro (`ok<T>(value: T)`)
 * não conta: ali o tipo do argumento é preservado de propósito.
 */
function isLooseGeneric(decl: ts.SignatureDeclaration, param: ts.ParameterDeclaration): boolean {
  const typeNode = param.type;
  if (!typeNode || (ts.isTypeReferenceNode(typeNode) && !typeNode.typeArguments)) return false;
  const loose = new Set(
    (decl.typeParameters ?? []).filter((tp) => isLooseNode(tp.default)).map((tp) => tp.name.text),
  );
  if (loose.size === 0) return false;
  let found = false;
  const visit = (node: ts.Node): void => {
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
      if (loose.has(node.typeName.text)) found = true;
    }
    if (!found) ts.forEachChild(node, visit);
  };
  visit(typeNode);
  return found;
}

/** `console.*`, `JSON.stringify` e `String` usam o `toString`/`toJSON` do id: não há perigo. */
function isSafeCallee(callee: ts.Expression): boolean {
  const text = callee.getText();
  return text === "String" || text === "JSON.stringify" || text.startsWith("console.");
}

function paramFor(
  signature: ts.Signature,
  index: number,
): { symbol: ts.Symbol; decl: ts.ParameterDeclaration | undefined } | undefined {
  const params = signature.getParameters();
  const last = params[params.length - 1];
  const lastDecl = last?.valueDeclaration;
  const isRest = lastDecl && ts.isParameter(lastDecl) && lastDecl.dotDotDotToken !== undefined;
  const symbol = params[index] ?? (isRest ? last : undefined);
  if (!symbol) return undefined;
  const decl = symbol.valueDeclaration;
  return { symbol, decl: decl && ts.isParameter(decl) ? decl : undefined };
}

function checkArgument(
  ctx: RuleContext,
  call: ts.CallExpression | ts.NewExpression,
  arg: ts.Expression,
  index: number,
  signature: ts.Signature,
): void {
  const param = paramFor(signature, index);
  if (!param) return;
  const { checker } = ctx;
  const declaration = signature.getDeclaration() as ts.SignatureDeclaration | undefined;
  const resolved = checker.getTypeOfSymbolAtLocation(param.symbol, call);
  const loose =
    isLooseType(checker, resolved) ||
    (declaration !== undefined &&
      param.decl !== undefined &&
      isLooseGeneric(declaration, param.decl));
  if (!loose) return;

  const candidates = ts.isArrayLiteralExpression(arg) ? arg.elements : [arg];
  for (const candidate of candidates) {
    const expression = ts.isSpreadElement(candidate) ? candidate.expression : candidate;
    if (inheritsCoreKernel(checker, typeOf(checker, expression), UNIQUE_ID)) {
      ctx.report(
        expression,
        `Id tipado passado a um parâmetro sem tipo: o objeto vai inteiro (o pg grava "abc", com aspas). Use \`${expression.getText()}.value\`.`,
      );
    }
  }
}

export const ck001: Rule = {
  id: "CK001",
  skill: "ddd-repository",
  visit(node, ctx) {
    if (!ts.isCallExpression(node) && !ts.isNewExpression(node)) return;
    if (isSafeCallee(node.expression)) return;
    const signature = ctx.checker.getResolvedSignature(node);
    if (!signature) return;
    (node.arguments ?? []).forEach((arg, index) => {
      checkArgument(ctx, node, arg, index, signature);
    });
  },
};
