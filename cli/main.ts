import { join } from "node:path";
import {
  checkSkills,
  detectTargets,
  type InstallReport,
  installSkills,
  listSkills,
  type Problem,
  readLock,
  TARGET_DIRS,
  type Target,
} from "./skills.js";

export interface Io {
  cwd: string;
  /** Raiz do pacote core-kernel instalado (onde ficam `skills/` e `package.json`). */
  packageRoot: string;
  version: string;
  out: (line: string) => void;
  err: (line: string) => void;
}

const USAGE = `Uso: core-kernel skills <comando> [opções]

Comandos:
  list                 Lista as skills disponíveis nesta versão
  add                  Instala as skills no projeto
  update               Atualiza as skills instaladas para esta versão
  check                Falha (exit 1) se as skills estiverem ausentes, editadas ou desatualizadas

Opções:
  --target <alvo>      claude (.claude/skills), agents (.agents/skills) ou all.
                       Padrão do add: as pastas que já existem no projeto, ou claude.
  --cwd <pasta>        Raiz do projeto (padrão: pasta atual)
  --force              Sobrescreve skills editadas localmente ou de outra origem
  -h, --help           Mostra esta ajuda
  -v, --version        Mostra a versão`;

interface Options {
  command: string | undefined;
  targets: Target[] | undefined;
  cwd: string | undefined;
  force: boolean;
}

function parse(argv: string[]): Options | string {
  const options: Options = { command: undefined, targets: undefined, cwd: undefined, force: false };
  const [group, ...rest] = argv;
  if (group !== "skills") return `Comando desconhecido: ${group ?? "(nenhum)"}`;

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--force") options.force = true;
    else if (arg === "--target" || arg === "--cwd") {
      const value = rest[++i];
      if (!value) return `Valor ausente para ${arg}`;
      if (arg === "--cwd") options.cwd = value;
      else if (value === "all") options.targets = ["claude", "agents"];
      else if (value === "claude" || value === "agents") options.targets = [value];
      else return `Target inválido: ${value} (use claude, agents ou all)`;
    } else if (!options.command && arg && !arg.startsWith("-")) options.command = arg;
    else return `Argumento desconhecido: ${arg}`;
  }
  return options;
}

const DESCRIBE_PROBLEM: Record<Exclude<Problem["kind"], "not-installed">, string> = {
  missing: "ausente",
  modified: "editada localmente",
  outdated: "desatualizada",
  obsolete: "não existe mais no pacote",
};

function printInstall(report: InstallReport, io: Io): void {
  for (const { target, skill } of report.installed) io.out(`+ ${TARGET_DIRS[target]}/${skill}`);
  for (const { target, skill } of report.removed) io.out(`- ${TARGET_DIRS[target]}/${skill}`);
  for (const { target, skill, reason } of report.skipped) {
    const why = reason === "modified" ? "editada localmente" : "não foi instalada pelo core-kernel";
    io.err(`! ${TARGET_DIRS[target]}/${skill} mantida: ${why} (use --force para sobrescrever)`);
  }
  if (report.unchanged.length > 0) io.out(`= ${report.unchanged.length} já atualizada(s)`);
}

/** Executa o CLI e devolve o exit code. */
export function run(argv: string[], io: Io): number {
  if (argv.includes("-h") || argv.includes("--help") || argv.length === 0) {
    io.out(USAGE);
    return 0;
  }
  if (argv.includes("-v") || argv.includes("--version")) {
    io.out(io.version);
    return 0;
  }

  const options = parse(argv);
  if (typeof options === "string") {
    io.err(options);
    io.err("Veja: core-kernel --help");
    return 1;
  }

  const source = join(io.packageRoot, "skills");
  const cwd = options.cwd ?? io.cwd;
  const context = { source, cwd, version: io.version };

  switch (options.command) {
    case "list":
      for (const { name, description } of listSkills(source)) io.out(`${name}\n  ${description}`);
      return 0;

    case "add":
      printInstall(
        installSkills({
          ...context,
          targets: options.targets ?? detectTargets(cwd),
          force: options.force,
        }),
        io,
      );
      return 0;

    case "update": {
      const lock = readLock(cwd);
      if (!lock) {
        io.err("Nenhuma skill instalada. Rode: core-kernel skills add");
        return 1;
      }
      printInstall(
        installSkills({
          ...context,
          targets: options.targets ?? lock.targets,
          force: options.force,
        }),
        io,
      );
      return 0;
    }

    case "check": {
      const { ok, problems } = checkSkills(context);
      if (ok) {
        io.out(`Skills do core-kernel ${io.version} em dia.`);
        return 0;
      }
      for (const problem of problems) {
        if (problem.kind === "not-installed") io.err("Skills do core-kernel não instaladas.");
        else
          io.err(
            `${TARGET_DIRS[problem.target]}/${problem.skill}: ${DESCRIBE_PROBLEM[problem.kind]}`,
          );
      }
      io.err("Rode: core-kernel skills update (ou add, se nunca instalou)");
      return 1;
    }

    default:
      io.err(`Comando desconhecido: skills ${options.command ?? ""}`.trim());
      io.err("Veja: core-kernel --help");
      return 1;
  }
}
