import { describe, expect, it } from "bun:test";
import { buildReleaseNotes, extractSection, parsePublished, run } from "../release-notes.js";

const changelog = `# core-kernel

## 0.4.0

### Minor Changes

- abc123: Novo recurso.

## 0.4.0-beta.0

### Minor Changes

- abc123: Novo recurso.

## 0.3.0

### Patch Changes

- def456: Correção.
`;

describe("extractSection", () => {
  it("devolve o corpo da versão, sem o título, até a próxima versão", () => {
    expect(extractSection(changelog, "0.4.0")).toBe("### Minor Changes\n\n- abc123: Novo recurso.");
  });

  it("não confunde a versão final com a beta de mesmo número", () => {
    expect(extractSection(changelog, "0.4.0-beta.0")).toBe(
      "### Minor Changes\n\n- abc123: Novo recurso.",
    );
  });

  it("lê a última seção do arquivo", () => {
    expect(extractSection(changelog, "0.3.0")).toBe("### Patch Changes\n\n- def456: Correção.");
  });

  it("devolve undefined quando a versão não está no changelog", () => {
    expect(extractSection(changelog, "9.9.9")).toBeUndefined();
  });
});

describe("parsePublished", () => {
  it("separa nome e versão das tags criadas pelo changeset publish", () => {
    expect(parsePublished(["core-kernel-check@0.2.0", "core-kernel@0.4.0-beta.1"])).toEqual([
      { name: "core-kernel", version: "0.4.0-beta.1" },
      { name: "core-kernel-check", version: "0.2.0" },
    ]);
  });

  it("rejeita o que não tem o formato nome@versão", () => {
    expect(() => parsePublished(["v0.4.0"])).toThrow("v0.4.0");
  });
});

describe("buildReleaseNotes", () => {
  const read = (name: string) => (name === "core-kernel" ? changelog : "## 0.2.0\n\n- Checker.\n");

  it("monta uma seção por pacote publicado", () => {
    const notes = buildReleaseNotes(
      [
        { name: "core-kernel", version: "0.3.0" },
        { name: "core-kernel-check", version: "0.2.0" },
      ],
      read,
    );
    expect(notes).toBe(
      "## core-kernel 0.3.0\n\n### Patch Changes\n\n- def456: Correção.\n\n" +
        "## core-kernel-check 0.2.0\n\n- Checker.\n",
    );
  });

  it("falha se a versão publicada não tem seção no changelog", () => {
    expect(() => buildReleaseNotes([{ name: "core-kernel", version: "9.9.9" }], read)).toThrow(
      "core-kernel 9.9.9",
    );
  });
});

describe("run", () => {
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ version: "0.4.0" }),
    "CHANGELOG.md": changelog,
    "packages/check/CHANGELOG.md": "## 0.2.0\n\n- Checker.\n",
  };
  const readFile = (path: string) => files[path] ?? "";

  it("lê o CHANGELOG de cada pacote publicado", () => {
    expect(run(["core-kernel-check@0.2.0"], readFile)).toBe(
      "## core-kernel-check 0.2.0\n\n- Checker.\n",
    );
  });

  it("sem tags, usa o core-kernel na versão do package.json", () => {
    expect(run([], readFile)).toBe(
      "## core-kernel 0.4.0\n\n### Minor Changes\n\n- abc123: Novo recurso.\n",
    );
  });

  it("falha para pacote sem CHANGELOG conhecido", () => {
    expect(() => run(["outro@1.0.0"], readFile)).toThrow("outro");
  });
});
