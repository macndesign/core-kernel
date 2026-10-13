// Instalação das skills do core-kernel no projeto consumidor. Lógica pura sobre o sistema de
// arquivos, sem I/O de terminal — o `index.ts` cuida de argumentos e mensagens.
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, sep } from "node:path";

export type Target = "claude" | "agents";

/** Onde cada agente procura skills de projeto (formato Agent Skills). */
export const TARGET_DIRS: Record<Target, string> = {
  claude: ".claude/skills", // Claude Code
  agents: ".agents/skills", // Codex e outros agentes
};

const TARGET_ORDER: readonly Target[] = ["claude", "agents"];

export const LOCK_FILE = "core-kernel.skills.json";

export interface Lock {
  /** Versão do core-kernel que instalou as skills. */
  version: string;
  targets: Target[];
  /** Hash do conteúdo instalado, por target e skill — detecta edições locais. */
  skills: Partial<Record<Target, Record<string, string>>>;
}

export interface SkillRef {
  target: Target;
  skill: string;
}

export interface InstallReport {
  installed: SkillRef[];
  unchanged: SkillRef[];
  removed: SkillRef[];
  /** `modified`: editada localmente; `foreign`: skill de mesmo nome que não veio do core-kernel. */
  skipped: (SkillRef & { reason: "modified" | "foreign" })[];
}

export type Problem =
  | { kind: "not-installed" }
  | (SkillRef & { kind: "missing" | "modified" | "outdated" | "obsolete" });

export interface CheckReport {
  ok: boolean;
  problems: Problem[];
}

interface Context {
  /** Pasta `skills/` do pacote. */
  source: string;
  /** Raiz do projeto consumidor. */
  cwd: string;
  /** Versão do pacote instalado. */
  version: string;
}

export function listSkills(source: string): { name: string; description: string }[] {
  return skillNames(source).map((name) => {
    const skill = readFileSync(join(source, name, "SKILL.md"), "utf8");
    const description = /^description:\s*(.+)$/m.exec(skill)?.[1]?.trim() ?? "";
    return { name, description: description.replace(/^["']|["']$/g, "") };
  });
}

/** Targets cujas pastas já existem no projeto; `claude` se não houver nenhuma. */
export function detectTargets(cwd: string): Target[] {
  const found = TARGET_ORDER.filter((target) =>
    existsSync(join(cwd, target === "claude" ? ".claude" : ".agents")),
  );
  return found.length > 0 ? found : ["claude"];
}

export function readLock(cwd: string): Lock | null {
  const file = join(cwd, LOCK_FILE);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Lock) : null;
}

/**
 * Instala/atualiza as skills nos targets pedidos (somados aos já registrados no lock).
 * Nunca sobrescreve uma skill editada localmente ou de outra origem, a menos que `force`.
 */
export function installSkills({
  source,
  cwd,
  version,
  targets,
  force = false,
}: Context & { targets: Target[]; force?: boolean }): InstallReport {
  const lock = readLock(cwd);
  const allTargets = TARGET_ORDER.filter((t) => targets.includes(t) || lock?.targets.includes(t));
  const available = skillNames(source);
  const report: InstallReport = { installed: [], unchanged: [], removed: [], skipped: [] };
  const nextSkills: Lock["skills"] = {};

  for (const target of allTargets) {
    const locked = lock?.skills[target] ?? {};
    const next: Record<string, string> = {};
    nextSkills[target] = next;

    for (const skill of available) {
      const from = join(source, skill);
      const to = join(cwd, TARGET_DIRS[target], skill);
      const sourceHash = hashDir(from);
      const ref = { target, skill };

      if (!existsSync(to)) {
        cpSync(from, to, { recursive: true });
        report.installed.push(ref);
        next[skill] = sourceHash;
        continue;
      }

      const currentHash = hashDir(to);
      const lockedHash = locked[skill];
      if (currentHash === sourceHash) {
        report.unchanged.push(ref);
        next[skill] = sourceHash;
      } else if (!force && lockedHash === undefined) {
        report.skipped.push({ ...ref, reason: "foreign" });
      } else if (!force && currentHash !== lockedHash) {
        report.skipped.push({ ...ref, reason: "modified" });
        next[skill] = lockedHash as string;
      } else {
        rmSync(to, { recursive: true, force: true });
        cpSync(from, to, { recursive: true });
        report.installed.push(ref);
        next[skill] = sourceHash;
      }
    }

    // Skills que saíram do pacote: remove se o usuário não as editou.
    for (const [skill, lockedHash] of Object.entries(locked)) {
      if (available.includes(skill)) continue;
      const to = join(cwd, TARGET_DIRS[target], skill);
      if (!existsSync(to)) continue;
      if (force || hashDir(to) === lockedHash) {
        rmSync(to, { recursive: true, force: true });
        report.removed.push({ target, skill });
      } else {
        report.skipped.push({ target, skill, reason: "modified" });
        next[skill] = lockedHash;
      }
    }
  }

  const nextLock: Lock = { version, targets: allTargets, skills: nextSkills };
  writeFileSync(join(cwd, LOCK_FILE), `${JSON.stringify(nextLock, null, 2)}\n`);
  return report;
}

/** Compara o que está instalado com o lock e com o pacote. Útil em CI. */
export function checkSkills({ source, cwd }: Context): CheckReport {
  const lock = readLock(cwd);
  if (!lock) return { ok: false, problems: [{ kind: "not-installed" }] };

  const available = skillNames(source);
  const problems: Problem[] = [];

  for (const target of lock.targets) {
    const locked = lock.skills[target] ?? {};
    const names = [...new Set([...available, ...Object.keys(locked)])].sort();

    for (const skill of names) {
      const to = join(cwd, TARGET_DIRS[target], skill);
      const inPackage = available.includes(skill);
      if (!existsSync(to)) {
        if (inPackage) problems.push({ kind: "missing", target, skill });
        continue;
      }
      const currentHash = hashDir(to);
      if (currentHash !== locked[skill]) problems.push({ kind: "modified", target, skill });
      else if (!inPackage) problems.push({ kind: "obsolete", target, skill });
      else if (currentHash !== hashDir(join(source, skill))) {
        problems.push({ kind: "outdated", target, skill });
      }
    }
  }

  return { ok: problems.length === 0, problems };
}

function skillNames(source: string): string[] {
  return readdirSync(source)
    .filter((name) => existsSync(join(source, name, "SKILL.md")))
    .sort();
}

function filesOf(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesOf(path) : [path];
  });
}

/** Hash do conteúdo de uma pasta, estável entre SOs (separador `/` e quebras de linha LF). */
function hashDir(dir: string): string {
  const hash = createHash("sha256");
  const files = filesOf(dir)
    .map((file) => ({ file, key: relative(dir, file).split(sep).join("/") }))
    .sort((a, b) => a.key.localeCompare(b.key));
  for (const { file, key } of files) {
    hash.update(key).update("\0");
    hash.update(readFileSync(file, "utf8").replace(/\r\n/g, "\n")).update("\0");
  }
  return hash.digest("hex");
}
