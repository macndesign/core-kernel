import { dirname, resolve } from "node:path";
import ts from "typescript";
import { ck001 } from "./rules/ck001-id-sem-value.js";
import { ck002 } from "./rules/ck002-erro-como-texto.js";
import { ck003 } from "./rules/ck003-try-catch-execute.js";
import { ck007 } from "./rules/ck007-map-sem-retorno.js";
import { ck008 } from "./rules/ck008-instanceof-erro.js";
import { ck004, ck005, ck006 } from "./rules/dominio.js";
import type { Finding, Rule, RuleContext } from "./types.js";

export const RULES: readonly Rule[] = [ck001, ck002, ck003, ck004, ck005, ck006, ck007, ck008];

export interface CheckOptions {
  /** `tsconfig.json` do projeto. Padrão: o mais próximo do primeiro arquivo, ou de `cwd`. */
  project?: string;
  /** Arquivos a analisar. Vazio: todos os arquivos do `tsconfig`. */
  files?: readonly string[];
  cwd?: string;
}

const SUPPRESSION = /\/\/\s*core-kernel-check-ignore\s+(CK\d{3})\b(?::\s*(\S.*))?/;

/** Linha (0-based) → regras suprimidas nela e na seguinte; supressões sem motivo viram CK000. */
function readSuppressions(
  sourceFile: ts.SourceFile,
  findings: Finding[],
): Map<number, Set<string>> {
  const suppressed = new Map<number, Set<string>>();
  sourceFile.text.split(/\r?\n/).forEach((text, line) => {
    const match = SUPPRESSION.exec(text);
    if (!match) return;
    const [, rule, reason] = match;
    if (!rule) return;
    if (!reason) {
      findings.push({
        rule: "CK000",
        file: sourceFile.fileName,
        line: line + 1,
        column: (match.index ?? 0) + 1,
        message: `Supressão de ${rule} sem motivo. Use \`// core-kernel-check-ignore ${rule}: motivo\`.`,
        skill: "ddd-result-errors",
      });
      return;
    }
    for (const target of [line, line + 1]) {
      const rules = suppressed.get(target) ?? new Set<string>();
      rules.add(rule);
      suppressed.set(target, rules);
    }
  });
  return suppressed;
}

function checkSourceFile(checker: ts.TypeChecker, sourceFile: ts.SourceFile): Finding[] {
  const findings: Finding[] = [];
  const suppressed = readSuppressions(sourceFile, findings);
  for (const rule of RULES) {
    const ctx: RuleContext = {
      ts,
      checker,
      sourceFile,
      report(node, message) {
        const start = node.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(start);
        if (suppressed.get(line)?.has(rule.id)) return;
        findings.push({
          rule: rule.id,
          file: sourceFile.fileName,
          line: line + 1,
          column: character + 1,
          message,
          skill: rule.skill,
        });
      },
    };
    const visit = (node: ts.Node): void => {
      rule.visit(node, ctx);
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return findings.sort((a, b) => a.line - b.line || a.column - b.column);
}

export class ConfigError extends Error {}

function readConfig(configPath: string): ts.ParsedCommandLine {
  const parsed = ts.getParsedCommandLineOfConfigFile(
    configPath,
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new ConfigError(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
      },
    },
  );
  if (!parsed) throw new ConfigError(`Não foi possível ler ${configPath}`);
  return parsed;
}

const normalize = (file: string) => resolve(file).replaceAll("\\", "/").toLowerCase();

const analyzable = (file: string) =>
  /\.(c|m)?tsx?$/.test(file) &&
  !/\.d\.(c|m)?ts$/.test(file) &&
  !/[\\/]node_modules[\\/]/.test(file);

/**
 * Roda as regras nos arquivos pedidos (ou no projeto inteiro). O `Program` inclui também os
 * `.d.ts` do projeto, para que declarações globais (ex.: `declare module "pg"`) continuem valendo.
 */
export function check(options: CheckOptions = {}): Finding[] {
  const cwd = options.cwd ?? process.cwd();
  const files = (options.files ?? []).map((file) => resolve(cwd, file));
  const searchFrom = files[0] ? dirname(files[0]) : cwd;
  const configPath = options.project
    ? resolve(cwd, options.project)
    : ts.findConfigFile(searchFrom, ts.sys.fileExists);
  if (!configPath || !ts.sys.fileExists(configPath)) {
    throw new ConfigError(`tsconfig.json não encontrado a partir de ${searchFrom}`);
  }
  const config = readConfig(configPath);

  const targets = files.length > 0 ? files : config.fileNames;
  const declarations = config.fileNames.filter((file) => /\.d\.(c|m)?ts$/.test(file));
  const program = ts.createProgram([...new Set([...targets, ...declarations])], config.options);
  const checker = program.getTypeChecker();

  const wanted = new Set(targets.filter(analyzable).map(normalize));
  return program
    .getSourceFiles()
    .filter((sourceFile) => wanted.has(normalize(sourceFile.fileName)))
    .flatMap((sourceFile) => checkSourceFile(checker, sourceFile));
}
