/**
 * Notas da release do GitHub a partir dos CHANGELOGs gerados pelo Changesets.
 *
 * Uso (no publish.yml, depois do `changeset publish`):
 *   bun scripts/release-notes.ts $(git tag --points-at HEAD --list '*@*')
 *
 * O `changeset publish` cria uma tag git local `nome@versão` para cada pacote que de fato
 * publicou; as notas trazem só esses pacotes. Sem argumentos (ex.: workflow rodado de novo
 * depois de o npm já ter as versões), usa o core-kernel na versão do package.json.
 */
import { readFileSync } from "node:fs";

interface Published {
  name: string;
  version: string;
}

const CHANGELOGS: Record<string, string> = {
  "core-kernel": "CHANGELOG.md",
  "core-kernel-check": "packages/check/CHANGELOG.md",
};

/** Corpo da seção `## <versão>` (sem o título), até a próxima seção do mesmo nível. */
export function extractSection(changelog: string, version: string): string | undefined {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
}

/** Converte as tags `nome@versão` em pacotes, com o core-kernel sempre primeiro. */
export function parsePublished(tags: string[]): Published[] {
  return tags
    .map((tag) => {
      const at = tag.lastIndexOf("@");
      if (at <= 0) throw new Error(`Tag fora do formato nome@versão: ${tag}`);
      return { name: tag.slice(0, at), version: tag.slice(at + 1) };
    })
    .sort((a, b) => Number(b.name === "core-kernel") - Number(a.name === "core-kernel"));
}

export function buildReleaseNotes(
  published: Published[],
  readChangelog: (name: string) => string,
): string {
  const sections = published.map(({ name, version }) => {
    const body = extractSection(readChangelog(name), version);
    if (body === undefined) throw new Error(`Sem seção no CHANGELOG para ${name} ${version}`);
    return `## ${name} ${version}\n\n${body}\n`;
  });
  return sections.join("\n");
}

/** Ponto de entrada: `tags` são os argumentos da linha de comando; `readFile` lê do repositório. */
export function run(tags: string[], readFile: (path: string) => string): string {
  const published =
    tags.length > 0
      ? parsePublished(tags)
      : [{ name: "core-kernel", version: JSON.parse(readFile("package.json")).version }];
  return buildReleaseNotes(published, (name) => {
    const file = CHANGELOGS[name];
    if (!file) throw new Error(`Pacote sem CHANGELOG conhecido: ${name}`);
    return readFile(file);
  });
}

if (import.meta.main) {
  process.stdout.write(run(process.argv.slice(2), (path) => readFileSync(path, "utf8")));
}
