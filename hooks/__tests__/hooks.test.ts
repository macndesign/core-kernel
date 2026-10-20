import { afterEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOOKS = join(import.meta.dir, "..");
let projects: string[] = [];

afterEach(() => {
  for (const dir of projects) rmSync(dir, { recursive: true, force: true });
  projects = [];
});

/** Projeto descartável com pacotes falsos em `node_modules`. */
function project(
  packages: Record<string, Record<string, string>>,
  files: Record<string, string> = {},
) {
  const dir = mkdtempSync(join(tmpdir(), "ck-hook-"));
  projects.push(dir);
  writeFileSync(join(dir, "package.json"), "{}");
  for (const [name, contents] of Object.entries(packages)) {
    const root = join(dir, "node_modules", name);
    mkdirSync(root, { recursive: true });
    for (const [file, text] of Object.entries(contents)) writeFileSync(join(root, file), text);
  }
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
  return dir;
}

const coreKernel = (version: string) => ({
  "package.json": JSON.stringify({ name: "core-kernel", version }),
});

/** Checker falso: devolve 2 e ecoa o evento, como o real faria com achados. */
const fakeChecker = {
  "package.json": JSON.stringify({ name: "core-kernel-check", type: "module", main: "index.js" }),
  "index.js": `export async function run(argv, io) {
    io.err("achado: " + argv.join(" ") + " " + JSON.parse(await io.readStdin()).tool_input.file_path);
    return 2;
  }`,
};

function hook(script: string, dir: string, stdin = "") {
  return spawnSync("node", [join(HOOKS, script)], {
    input: stdin,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
  });
}

describe("check-hook.mjs", () => {
  const event = JSON.stringify({ tool_input: { file_path: "src/a.ts" } });

  it("repassa o evento ao core-kernel-check do projeto e devolve o código dele", () => {
    const dir = project({ "core-kernel-check": fakeChecker });
    const result = hook("check-hook.mjs", dir, event);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("achado: --hook src/a.ts");
  });

  it("sem o checker instalado, sai com 0 em silêncio", () => {
    const result = hook("check-hook.mjs", project({}), event);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("com stdin inválido, sai com 0", () => {
    const dir = project({ "core-kernel-check": fakeChecker });
    expect(hook("check-hook.mjs", dir, "{").status).toBe(0);
  });
});

describe("session-start.mjs", () => {
  const context = (stdout: string) =>
    (JSON.parse(stdout) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput
      .additionalContext;

  it("fora de projetos com core-kernel, não imprime nada", () => {
    const result = hook("session-start.mjs", project({}));
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("informa a versão e sugere instalar o checker", () => {
    const result = hook("session-start.mjs", project({ "core-kernel": coreKernel("0.3.0") }));
    const text = context(result.stdout);
    expect(text).toContain("core-kernel 0.3.0");
    expect(text).toContain("bun add -d core-kernel-check");
  });

  it("avisa quando as skills instaladas são de outra versão", () => {
    const dir = project(
      { "core-kernel": coreKernel("0.3.0"), "core-kernel-check": fakeChecker },
      { "core-kernel.skills.json": JSON.stringify({ version: "0.2.0", targets: [], skills: {} }) },
    );
    const text = context(hook("session-start.mjs", dir).stdout);
    expect(text).toContain("versão 0.2.0");
    expect(text).toContain("skills update");
    expect(text).toContain("roda a cada edição");
  });
});
