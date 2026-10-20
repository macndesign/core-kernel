import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AGENT_DIRS,
  checkAgents,
  detectAgentTargets,
  installAgents,
  listAgents,
  toCodexToml,
} from "../agents.js";
import { readLock } from "../artifacts.js";
import { installSkills } from "../skills.js";

let root: string;
let source: string;
let project: string;

const agent = (name: string, body = `Você é o ${name}.`) =>
  `---\nname: ${name}\ndescription: Agente ${name}\ntools: Read, Grep\n---\n\n${body}\n`;

const writeAgent = (name: string, body?: string) =>
  writeFileSync(join(source, `${name}.md`), agent(name, body));

const context = (version = "1.0.0") => ({ source, cwd: project, version });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "core-kernel-agents-"));
  source = join(root, "agents");
  project = join(root, "project");
  mkdirSync(source, { recursive: true });
  mkdirSync(project, { recursive: true });
  writeAgent("ddd-reviewer");
  writeAgent("ddd-architect");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("toCodexToml", () => {
  it("leva name, description e o corpo para developer_instructions", () => {
    const toml = toCodexToml(agent("ddd-reviewer", 'Use "aspas", \\barras e """ triplas.'));
    expect(toml).toContain('name = "ddd-reviewer"');
    expect(toml).toContain('description = "Agente ddd-reviewer"');
    expect(toml).toContain(
      'developer_instructions = """\nUse "aspas", \\\\barras e ""\\" triplas.\n"""',
    );
    expect(toml).not.toContain("tools:");
  });
});

describe("listAgents / detectAgentTargets", () => {
  it("lista os agentes do pacote", () => {
    expect(listAgents(source)).toEqual([
      { name: "ddd-architect", description: "Agente ddd-architect" },
      { name: "ddd-reviewer", description: "Agente ddd-reviewer" },
    ]);
  });

  it("detecta .claude e .codex/.agents; claude por padrão", () => {
    expect(detectAgentTargets(project)).toEqual(["claude"]);
    mkdirSync(join(project, ".codex"));
    expect(detectAgentTargets(project)).toEqual(["agents"]);
  });
});

describe("installAgents", () => {
  it("copia o .md para o Claude e gera o .toml para o Codex", () => {
    const report = installAgents({ ...context(), targets: ["claude", "agents"] });
    expect(report.installed).toHaveLength(4);
    const md = join(project, AGENT_DIRS.claude, "ddd-reviewer.md");
    const toml = join(project, AGENT_DIRS.agents, "ddd-reviewer.toml");
    expect(readFileSync(md, "utf8")).toBe(agent("ddd-reviewer"));
    expect(readFileSync(toml, "utf8")).toContain('name = "ddd-reviewer"');
    expect(readLock(project)?.agents?.targets).toEqual(["claude", "agents"]);
    expect(checkAgents(context())).toEqual({ ok: true, problems: [] });
  });

  it("preserva o agente editado localmente sem --force", () => {
    installAgents({ ...context(), targets: ["agents"] });
    const toml = join(project, AGENT_DIRS.agents, "ddd-reviewer.toml");
    writeFileSync(toml, "editado");
    writeAgent("ddd-reviewer", "nova versão");

    const report = installAgents({ ...context("1.1.0"), targets: ["agents"] });
    expect(report.skipped).toEqual([
      { target: "agents", name: "ddd-reviewer", reason: "modified" },
    ]);
    expect(readFileSync(toml, "utf8")).toBe("editado");
    expect(checkAgents(context()).problems).toEqual([
      { kind: "modified", target: "agents", name: "ddd-reviewer" },
    ]);

    installAgents({ ...context("1.1.0"), targets: ["agents"], force: true });
    expect(readFileSync(toml, "utf8")).toContain("nova versão");
  });

  it("detecta agente desatualizado e remove o que saiu do pacote", () => {
    installAgents({ ...context(), targets: ["claude"] });
    writeAgent("ddd-architect", "mudou");
    expect(checkAgents(context()).problems).toEqual([
      { kind: "outdated", target: "claude", name: "ddd-architect" },
    ]);
    rmSync(join(source, "ddd-reviewer.md"));
    const report = installAgents({ ...context("1.1.0"), targets: [] });
    expect(report.removed).toEqual([{ target: "claude", name: "ddd-reviewer" }]);
    expect(existsSync(join(project, AGENT_DIRS.claude, "ddd-reviewer.md"))).toBe(false);
  });

  it("convive com as skills no mesmo lock", () => {
    const skills = join(root, "skills");
    mkdirSync(join(skills, "ddd-entity"), { recursive: true });
    writeFileSync(join(skills, "ddd-entity", "SKILL.md"), "---\nname: ddd-entity\n---\n");

    installSkills({ source: skills, cwd: project, version: "1.0.0", targets: ["claude"] });
    installAgents({ ...context(), targets: ["claude"] });
    installSkills({ source: skills, cwd: project, version: "1.0.0", targets: ["claude"] });

    const lock = readLock(project);
    expect(Object.keys(lock?.skills.claude ?? {})).toEqual(["ddd-entity"]);
    expect(Object.keys(lock?.agents?.items.claude ?? {})).toEqual([
      "ddd-architect",
      "ddd-reviewer",
    ]);
  });

  it("check sem agentes instalados", () => {
    expect(checkAgents(context()).problems).toEqual([{ kind: "not-installed" }]);
  });
});
