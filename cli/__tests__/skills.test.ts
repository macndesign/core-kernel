import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkSkills,
  detectTargets,
  installSkills,
  LOCK_FILE,
  listSkills,
  readLock,
  TARGET_DIRS,
} from "../skills.js";

let root: string;
let source: string;
let project: string;

const writeSkill = (name: string, body = `# ${name}`) => {
  mkdirSync(join(source, name, "references"), { recursive: true });
  writeFileSync(
    join(source, name, "SKILL.md"),
    `---\nname: ${name}\ndescription: Skill ${name}\n---\n\n${body}\n`,
  );
  writeFileSync(join(source, name, "references", "pattern.md"), `pattern of ${name}\n`);
};

const installed = (target: "claude" | "agents", name: string, file = "SKILL.md") =>
  join(project, TARGET_DIRS[target], name, file);

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "core-kernel-cli-"));
  source = join(root, "source");
  project = join(root, "project");
  mkdirSync(project, { recursive: true });
  writeSkill("ddd-entity");
  writeSkill("ddd-use-case");
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("listSkills", () => {
  it("lista as skills do pacote com a descrição do frontmatter", () => {
    expect(listSkills(source)).toEqual([
      { name: "ddd-entity", description: "Skill ddd-entity" },
      { name: "ddd-use-case", description: "Skill ddd-use-case" },
    ]);
  });
});

describe("detectTargets", () => {
  it("usa as pastas de agente que já existem no projeto", () => {
    mkdirSync(join(project, ".agents"));
    expect(detectTargets(project)).toEqual(["agents"]);

    mkdirSync(join(project, ".claude"));
    expect(detectTargets(project)).toEqual(["claude", "agents"]);
  });

  it("assume claude quando não há nenhuma", () => {
    expect(detectTargets(project)).toEqual(["claude"]);
  });
});

describe("installSkills", () => {
  it("copia as skills para cada target e grava o lock", () => {
    const report = installSkills({
      source,
      cwd: project,
      version: "1.0.0",
      targets: ["claude", "agents"],
    });

    expect(readFileSync(installed("claude", "ddd-entity"), "utf8")).toContain("name: ddd-entity");
    expect(existsSync(installed("agents", "ddd-use-case", "references/pattern.md"))).toBe(true);
    expect(report.installed).toHaveLength(4);
    const lock = readLock(project);
    expect(lock?.version).toBe("1.0.0");
    expect(lock?.targets).toEqual(["claude", "agents"]);
    expect(Object.keys(lock?.skills.claude ?? {})).toEqual(["ddd-entity", "ddd-use-case"]);
    expect(Object.keys(lock?.skills.agents ?? {})).toEqual(["ddd-entity", "ddd-use-case"]);
    expect(existsSync(join(project, LOCK_FILE))).toBe(true);
  });

  it("é idempotente", () => {
    installSkills({ source, cwd: project, version: "1.0.0", targets: ["claude"] });
    const report = installSkills({ source, cwd: project, version: "1.0.0", targets: ["claude"] });

    expect(report.installed).toEqual([]);
    expect(report.unchanged).toHaveLength(2);
  });

  it("preserva skill editada localmente e avisa (sem --force)", () => {
    installSkills({ source, cwd: project, version: "1.0.0", targets: ["claude"] });
    writeFileSync(installed("claude", "ddd-entity"), "minha versão");
    writeSkill("ddd-entity", "nova versão do pacote");

    const report = installSkills({ source, cwd: project, version: "1.1.0", targets: ["claude"] });

    expect(readFileSync(installed("claude", "ddd-entity"), "utf8")).toBe("minha versão");
    expect(report.skipped).toEqual([{ target: "claude", name: "ddd-entity", reason: "modified" }]);
  });

  it("--force sobrescreve skill editada", () => {
    installSkills({ source, cwd: project, version: "1.0.0", targets: ["claude"] });
    writeFileSync(installed("claude", "ddd-entity"), "minha versão");

    installSkills({ source, cwd: project, version: "1.0.0", targets: ["claude"], force: true });

    expect(readFileSync(installed("claude", "ddd-entity"), "utf8")).toContain("name: ddd-entity");
  });

  it("não sobrescreve skill de mesmo nome que não foi instalada pelo core-kernel", () => {
    mkdirSync(join(project, ".claude/skills/ddd-entity"), { recursive: true });
    writeFileSync(installed("claude", "ddd-entity"), "skill de outra origem");

    const report = installSkills({ source, cwd: project, version: "1.0.0", targets: ["claude"] });

    expect(readFileSync(installed("claude", "ddd-entity"), "utf8")).toBe("skill de outra origem");
    expect(report.skipped).toEqual([{ target: "claude", name: "ddd-entity", reason: "foreign" }]);
  });

  it("atualiza skills não modificadas para a nova versão do pacote", () => {
    installSkills({ source, cwd: project, version: "1.0.0", targets: ["claude"] });
    writeSkill("ddd-entity", "nova versão do pacote");

    const report = installSkills({ source, cwd: project, version: "1.1.0", targets: ["claude"] });

    expect(readFileSync(installed("claude", "ddd-entity"), "utf8")).toContain("nova versão");
    expect(report.installed).toEqual([{ target: "claude", name: "ddd-entity" }]);
    expect(readLock(project)?.version).toBe("1.1.0");
  });

  it("remove skills que saíram do pacote, se não foram editadas", () => {
    installSkills({ source, cwd: project, version: "1.0.0", targets: ["claude"] });
    rmSync(join(source, "ddd-use-case"), { recursive: true });

    const report = installSkills({ source, cwd: project, version: "1.1.0", targets: ["claude"] });

    expect(existsSync(installed("claude", "ddd-use-case"))).toBe(false);
    expect(report.removed).toEqual([{ target: "claude", name: "ddd-use-case" }]);
    expect(Object.keys(readLock(project)?.skills.claude ?? {})).toEqual(["ddd-entity"]);
  });

  it("mantém skill que saiu do pacote se foi editada localmente", () => {
    installSkills({ source, cwd: project, version: "1.0.0", targets: ["claude"] });
    writeFileSync(installed("claude", "ddd-use-case"), "editada");
    rmSync(join(source, "ddd-use-case"), { recursive: true });

    const report = installSkills({ source, cwd: project, version: "1.1.0", targets: ["claude"] });

    expect(readFileSync(installed("claude", "ddd-use-case"), "utf8")).toBe("editada");
    expect(report.skipped).toEqual([
      { target: "claude", name: "ddd-use-case", reason: "modified" },
    ]);
  });

  it("acrescenta targets aos já registrados no lock", () => {
    installSkills({ source, cwd: project, version: "1.0.0", targets: ["claude"] });
    installSkills({ source, cwd: project, version: "1.0.0", targets: ["agents"] });

    expect(readLock(project)?.targets).toEqual(["claude", "agents"]);
    expect(existsSync(installed("claude", "ddd-entity"))).toBe(true);
    expect(existsSync(installed("agents", "ddd-entity"))).toBe(true);
  });

  it("ignora diferença de quebra de linha (CRLF do git no Windows)", () => {
    installSkills({ source, cwd: project, version: "1.0.0", targets: ["claude"] });
    const file = installed("claude", "ddd-entity");
    writeFileSync(file, readFileSync(file, "utf8").replace(/\n/g, "\r\n"));

    expect(checkSkills({ source, cwd: project, version: "1.0.0" }).ok).toBe(true);
  });
});

