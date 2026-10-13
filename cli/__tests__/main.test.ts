import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Io, run } from "../main.js";

let root: string;
let project: string;
let out: string[];
let err: string[];

const io = (version = "1.0.0"): Io => ({
  cwd: project,
  packageRoot: join(root, "pkg"),
  version,
  out: (line) => out.push(line),
  err: (line) => err.push(line),
});

const writeSkill = (name: string, body = "") => {
  const dir = join(root, "pkg", "skills", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: "Faz ${name}"\n---\n${body}`,
  );
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "core-kernel-main-"));
  project = join(root, "project");
  mkdirSync(project);
  writeSkill("ddd-entity");
  out = [];
  err = [];
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("ajuda e versão", () => {
  it.each([[[]], [["--help"]], [["skills", "-h"]]])("%p mostra o uso", (argv) => {
    expect(run(argv, io())).toBe(0);
    expect(out.join("\n")).toContain("Uso: core-kernel skills");
  });

  it("--version mostra a versão", () => {
    expect(run(["--version"], io("2.3.4"))).toBe(0);
    expect(out).toEqual(["2.3.4"]);
  });
});

describe("erros de uso", () => {
  it.each([
    [["init"], "Comando desconhecido: init"],
    [["skills", "add", "--target", "vscode"], "Target inválido: vscode"],
    [["skills", "add", "--target"], "Valor ausente para --target"],
    [["skills", "add", "--nope"], "Argumento desconhecido: --nope"],
    [["skills", "explode"], "Comando desconhecido: skills explode"],
    [["skills"], "Comando desconhecido: skills"],
  ])("%p", (argv, message) => {
    expect(run(argv, io())).toBe(1);
    expect(err[0]).toContain(message);
  });
});

describe("skills list", () => {
  it("lista nome e descrição", () => {
    expect(run(["skills", "list"], io())).toBe(0);
    expect(out).toEqual(["ddd-entity\n  Faz ddd-entity"]);
  });
});

describe("skills add / update / check", () => {
  it("add instala no target detectado e check passa", () => {
    expect(run(["skills", "add"], io())).toBe(0);
    expect(out).toEqual(["+ .claude/skills/ddd-entity"]);

    out = [];
    expect(run(["skills", "check"], io())).toBe(0);
    expect(out).toEqual(["Skills do core-kernel 1.0.0 em dia."]);
  });

  it("add aceita --target all e --cwd", () => {
    const other = join(root, "other");
    mkdirSync(other);

    expect(run(["skills", "add", "--target", "all", "--cwd", other], io())).toBe(0);
    expect(existsSync(join(other, ".claude/skills/ddd-entity/SKILL.md"))).toBe(true);
    expect(existsSync(join(other, ".agents/skills/ddd-entity/SKILL.md"))).toBe(true);
  });

  it("segunda execução informa que já está atualizado", () => {
    run(["skills", "add", "--target", "agents"], io());
    out = [];

    run(["skills", "add", "--target", "agents"], io());
    expect(out).toEqual(["= 1 já atualizada(s)"]);
  });

  it("update sem instalação prévia falha com instrução", () => {
    expect(run(["skills", "update"], io())).toBe(1);
    expect(err[0]).toContain("core-kernel skills add");
  });

  it("update aplica a nova versão, remove skills obsoletas e preserva edições", () => {
    run(["skills", "add"], io());
    writeSkill("ddd-new");
    writeSkill("ddd-entity", "mudou");
    writeFileSync(join(project, ".claude/skills/ddd-entity/SKILL.md"), "editada");
    out = [];

    expect(run(["skills", "update"], io("1.1.0"))).toBe(0);
    expect(out).toEqual(["+ .claude/skills/ddd-new"]);
    expect(err[0]).toContain("ddd-entity mantida: editada localmente");

    rmSync(join(root, "pkg/skills/ddd-new"), { recursive: true });
    out = [];
    run(["skills", "update", "--force"], io("1.2.0"));
    expect(out).toEqual(["+ .claude/skills/ddd-entity", "- .claude/skills/ddd-new"]);
  });

  it("add informa skill de outra origem", () => {
    mkdirSync(join(project, ".claude/skills/ddd-entity"), { recursive: true });
    writeFileSync(join(project, ".claude/skills/ddd-entity/SKILL.md"), "outra");

    run(["skills", "add"], io());
    expect(err[0]).toContain("não foi instalada pelo core-kernel");
  });

  it("check falha e descreve cada problema", () => {
    expect(run(["skills", "check"], io())).toBe(1);
    expect(err[0]).toBe("Skills do core-kernel não instaladas.");

    run(["skills", "add"], io());
    writeSkill("ddd-entity", "mudou");
    err = [];
    expect(run(["skills", "check"], io("1.1.0"))).toBe(1);
    expect(err).toEqual([
      ".claude/skills/ddd-entity: desatualizada",
      "Rode: core-kernel skills update (ou add, se nunca instalou)",
    ]);
  });
});
