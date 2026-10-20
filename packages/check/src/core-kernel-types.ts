// Reconhece tipos do core-kernel pela ORIGEM da declaração (arquivo dentro de
// `core-kernel/dist/`), não só pelo nome: uma classe `Result` ou `Entity` do próprio projeto não
// é confundida com a da lib. Subclasses (OrderId extends UniqueId) são reconhecidas pela cadeia
// de herança.
import ts from "typescript";

const CORE_KERNEL_DIST = /[\\/]core-kernel[\\/]dist[\\/]/;

function fromCoreKernel(symbol: ts.Symbol): boolean {
  return (symbol.declarations ?? []).some((decl) =>
    CORE_KERNEL_DIST.test(decl.getSourceFile().fileName),
  );
}

/**
 * `type` é (ou herda de) algum dos tipos `names` declarados no core-kernel? Em uniões, basta
 * um membro (ex.: `OrderId | undefined`).
 */
export function inheritsCoreKernel(
  checker: ts.TypeChecker,
  type: ts.Type,
  names: ReadonlySet<string>,
  seen = new Set<ts.Type>(),
): boolean {
  if (seen.has(type)) return false;
  seen.add(type);

  if (type.isUnion() || type.isIntersection()) {
    return type.types.some((member) => inheritsCoreKernel(checker, member, names, seen));
  }

  for (const symbol of [type.getSymbol(), type.aliasSymbol]) {
    if (symbol && names.has(symbol.getName()) && fromCoreKernel(symbol)) return true;
  }

  const target = (type as ts.TypeReference).target ?? type;
  if (target.isClassOrInterface()) {
    for (const base of checker.getBaseTypes(target)) {
      if (inheritsCoreKernel(checker, base, names, seen)) return true;
    }
  }
  return false;
}

export const UNIQUE_ID = new Set(["UniqueId"]);
export const APP_ERROR = new Set(["AppError"]);
export const RESULT = new Set(["Ok", "Fail"]);
export const DOMAIN_OBJECT = new Set(["Entity", "AggregateRoot", "ValueObject"]);
export const USE_CASE = new Set(["BaseUseCase", "UseCase"]);

export const typeOf = (checker: ts.TypeChecker, node: ts.Node) => checker.getTypeAtLocation(node);

/** Tipo de instância de uma declaração de classe (para checar de quem ela herda). */
export function classInstanceType(
  checker: ts.TypeChecker,
  decl: ts.ClassLikeDeclaration,
): ts.Type | undefined {
  const symbol = decl.name ? checker.getSymbolAtLocation(decl.name) : undefined;
  return symbol ? checker.getDeclaredTypeOfSymbol(symbol) : undefined;
}

export type CodeContext = "domain" | "use-case-handle" | "other";

/**
 * Onde o nó está: dentro de uma classe de domínio (Entity/AggregateRoot/ValueObject), dentro do
 * `handle` de um BaseUseCase, ou em outro lugar (adapters, mappers, rotas...).
 */
export function codeContext(checker: ts.TypeChecker, node: ts.Node): CodeContext {
  let method: ts.MethodDeclaration | undefined;
  for (let current: ts.Node | undefined = node.parent; current; current = current.parent) {
    if (ts.isMethodDeclaration(current) && !method) method = current;
    if (ts.isClassDeclaration(current) || ts.isClassExpression(current)) {
      const instance = classInstanceType(checker, current);
      if (!instance) return "other";
      if (inheritsCoreKernel(checker, instance, DOMAIN_OBJECT)) return "domain";
      const handle = method?.name && ts.isIdentifier(method.name) && method.name.text === "handle";
      if (handle && inheritsCoreKernel(checker, instance, USE_CASE)) return "use-case-handle";
      return "other";
    }
  }
  return "other";
}
