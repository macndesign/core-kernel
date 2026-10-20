import { isAbsolute, relative, resolve } from "node:path";
import { ConfigError, check } from "./program.js";
import type { Finding } from "./types.js";

export interface Io {
  cwd: string;
  /** Lido só no modo `--hook`. */
  readStdin: () => Promise<string>;
  out: (text: string) => void;
  err: (text: string) => void;
}

const USAGE = `Uso: core-kernel-check [arquivos...] [opções]

Verifica, com o type checker do TypeScript, os padrões do core-kernel que compilam mas estão
errados (id tipado no SQL, erro decidido pelo texto, try/catch em volta de execute()...).
Sem arquivos, analisa todos os arquivos do tsconfig.

Opções:
  --project <tsconfig>  tsconfig do projeto (padrão: o mais próximo)
  --json                Saída em JSON
  --hook                Modo hook do Claude Code (PostToolUse): lê o evento no stdin
  -h, --help            Mostra esta ajuda

Para suprimir um achado, comente na linha anterior:
  // core-kernel-check-ignore CK001: motivo`;

const format = (finding: Finding, cwd: string) =>
  `${relative(cwd, finding.file).replaceAll("\\", "/")}:${finding.line}:${finding.column} ${finding.rule} ${finding.message} (skill: ${finding.skill})`;

const isTypeScript = (file: string) =>
  /\.(c|m)?tsx?$/.test(file) &&
  !/\.d\.(c|m)?ts$/.test(file) &&
  !/[\\/]node_modules[\\/]/.test(file);

/**
 * Modo hook: nunca trava o agente por falha do checker. Achados → stderr e código 2 (o Claude
 * Code devolve o stderr ao agente); qualquer outra coisa → 0.
 */
async function runHook(io: Io): Promise<number> {
  try {
    const event = JSON.parse(await io.readStdin()) as {
      cwd?: string;
      tool_input?: { file_path?: string };
    };
    const filePath = event.tool_input?.file_path;
    if (!filePath) return 0;
    const root = process.env.CLAUDE_PROJECT_DIR ?? event.cwd ?? io.cwd;
    const file = resolve(root, filePath);
    const inside = relative(root, file);
    if (!isTypeScript(file) || inside.startsWith("..") || isAbsolute(inside)) return 0;

    const findings = check({ files: [file], cwd: root });
    if (findings.length === 0) return 0;
    io.err(
      [
        `core-kernel-check: ${findings.length} problema(s) em ${inside.replaceAll("\\", "/")}. Corrija antes de seguir:`,
        ...findings.map((finding) => format(finding, root)),
      ].join("\n"),
    );
    return 2;
  } catch {
    return 0;
  }
}

export async function run(argv: readonly string[], io: Io): Promise<number> {
  const files: string[] = [];
  let project: string | undefined;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === "-h" || arg === "--help") {
      io.out(USAGE);
      return 0;
    }
    if (arg === "--hook") return runHook(io);
    if (arg === "--json") json = true;
    else if (arg === "--project") {
      project = argv[++i];
      if (!project) {
        io.err("Valor ausente para --project");
        return 2;
      }
    } else if (arg.startsWith("-")) {
      io.err(`Opção desconhecida: ${arg}\n\n${USAGE}`);
      return 2;
    } else files.push(arg);
  }

  let findings: Finding[];
  try {
    findings = check({ files, cwd: io.cwd, ...(project !== undefined && { project }) });
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    io.err(error.message);
    return 2;
  }

  if (json) io.out(JSON.stringify(findings, null, 2));
  else if (findings.length === 0) io.out("core-kernel-check: nenhum problema encontrado.");
  else {
    for (const finding of findings) io.out(format(finding, io.cwd));
    io.out(`\n${findings.length} problema(s).`);
  }
  return findings.length > 0 ? 1 : 0;
}
