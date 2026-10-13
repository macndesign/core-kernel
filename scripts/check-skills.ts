// Valida as skills publicadas (skills/) e o llms.txt:
// 1. Frontmatter de cada SKILL.md (name = pasta, description) e agents/openai.yaml.
// 2. Todo bloco ```ts das references e do llms.txt compila contra o pacote buildado,
//    e os blocos de teste (`// file: x.test.ts`) passam.
//
// Convenções dos blocos:
// - ```ts nocheck   → ignorado (pseudocódigo, assinaturas).
// - `// file: x.ts` na 1ª linha → nome do arquivo; blocos do mesmo documento podem se
//   importar (`import { X } from "./x.js"`), como num projeto real.
//
// Requer `bun run build` antes: os blocos importam `core-kernel` pelo nome do pacote.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { $ } from "bun";

const SKILLS_DIR = "skills";
const OUT_DIR = ".skills-check";
const errors: string[] = [];

function checkFrontmatter(skill: string): void {
  const file = join(SKILLS_DIR, skill, "SKILL.md");
  const content = readFileSync(file, "utf8");
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1];
  if (!frontmatter) {
    errors.push(`${file}: frontmatter ausente`);
    return;
  }
  const field = (key: string) =>
    new RegExp(`^${key}:\\s*(.+)$`, "m").exec(frontmatter)?.[1]?.trim();
  const name = field("name");
  const description = field("description")?.replace(/^["']|["']$/g, "");
  if (name !== skill) errors.push(`${file}: name "${name}" deve ser igual à pasta "${skill}"`);
  if (!/^[a-z0-9-]+$/.test(skill)) errors.push(`${file}: nome deve ser kebab-case`);
  if (!description) errors.push(`${file}: description ausente`);
  else if (description.length > 1024) errors.push(`${file}: description acima de 1024 caracteres`);

  const yaml = join(SKILLS_DIR, skill, "agents", "openai.yaml");
  if (!existsSync(yaml)) errors.push(`${yaml}: ausente (metadados para Codex)`);
  else if (!/display_name:/.test(readFileSync(yaml, "utf8"))) {
    errors.push(`${yaml}: display_name ausente`);
  }
}

/** Extrai os blocos ```ts de um documento para `OUT_DIR/<id>/`. Devolve quantos extraiu. */
function extractBlocks(source: string, id: string): number {
  const content = readFileSync(source, "utf8").replace(/\r\n/g, "\n");
  const dir = join(OUT_DIR, id);
  const used = new Set<string>();
  let count = 0;

  for (const match of content.matchAll(/^```([^\n]*)\n([\s\S]*?)^```$/gm)) {
    const info = (match[1] ?? "").trim().split(/\s+/);
    if (!["ts", "typescript"].includes(info[0] ?? "") || info.includes("nocheck")) continue;
    const code = match[2] ?? "";
    const name = /^\/\/ file: (\S+\.ts)\n/.exec(code)?.[1] ?? `block-${count + 1}.ts`;
    if (used.has(name)) errors.push(`${source}: dois blocos com o arquivo ${name}`);
    used.add(name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), code);
    count++;
  }
  return count;
}

rmSync(OUT_DIR, { recursive: true, force: true });

const skills = readdirSync(SKILLS_DIR).filter((name) =>
  existsSync(join(SKILLS_DIR, name, "SKILL.md")),
);
let blocks = 0;
for (const skill of skills) {
  checkFrontmatter(skill);
  const refs = join(SKILLS_DIR, skill, "references");
  if (!existsSync(refs)) continue;
  for (const ref of readdirSync(refs).filter((f) => f.endsWith(".md"))) {
    blocks += extractBlocks(join(refs, ref), `${skill}/${basename(ref, ".md")}`);
  }
  blocks += extractBlocks(join(SKILLS_DIR, skill, "SKILL.md"), `${skill}/SKILL`);
}
blocks += extractBlocks("llms.txt", "llms");

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

writeFileSync(
  join(OUT_DIR, "tsconfig.json"),
  JSON.stringify({ extends: "../tsconfig.json", include: ["**/*.ts"] }, null, 2),
);
const result = await $`tsc -p ${join(OUT_DIR, "tsconfig.json")}`.nothrow();
if (result.exitCode !== 0) {
  console.error(`Blocos de código das skills/llms.txt não compilam (veja ${OUT_DIR}/).`);
  process.exit(1);
}
// Blocos de teste (*.test.ts) também rodam: o exemplo precisa compilar E se comportar como diz.
const tests = await $`bun test ./${OUT_DIR}`.nothrow();
if (tests.exitCode !== 0) {
  console.error("Testes dos blocos de código das skills falharam.");
  process.exit(1);
}
console.log(`Skills ok: ${skills.length} skills, ${blocks} blocos de código compilados.`);
