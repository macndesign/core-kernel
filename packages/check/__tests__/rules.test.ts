import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { check } from "../src/program.js";

const PROJECT = join(import.meta.dir, "../__fixtures__/projeto");
const SRC = join(PROJECT, "src");
const fixtures = readdirSync(SRC).filter((file) => file.endsWith(".ts"));

/** `linha:CKxxx` esperados, lidos das marcas `// espera: CKxxx[, CKyyy]`. */
function expected(file: string): string[] {
  return readFileSync(join(SRC, file), "utf8")
    .split(/\r?\n/)
    .flatMap((text, index) => {
      const match = /\/\/ espera: (CK\d{3}(?:, CK\d{3})*)$/.exec(text);
      return match?.[1] ? match[1].split(/,\s*/).map((rule) => `${index + 1}:${rule}`) : [];
    });
}

describe("regras", () => {
  const findings = check({ project: join(PROJECT, "tsconfig.json") });

  it("as fixtures compilam (são código realista)", () => {
    const config = ts.getParsedCommandLineOfConfigFile(
      join(PROJECT, "tsconfig.json"),
      {},
      {
        ...ts.sys,
        onUnRecoverableConfigFileDiagnostic: () => {},
      },
    );
    if (!config) throw new Error("tsconfig das fixtures inválido");
    const program = ts.createProgram(config.fileNames, config.options);
    const messages = ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
    expect(messages).toEqual([]);
  });

  it.each(fixtures)("%s: acusa exatamente as linhas marcadas", (file) => {
    const actual = findings
      .filter((finding) => finding.file.endsWith(`/src/${file}`))
      .map((finding) => `${finding.line}:${finding.rule}`);
    expect(actual).toEqual(expected(file));
  });

  it("cada achado aponta uma skill e tem mensagem", () => {
    for (const finding of findings) {
      expect(finding.skill).toMatch(/^ddd-/);
      expect(finding.message.length).toBeGreaterThan(10);
    }
  });
});

describe("check", () => {
  it("analisa só os arquivos pedidos, mantendo os .d.ts do projeto", () => {
    const findings = check({ files: [join(SRC, "ck001.ts")] });
    expect(new Set(findings.map((finding) => finding.rule))).toEqual(new Set(["CK001"]));
    expect(findings).toHaveLength(4);
  });

  it("supressão sem motivo vira CK000", () => {
    const findings = check({
      files: [join(import.meta.dir, "../__fixtures__/supressao/sem-motivo.ts")],
    });
    expect(findings.map((finding) => finding.rule)).toEqual(["CK000", "CK001"]);
  });

  it("sem tsconfig falha com mensagem clara", () => {
    expect(() => check({ cwd: "/", project: "nao-existe/tsconfig.json" })).toThrow(
      /tsconfig.json não encontrado/,
    );
  });
});
