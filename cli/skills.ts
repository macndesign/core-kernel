// Skills do core-kernel no projeto consumidor: cada skill é uma pasta copiada como está.
import { cpSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ArtifactKind,
  type CheckReport,
  check,
  frontmatter,
  hashPath,
  type InstallReport,
  install,
  type Lock,
  TARGET_ORDER,
  type Target,
} from "./artifacts.js";

export {
  type CheckReport,
  type InstallReport,
  LOCK_FILE,
  type Lock,
  type Problem,
  readLock,
  type Target,
} from "./artifacts.js";

/** Onde cada agente procura skills de projeto (formato Agent Skills). */
export const TARGET_DIRS: Record<Target, string> = {
  claude: ".claude/skills", // Claude Code
  agents: ".agents/skills", // Codex e outros agentes
};

interface Context {
  /** Pasta `skills/` do pacote. */
  source: string;
  /** Raiz do projeto consumidor. */
  cwd: string;
  /** Versão do pacote instalado. */
  version: string;
}

export function skillNames(source: string): string[] {
  return readdirSync(source)
    .filter((name) => existsSync(join(source, name, "SKILL.md")))
    .sort();
}

export function listSkills(source: string): { name: string; description: string }[] {
  return skillNames(source).map((name) => ({
    name,
    description:
      frontmatter(readFileSync(join(source, name, "SKILL.md"), "utf8")).description ?? "",
  }));
}

/** Targets cujas pastas já existem no projeto; `claude` se não houver nenhuma. */
export function detectTargets(cwd: string): Target[] {
  const found = TARGET_ORDER.filter((target) =>
    existsSync(join(cwd, target === "claude" ? ".claude" : ".agents")),
  );
  return found.length > 0 ? found : ["claude"];
}

function skillsKind(source: string): ArtifactKind {
  return {
    names: () => skillNames(source),
    path: (cwd, target, name) => join(cwd, TARGET_DIRS[target], name),
    sourceHash: (_target, name) => hashPath(join(source, name)),
    write: (cwd, target, name) =>
      cpSync(join(source, name), join(cwd, TARGET_DIRS[target], name), { recursive: true }),
    // Um lock só com agentes (targets de skills vazio) conta como "skills não instaladas".
    readSection: (lock) =>
      lock && lock.targets.length > 0
        ? { version: lock.version, targets: lock.targets, items: lock.skills }
        : null,
    writeSection: (lock, { version, targets, items }): Lock => ({
      ...lock,
      version,
      targets,
      skills: items,
    }),
  };
}

/**
 * Instala/atualiza as skills nos targets pedidos (somados aos já registrados no lock).
 * Nunca sobrescreve uma skill editada localmente ou de outra origem, a menos que `force`.
 */
export function installSkills({
  source,
  ...options
}: Context & { targets: Target[]; force?: boolean }): InstallReport {
  return install(skillsKind(source), options);
}

/** Compara o que está instalado com o lock e com o pacote. Útil em CI. */
export function checkSkills({ source, cwd }: Context): CheckReport {
  return check(skillsKind(source), cwd);
}
