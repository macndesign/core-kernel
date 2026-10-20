import { describe, expect, it } from "bun:test";
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
