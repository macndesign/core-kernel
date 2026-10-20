import { describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/cli.js";

const PROJECT = join(import.meta.dir, "../__fixtures__/projeto");

function io(stdin = "") {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      cwd: PROJECT,
      readStdin: async () => stdin,
      out: (text: string) => out.push(text),
      err: (text: string) => err.push(text),
    },
  };
}

describe("core-kernel-check", () => {
  it("lista os achados e sai com 1", async () => {
    const t = io();
    expect(await run(["src/ck001.ts"], t.io)).toBe(1);
    expect(t.out[0]).toMatch(/^src\/ck001\.ts:12:\d+ CK001 .*\(skill: ddd-repository\)$/);
    expect(t.out.at(-1)).toContain("4 problema(s)");
  });

  it("sai com 0 sem achados", async () => {
    const t = io();
    expect(await run(["src/base.ts"], t.io)).toBe(0);
    expect(t.out).toEqual(["core-kernel-check: nenhum problema encontrado."]);
  });

  it("--json", async () => {
    const t = io();
    await run(["src/ck003.ts", "--json"], t.io);
    expect(JSON.parse(t.out[0] as string)).toMatchObject([{ rule: "CK003", line: 11 }]);
  });

  it("opção desconhecida e tsconfig ausente saem com 2", async () => {
    expect(await run(["--nada"], io().io)).toBe(2);
    const t = io();
    expect(await run(["--project", "x/tsconfig.json"], t.io)).toBe(2);
    expect(t.err[0]).toContain("tsconfig.json não encontrado");
  });
});

describe("--hook", () => {
  delete process.env.CLAUDE_PROJECT_DIR;

  const event = (filePath: string) =>
    JSON.stringify({ cwd: PROJECT, tool_name: "Edit", tool_input: { file_path: filePath } });

  it("achados vão para o stderr com código 2", async () => {
    const t = io(event(join(PROJECT, "src/ck002.ts")));
    expect(await run(["--hook"], t.io)).toBe(2);
    expect(t.err[0]).toContain("5 problema(s) em src/ck002.ts");
    expect(t.err[0]).toContain("CK002");
  });

  it.each([
    ["sem achados", event("src/base.ts")],
    ["arquivo que não é TypeScript", event("README.md")],
    ["declaração", event("src/types/pg.d.ts")],
    ["fora do projeto", event("../../src/program.ts")],
    ["stdin inválido", "{"],
    ["sem file_path", JSON.stringify({ tool_input: {} })],
  ])("%s: sai com 0 em silêncio", async (_, stdin) => {
    const t = io(stdin);
    expect(await run(["--hook"], t.io)).toBe(0);
    expect(t.err).toEqual([]);
  });
});

describe("caminhos com outro nome para a mesma pasta", () => {
  // Link para o projeto: o mesmo caso dos nomes curtos 8.3 do Windows (C:\Users\T_MARI~1),
  // em que o projeto chega por um caminho e o TypeScript usa outro.
  it("acusa no hook mesmo com o projeto aberto por um link", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ck-link-"));
    const link = join(dir, "projeto");
    symlinkSync(PROJECT, link, "junction");
    try {
      const t = io(
        JSON.stringify({ cwd: link, tool_input: { file_path: join(link, "src/ck003.ts") } }),
      );
      expect(await run(["--hook"], { ...t.io, cwd: link })).toBe(2);
      expect(t.err[0]).toContain("CK003");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("--hook no Stop (arquivos alterados segundo o git)", () => {
  const DIST = join(import.meta.dir, "../../../dist/esm").replaceAll("\\", "/");
  const BUG =
    'import { UniqueId } from "core-kernel";\nclass PedidoId extends UniqueId {\n  declare private readonly __b: "PedidoId";\n}\ndeclare function registrar(dado: unknown): void;\nregistrar(PedidoId.generate());\n';

  function repositorio() {
    const dir = mkdtempSync(join(tmpdir(), "ck-stop-"));
    const tsconfig = {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        types: [],
        paths: { "core-kernel": [`${DIST}/index.d.ts`] },
      },
      include: ["src"],
    };
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "package.json"), '{ "type": "module" }');
    writeFileSync(join(dir, "tsconfig.json"), JSON.stringify(tsconfig));
    writeFileSync(join(dir, "src/limpo.ts"), "export const x = 1;\n");
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
    git("init", "-q");
    git("add", ".");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init");
    return dir;
  }

  const stop = (dir: string, extra: object = {}) =>
    JSON.stringify({ cwd: dir, hook_event_name: "Stop", stop_hook_active: false, ...extra });

  it("acusa arquivo novo ou alterado, mesmo editado fora do Edit/Write", async () => {
    const dir = repositorio();
    try {
      writeFileSync(join(dir, "src/novo.ts"), BUG);
      const t = io(stop(dir));
      expect(await run(["--hook"], { ...t.io, cwd: dir })).toBe(2);
      expect(t.err[0]).toContain("Corrija antes de encerrar");
      expect(t.err[0]).toContain("src/novo.ts:6:11 CK001");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each([
    ["sem alterações", () => {}, {}],
    [
      "segunda parada seguida (stop_hook_active)",
      (dir: string) => writeFileSync(join(dir, "src/novo.ts"), BUG),
      { stop_hook_active: true },
    ],
  ])("%s: sai com 0", async (_, preparar, extra) => {
    const dir = repositorio();
    try {
      preparar(dir);
      const t = io(stop(dir, extra));
      expect(await run(["--hook"], { ...t.io, cwd: dir })).toBe(0);
      expect(t.err).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fora de um repositório git, sai com 0", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ck-sem-git-"));
    try {
      const t = io(stop(dir));
      expect(await run(["--hook"], { ...t.io, cwd: dir })).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
