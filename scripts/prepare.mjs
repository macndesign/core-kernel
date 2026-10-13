// Instala os git hooks só no clone de desenvolvimento. O `prepare` também roda em
// `npm pack`/`bun pm pack` e em instalações a partir do git, onde não há hooks a instalar
// (ou o binário não está no PATH) — nesses casos não faz nada.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const cli = "node_modules/simple-git-hooks/cli.js";
if (existsSync(".git") && existsSync(cli)) {
  execFileSync(process.execPath, [cli], { stdio: "inherit" });
}
