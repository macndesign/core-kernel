// Mantém as versões dos manifestos dos plugins iguais à do pacote: Claude Code e Copilot CLI usam
// a versão do plugin para detectar atualizações. Roda depois do `changeset version`.
// Com --check, só confere (usado no check:package).
import { readFileSync, writeFileSync } from "node:fs";

const PLUGIN = ".claude-plugin/plugin.json";
const MARKETPLACE = ".github/plugin/marketplace.json";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const pluginText = readFileSync(PLUGIN, "utf8");
const plugin = JSON.parse(pluginText);
const marketplaceText = readFileSync(MARKETPLACE, "utf8");
const marketplace = JSON.parse(marketplaceText);
const marketplacePlugin = marketplace.plugins.find(({ name }) => name === plugin.name);

if (!marketplacePlugin) {
  throw new Error(`${MARKETPLACE} não contém o plugin ${plugin.name}`);
}

const targets = [
  { path: PLUGIN, version: plugin.version },
  { path: MARKETPLACE, version: marketplace.metadata.version },
  { path: MARKETPLACE, version: marketplacePlugin.version },
];
const outdated = targets.filter((target) => target.version !== version);

if (outdated.length === 0) process.exit(0);
if (process.argv.includes("--check")) {
  for (const target of outdated) {
    console.error(`${target.path} está na versão ${target.version}, o pacote na ${version}.`);
  }
  console.error("Rode: node scripts/sync-plugin-version.mjs");
  process.exit(1);
}

for (const target of outdated) {
  const text = readFileSync(target.path, "utf8");
  const oldVersion = `"version": "${target.version}"`;
  if (!text.includes(oldVersion)) {
    throw new Error(`Não foi possível localizar a versão ${target.version} em ${target.path}`);
  }
  writeFileSync(target.path, text.replace(oldVersion, `"version": "${version}"`));
  console.log(`${target.path}: ${target.version} → ${version}`);
}
