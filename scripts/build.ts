// Build dual ESM + CJS sem bundler: o tsc emite um arquivo por módulo, então cada classe
// existe uma única vez por formato — mesmo quando importada por subpaths diferentes
// (`core-kernel`, `core-kernel/vo`, ...). Um bundler duplicaria o código compartilhado
// em cada entrypoint e quebraria identidade de classe (instanceof) entre eles.
import { rmSync, writeFileSync } from "node:fs";
import { $ } from "bun";

rmSync("dist", { recursive: true, force: true });

await $`tsc -p tsconfig.esm.json`;
await $`tsc -p tsconfig.cjs.json`;
// CLI de skills: só ESM e usa node:fs, por isso fica fora da lib (que é agnóstica de runtime).
await $`tsc -p tsconfig.cli.json`;

// O package.json raiz é "type": "module"; este marca dist/cjs como CommonJS para o Node
// e para o TypeScript (os .d.ts dali passam a descrever módulos CJS).
writeFileSync("dist/cjs/package.json", `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`);
