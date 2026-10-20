import type ts from "typescript";

export type RuleId =
  | "CK000"
  | "CK001"
  | "CK002"
  | "CK003"
  | "CK004"
  | "CK005"
  | "CK006"
  | "CK007"
  | "CK008";

export interface Finding {
  rule: RuleId;
  /** Caminho absoluto do arquivo. */
  file: string;
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
  message: string;
  /** Skill do core-kernel que explica o padrão correto. */
  skill: string;
}

export interface RuleContext {
  ts: typeof ts;
  checker: ts.TypeChecker;
  sourceFile: ts.SourceFile;
  report(node: ts.Node, message: string): void;
}

export interface Rule {
  id: Exclude<RuleId, "CK000">;
  skill: string;
  /** Chamada para cada nó do arquivo. */
  visit(node: ts.Node, ctx: RuleContext): void;
}
