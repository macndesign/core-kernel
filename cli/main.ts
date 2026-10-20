import { join } from "node:path";
import {
  AGENT_DIRS,
  checkAgents,
  detectAgentTargets,
  installAgents,
  listAgents,
} from "./agents.js";
import type { CheckReport, InstallReport, Problem, Target } from "./artifacts.js";
import { readLock } from "./artifacts.js";
import { checkSkills, detectTargets, installSkills, listSkills, TARGET_DIRS } from "./skills.js";

export interface Io {
  cwd: string;
  /** Raiz do pacote core-kernel instalado (onde ficam `skills/`, `agents/` e `package.json`). */
  packageRoot: string;
  version: string;
  out: (line: string) => void;
  err: (line: string) => void;
}

const USAGE = `Uso: core-kernel skills <comando> [opções]
     core-kernel agents <comando> [opções]

Grupos:
  skills               Skills de DDD com o core-kernel (padrões, exemplos, checklists)
  agents               Subagentes: ddd-architect, ddd-reviewer, core-kernel-migrator

Comandos:
  list                 Lista o que está disponível nesta versão
  add                  Instala no projeto
  update               Atualiza o que está instalado para esta versão
  check                Falha (exit 1) se houver itens ausentes, editados ou desatualizados

Opções:
  --target <alvo>      claude, agents ou all.
                       skills: claude → .claude/skills, agents → .agents/skills (Codex e outros)
                       agents: claude → .claude/agents, agents → .codex/agents (Codex, .toml)
                       Padrão do add: as pastas que já existem no projeto, ou claude.
  --cwd <pasta>        Raiz do projeto (padrão: pasta atual)
  --force              Sobrescreve itens editados localmente ou de outra origem
  -h, --help           Mostra esta ajuda
  -v, --version        Mostra a versão`;

type Group = "skills" | "agents";

interface Options {
  group: Group;
  command: string | undefined;
  targets: Target[] | undefined;
  cwd: string | undefined;
  force: boolean;
}

function parse(argv: string[]): Options | string {
  const [group, ...rest] = argv;
  if (group !== "skills" && group !== "agents") {
    return `Comando desconhecido: ${group ?? "(nenhum)"}`;
  }
  const options: Options = {
    group,
    command: undefined,
    targets: undefined,
    cwd: undefined,
    force: false,
  };

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

/** O que muda entre os grupos: de onde vem, para onde vai e como se chama. */
interface GroupOps {
  dirs: Record<Target, string>;
  /** Extensão do item instalado em cada target (skills são pastas). */
  suffix: Record<Target, string>;
  label: { one: string; many: string; feminine: boolean };
  list(): { name: string; description: string }[];
  detect(cwd: string): Target[];
  installedTargets(cwd: string): Target[] | undefined;
  install(options: { cwd: string; targets: Target[]; force: boolean }): InstallReport;
  check(cwd: string): CheckReport;
}

function groupOps(group: Group, io: Io): GroupOps {
  const version = io.version;
  if (group === "skills") {
    const source = join(io.packageRoot, "skills");
    return {
      dirs: TARGET_DIRS,
      suffix: { claude: "", agents: "" },
      label: { one: "skill", many: "skills", feminine: true },
      list: () => listSkills(source),
      detect: detectTargets,
      installedTargets: (cwd) => {
        const targets = readLock(cwd)?.targets;
        return targets && targets.length > 0 ? targets : undefined;
      },
      install: (options) => installSkills({ source, version, ...options }),
      check: (cwd) => checkSkills({ source, cwd, version }),
    };
  }
  const source = join(io.packageRoot, "agents");
  return {
    dirs: AGENT_DIRS,
    suffix: { claude: ".md", agents: ".toml" },
    label: { one: "agente", many: "agentes", feminine: false },
    list: () => listAgents(source),
    detect: detectAgentTargets,
    installedTargets: (cwd) => readLock(cwd)?.agents?.targets,
    install: (options) => installAgents({ source, version, ...options }),
    check: (cwd) => checkAgents({ source, cwd, version }),
  };
}

function describeProblem(kind: Exclude<Problem["kind"], "not-installed">, feminine: boolean) {
  const end = feminine ? "a" : "o";
  return {
    missing: "ausente",
    modified: `editad${end} localmente`,
    outdated: `desatualizad${end}`,
    obsolete: "não existe mais no pacote",
  }[kind];
}

function printInstall(report: InstallReport, ops: GroupOps, io: Io): void {
  const where = (target: Target, name: string) =>
    `${ops.dirs[target]}/${name}${ops.suffix[target]}`;
  const end = ops.label.feminine ? "a" : "o";
  for (const { target, name } of report.installed) io.out(`+ ${where(target, name)}`);
  for (const { target, name } of report.removed) io.out(`- ${where(target, name)}`);
  for (const { target, name, reason } of report.skipped) {
    const why =
      reason === "modified" ? `editad${end} localmente` : `não foi instalad${end} pelo core-kernel`;
    io.err(`! ${where(target, name)} mantid${end}: ${why} (use --force para sobrescrever)`);
  }
  if (report.unchanged.length > 0) {
    io.out(`= ${report.unchanged.length} já atualizad${end}(s)`);
  }
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

  const { group } = options;
  const ops = groupOps(group, io);
  const cwd = options.cwd ?? io.cwd;
  const { one, many, feminine } = ops.label;

  switch (options.command) {
    case "list":
      for (const { name, description } of ops.list()) io.out(`${name}\n  ${description}`);
      return 0;

    case "add":
      printInstall(
        ops.install({ cwd, targets: options.targets ?? ops.detect(cwd), force: options.force }),
        ops,
        io,
      );
      return 0;

    case "update": {
      const installed = ops.installedTargets(cwd);
      if (!installed) {
        io.err(
          `Nenhum${feminine ? "a" : ""} ${one} instalad${feminine ? "a" : "o"}. Rode: core-kernel ${group} add`,
        );
        return 1;
      }
      printInstall(
        ops.install({ cwd, targets: options.targets ?? installed, force: options.force }),
        ops,
        io,
      );
      return 0;
    }

    case "check": {
      const { ok, problems } = ops.check(cwd);
      const Many = many[0]?.toUpperCase() + many.slice(1);
      if (ok) {
        io.out(`${Many} do core-kernel ${io.version} em dia.`);
        return 0;
      }
      for (const problem of problems) {
        if (problem.kind === "not-installed") {
          io.err(`${Many} do core-kernel não instalad${feminine ? "a" : "o"}s.`);
        } else {
          const where = `${ops.dirs[problem.target]}/${problem.name}${ops.suffix[problem.target]}`;
          io.err(`${where}: ${describeProblem(problem.kind, feminine)}`);
        }
      }
      io.err(`Rode: core-kernel ${group} update (ou add, se nunca instalou)`);
      return 1;
    }

    default:
      io.err(`Comando desconhecido: ${group} ${options.command ?? ""}`.trim());
      io.err("Veja: core-kernel --help");
      return 1;
  }
}
