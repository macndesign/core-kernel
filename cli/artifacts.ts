// Motor comum de instalação dos artefatos do core-kernel (skills, agentes) no projeto
// consumidor: copia/gera, registra o hash no lock e nunca sobrescreve o que foi editado
// localmente ou não veio do core-kernel (a menos que `force`). Sem I/O de terminal.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

export type Target = "claude" | "agents";

export const TARGET_ORDER: readonly Target[] = ["claude", "agents"];

export const LOCK_FILE = "core-kernel.skills.json";

/** O que está instalado de um tipo de artefato: versão, targets e hash por target e nome. */
export interface Section {
  version: string;
  targets: Target[];
  items: Partial<Record<Target, Record<string, string>>>;
}

/**
 * Lock do projeto. As skills ficam na raiz (formato original, compatível com versões antigas
 * do CLI); os agentes, em `agents`.
 */
export interface Lock {
  /** Versão do core-kernel que instalou as skills. */
  version: string;
  targets: Target[];
  /** Hash do conteúdo instalado, por target e skill — detecta edições locais. */
  skills: Partial<Record<Target, Record<string, string>>>;
  agents?: Section;
}

export interface Ref {
  target: Target;
  name: string;
}

export interface InstallReport {
  installed: Ref[];
  unchanged: Ref[];
  removed: Ref[];
  /** `modified`: editado localmente; `foreign`: artefato de mesmo nome que não veio do core-kernel. */
  skipped: (Ref & { reason: "modified" | "foreign" })[];
}

export type Problem =
  | { kind: "not-installed" }
  | (Ref & { kind: "missing" | "modified" | "outdated" | "obsolete" });

export interface CheckReport {
  ok: boolean;
  problems: Problem[];
}

/** Como um tipo de artefato é lido do pacote e materializado em cada target. */
export interface ArtifactKind {
  /** Nomes disponíveis no pacote. */
  names(): string[];
  /** Caminho instalado (pasta ou arquivo) no projeto. */
  path(cwd: string, target: Target, name: string): string;
  /** Hash do que seria instalado agora. */
  sourceHash(target: Target, name: string): string;
  /** Instala (substituindo o que houver no caminho). */
  write(cwd: string, target: Target, name: string): void;
  readSection(lock: Lock | null): Section | null;
  writeSection(lock: Lock | null, section: Section): Lock;
}

export function readLock(cwd: string): Lock | null {
  const file = join(cwd, LOCK_FILE);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Lock) : null;
}

const normalize = (text: string) => text.replace(/\r\n/g, "\n");

export const hashText = (text: string) =>
  createHash("sha256").update(normalize(text)).digest("hex");

function filesOf(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesOf(path) : [path];
  });
}

/** Hash de uma pasta (ou arquivo), estável entre SOs (separador `/` e quebras de linha LF). */
export function hashPath(path: string): string {
  if (!statSync(path).isDirectory()) return hashText(readFileSync(path, "utf8"));
  const hash = createHash("sha256");
  const files = filesOf(path)
    .map((file) => ({ file, key: relative(path, file).split(sep).join("/") }))
    .sort((a, b) => a.key.localeCompare(b.key));
  for (const { file, key } of files) {
    hash.update(key).update("\0");
    hash.update(normalize(readFileSync(file, "utf8"))).update("\0");
  }
  return hash.digest("hex");
}

/** Instala/atualiza nos targets pedidos (somados aos já registrados no lock). */
export function install(
  kind: ArtifactKind,
  {
    cwd,
    version,
    targets,
    force = false,
  }: { cwd: string; version: string; targets: Target[]; force?: boolean },
): InstallReport {
  const lock = readLock(cwd);
  const section = kind.readSection(lock);
  const allTargets = TARGET_ORDER.filter(
    (t) => targets.includes(t) || section?.targets.includes(t),
  );
  const available = kind.names();
  const report: InstallReport = { installed: [], unchanged: [], removed: [], skipped: [] };
  const items: Section["items"] = {};

  for (const target of allTargets) {
    const locked = section?.items[target] ?? {};
    const next: Record<string, string> = {};
    items[target] = next;

    for (const name of available) {
      const to = kind.path(cwd, target, name);
      const sourceHash = kind.sourceHash(target, name);
      const ref = { target, name };

      if (!existsSync(to)) {
        kind.write(cwd, target, name);
        report.installed.push(ref);
        next[name] = sourceHash;
        continue;
      }

      const currentHash = hashPath(to);
      const lockedHash = locked[name];
      if (currentHash === sourceHash) {
        report.unchanged.push(ref);
        next[name] = sourceHash;
      } else if (!force && lockedHash === undefined) {
        report.skipped.push({ ...ref, reason: "foreign" });
      } else if (!force && currentHash !== lockedHash) {
        report.skipped.push({ ...ref, reason: "modified" });
        next[name] = lockedHash as string;
      } else {
        rmSync(to, { recursive: true, force: true });
        kind.write(cwd, target, name);
        report.installed.push(ref);
        next[name] = sourceHash;
      }
    }

    // Artefatos que saíram do pacote: remove se o usuário não os editou.
    for (const [name, lockedHash] of Object.entries(locked)) {
      if (available.includes(name)) continue;
      const to = kind.path(cwd, target, name);
      if (!existsSync(to)) continue;
      if (force || hashPath(to) === lockedHash) {
        rmSync(to, { recursive: true, force: true });
        report.removed.push({ target, name });
      } else {
        report.skipped.push({ target, name, reason: "modified" });
        next[name] = lockedHash;
      }
    }
  }

  const nextLock = kind.writeSection(lock, { version, targets: allTargets, items });
  writeFileSync(join(cwd, LOCK_FILE), `${JSON.stringify(nextLock, null, 2)}\n`);
  return report;
}

/** Compara o que está instalado com o lock e com o pacote. Útil em CI. */
export function check(kind: ArtifactKind, cwd: string): CheckReport {
  const section = kind.readSection(readLock(cwd));
  if (!section) return { ok: false, problems: [{ kind: "not-installed" }] };

  const available = kind.names();
  const problems: Problem[] = [];

  for (const target of section.targets) {
    const locked = section.items[target] ?? {};
    const names = [...new Set([...available, ...Object.keys(locked)])].sort();

    for (const name of names) {
      const to = kind.path(cwd, target, name);
      const inPackage = available.includes(name);
      if (!existsSync(to)) {
        if (inPackage) problems.push({ kind: "missing", target, name });
        continue;
      }
      const currentHash = hashPath(to);
      if (currentHash !== locked[name]) problems.push({ kind: "modified", target, name });
      else if (!inPackage) problems.push({ kind: "obsolete", target, name });
      else if (currentHash !== kind.sourceHash(target, name)) {
        problems.push({ kind: "outdated", target, name });
      }
    }
  }

  return { ok: problems.length === 0, problems };
}

/** Lê `name`/`description` (e outros campos simples) do frontmatter YAML. */
export function frontmatter(text: string): Record<string, string> {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? "";
  const fields: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const match = /^([\w-]+):\s*(.*)$/.exec(line);
    if (match?.[1]) fields[match[1]] = (match[2] ?? "").trim().replace(/^["']|["']$/g, "");
  }
  return fields;
}