describe("checkSkills", () => {
  it("falha sem lock (skills nunca instaladas)", () => {
    const report = checkSkills({ source, cwd: project, version: "1.0.0" });

    expect(report.ok).toBe(false);
    expect(report.problems).toEqual([{ kind: "not-installed" }]);
  });

  it("ok quando instalado e em dia", () => {
    installSkills({ source, cwd: project, version: "1.0.0", targets: ["claude"] });

    expect(checkSkills({ source, cwd: project, version: "1.0.0" })).toEqual({
      ok: true,
      problems: [],
    });
  });

  it("aponta skills desatualizadas, editadas e ausentes", () => {
    installSkills({ source, cwd: project, version: "1.0.0", targets: ["claude"] });
    writeFileSync(installed("claude", "ddd-entity"), "editada");
    rmSync(join(project, ".claude/skills/ddd-use-case"), { recursive: true });
    writeSkill("ddd-new");

    const report = checkSkills({ source, cwd: project, version: "1.1.0" });

    expect(report.ok).toBe(false);
    expect(report.problems).toEqual([
      { kind: "modified", target: "claude", name: "ddd-entity" },
      { kind: "missing", target: "claude", name: "ddd-new" },
      { kind: "missing", target: "claude", name: "ddd-use-case" },
    ]);
  });

  it("aponta skill obsoleta (saiu do pacote, ainda instalada)", () => {
    installSkills({ source, cwd: project, version: "1.0.0", targets: ["claude"] });
    rmSync(join(source, "ddd-use-case"), { recursive: true });

    expect(checkSkills({ source, cwd: project, version: "1.1.0" }).problems).toEqual([
      { kind: "obsolete", target: "claude", name: "ddd-use-case" },
    ]);
  });

  it("aponta conteúdo desatualizado em relação ao pacote", () => {
    installSkills({ source, cwd: project, version: "1.0.0", targets: ["claude"] });
    writeSkill("ddd-entity", "mudou no pacote");

    expect(checkSkills({ source, cwd: project, version: "1.1.0" }).problems).toEqual([
      { kind: "outdated", target: "claude", name: "ddd-entity" },
    ]);
  });
});
