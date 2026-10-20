// Valida o plugin como ele chega ao usuário: a partir do tarball do npm (fonte do marketplace),
// não da raiz do repositório (que tem CLAUDE.md, testes e afins). Requer o build.
// Sem o CLI do Claude Code instalado, avisa e não falha (o job de CI instala o CLI).
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const shell = process.platform === "win32";
if (spawnSync("claude", ["--version"], { shell }).status !== 0) {
  console.warn("validate-plugin: CLI do Claude Code ausente; validação do plugin ignorada.");
  process.exit(0);
}

const dir = mkdtempSync(join(tmpdir(), "core-kernel-plugin-"));
try {
  const [{ filename }] = JSON.parse(
    execFileSync("npm", ["pack", "--json", "--pack-destination", dir], { encoding: "utf8", shell }),
  );
  execFileSync("tar", ["-xzf", filename], { cwd: dir });
  const result = spawnSync("claude", ["plugin", "validate", join(dir, "package"), "--strict"], {
    stdio: "inherit",
    shell,
  });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
