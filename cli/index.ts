#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./main.js";

/** Sobe a partir deste arquivo até o package.json do core-kernel (funciona em dist/ e em src). */
function findPackageRoot(from: string): { root: string; version: string } {
  let dir = from;
  while (true) {
    const file = join(dir, "package.json");
    if (existsSync(file)) {
      const pkg = JSON.parse(readFileSync(file, "utf8")) as { name?: string; version?: string };
      if (pkg.name === "core-kernel") return { root: dir, version: pkg.version ?? "0.0.0" };
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error("core-kernel package.json not found");
    dir = parent;
  }
}

const { root, version } = findPackageRoot(dirname(fileURLToPath(import.meta.url)));

process.exitCode = run(process.argv.slice(2), {
  cwd: process.cwd(),
  packageRoot: root,
  version,
  out: (line) => console.log(line),
  err: (line) => console.error(line),
});
