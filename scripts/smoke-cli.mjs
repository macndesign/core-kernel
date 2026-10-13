// Executa o bin publicado (dist/cli) como um consumidor faria: instala as skills num projeto
// temporário, verifica com `check` e confere os arquivos.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const bin = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli", "index.js");
const project = mkdtempSync(join(tmpdir(), "core-kernel-smoke-"));
const cli = (...args) =>
  execFileSync(process.execPath, [bin, ...args, "--cwd", project], { encoding: "utf8" });

try {
  cli("skills", "add", "--target", "all");
  const skills = readdirSync(join(project, ".claude", "skills"));
  assert.ok(skills.length >= 10, `esperava as skills instaladas, veio: ${skills}`);
  assert.ok(existsSync(join(project, ".agents", "skills", "ddd-entity", "SKILL.md")));
  assert.ok(existsSync(join(project, "core-kernel.skills.json")));
  assert.match(cli("skills", "check"), /em dia/);
  console.log(`CLI ok: ${skills.length} skills instaladas em .claude/skills e .agents/skills`);
} finally {
  rmSync(project, { recursive: true, force: true });
}
