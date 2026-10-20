// SessionStart: diz ao agente qual core-kernel o projeto usa e o que falta (skills desatualizadas,
// checker ausente). Fora de projetos com core-kernel, não imprime nada.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

function installedVersion(require, name) {
  try {
    return readJson(require.resolve(`${name}/package.json`)).version;
  } catch {
    return undefined;
  }
}

/** Mensagem para o agente, ou `undefined` se o projeto não usa o core-kernel. */
function sessionContext(projectDir) {
  const require = createRequire(join(projectDir, "package.json"));
  const version = installedVersion(require, "core-kernel");
  if (!version) return undefined;

  const lines = [
    `Este projeto usa o core-kernel ${version}. Siga as skills ddd-* (Result em vez de throw, ids tipados, erros por code/kind, Clock no lugar de new Date()).`,
  ];
  const lockFile = join(projectDir, "core-kernel.skills.json");
  if (existsSync(lockFile)) {
    const lock = readJson(lockFile);
    if (lock.version !== version) {
      lines.push(
        `As skills instaladas no projeto são da versão ${lock.version}. Sugira ao usuário: bunx core-kernel skills update`,
      );
    }
  }
  let checker = true;
  try {
    require.resolve("core-kernel-check");
  } catch {
    checker = false;
  }
  lines.push(
    checker
      ? "O core-kernel-check roda a cada edição de arquivo .ts; corrija os achados (CK001–CK008) antes de seguir."
      : "O core-kernel-check não está instalado: os guardrails automáticos estão desligados. Sugira ao usuário: bun add -d core-kernel-check",
  );
  return lines.join("\n");
}

function main() {
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const context = sessionContext(projectDir);
  if (!context) return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
    }),
  );
}

try {
  main();
} catch {
  // Nunca atrapalha o início da sessão.
}
