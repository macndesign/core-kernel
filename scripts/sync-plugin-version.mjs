// Mantém a versão do plugin (.claude-plugin/plugin.json) igual à do pacote: o Claude Code usa a
// versão do plugin para detectar atualizações. Roda depois do `changeset version`.
// Com --check, só confere (usado no check:package).
import { readFileSync, writeFileSync } from "node:fs";

const PLUGIN = ".claude-plugin/plugin.json";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const text = readFileSync(PLUGIN, "utf8");
const plugin = JSON.parse(text);

if (plugin.version === version) process.exit(0);
if (process.argv.includes("--check")) {
  console.error(
    `${PLUGIN} está na versão ${plugin.version}, o pacote na ${version}. Rode: node scripts/sync-plugin-version.mjs`,
  );
  process.exit(1);
}
writeFileSync(PLUGIN, text.replace(`"version": "${plugin.version}"`, `"version": "${version}"`));
console.log(`${PLUGIN}: ${plugin.version} → ${version}`);
