// Agentes (subagentes) do core-kernel no projeto consumidor. A fonte única é `agents/<nome>.md`
// (formato do Claude Code: frontmatter + prompt). Para o Codex, o mesmo conteúdo vira
// `.codex/agents/<nome>.toml`, com o prompt em `developer_instructions`.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
  type ArtifactKind,
  type CheckReport,
  check,
  frontmatter,
  hashText,
  type InstallReport,
  install,
  type Lock,
  TARGET_ORDER,
  type Target,
} from "./artifacts.js";

export const AGENT_DIRS: Record<Target, string> = {
  claude: ".claude/agents", // Claude Code
  agents: ".codex/agents", // Codex
};

const EXTENSION: Record<Target, string> = { claude: ".md", agents: ".toml" };

interface Context {
  /** Pasta `agents/` do pacote. */
  source: string;
  cwd: string;
  version: string;
}

export function agentNames(source: string): string[] {
  if (!existsSync(source)) return [];
  return readdirSync(source)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.slice(0, -".md".length))
    .sort();
}

export function listAgents(source: string): { name: string; description: string }[] {
  return agentNames(source).map((name) => ({
    name,
    description: frontmatter(readFileSync(join(source, `${name}.md`), "utf8")).description ?? "",
  }));
}

/** String TOML básica multilinha (`"""`), escapando barras e aspas triplas. */
const tomlMultiline = (text: string) =>
  `"""\n${text.replace(/\\/g, "\\\\").replace(/"""/g, '""\\"')}"""`;

const tomlString = (text: string) => JSON.stringify(text);

/** Converte o `.md` do agente no formato de agente customizado do Codex. */
export function toCodexToml(markdown: string): string {
  const text = markdown.replace(/\r\n/g, "\n");
  const { name = "", description = "" } = frontmatter(text);
  const body = text.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
  return [
    "# Gerado pelo core-kernel a partir de agents/<nome>.md. Não edite: rode `core-kernel agents update`.",
    `name = ${tomlString(name)}`,
    `description = ${tomlString(description)}`,
    `developer_instructions = ${tomlMultiline(`${body}\n`)}`,
    "",
  ].join("\n");
}

function render(source: string, target: Target, name: string): string {
  const markdown = readFileSync(join(source, `${name}.md`), "utf8");
  return target === "claude" ? markdown : toCodexToml(markdown);
}

/** Targets cujas pastas já existem no projeto; `claude` se não houver nenhuma. */
export function detectAgentTargets(cwd: string): Target[] {
  const found = TARGET_ORDER.filter((target) =>
    target === "claude"
      ? existsSync(join(cwd, ".claude"))
      : existsSync(join(cwd, ".codex")) || existsSync(join(cwd, ".agents")),
  );
  return found.length > 0 ? found : ["claude"];
}

function agentsKind(source: string): ArtifactKind {
  const path = (cwd: string, target: Target, name: string) =>
    join(cwd, AGENT_DIRS[target], `${name}${EXTENSION[target]}`);
  return {
    names: () => agentNames(source),
    path,
    sourceHash: (target, name) => hashText(render(source, target, name)),
    write: (cwd, target, name) => {
      const to = path(cwd, target, name);
      mkdirSync(dirname(to), { recursive: true });
      if (target === "claude") copyFileSync(join(source, `${name}.md`), to);
      else writeFileSync(to, render(source, target, name));
    },
    readSection: (lock) => lock?.agents ?? null,
    writeSection: (lock, section): Lock => ({
      version: lock?.version ?? section.version,
      targets: lock?.targets ?? [],
      skills: lock?.skills ?? {},
      ...lock,
      agents: section,
    }),
  };
}

export function installAgents({
  source,
  ...options
}: Context & { targets: Target[]; force?: boolean }): InstallReport {
  return install(agentsKind(source), options);
}

export function checkAgents({ source, cwd }: Context): CheckReport {
  return check(agentsKind(source), cwd);
}
