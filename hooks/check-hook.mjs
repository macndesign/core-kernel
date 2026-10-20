// PostToolUse (Edit|Write): repassa o evento ao core-kernel-check INSTALADO NO PROJETO, para que
// as regras sigam a versão que o projeto usa. Sem o checker instalado, não faz nada. Qualquer
// falha aqui sai com 0: o hook nunca pode travar o agente.
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const stdin = await readStdin();
  const event = JSON.parse(stdin);
  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? event.cwd ?? process.cwd();

  let entry;
  try {
    entry = createRequire(join(projectDir, "package.json")).resolve("core-kernel-check");
  } catch {
    return 0;
  }
  const { run } = await import(pathToFileURL(entry).href);
  return run(["--hook"], {
    cwd: projectDir,
    readStdin: async () => stdin,
    out: (text) => process.stdout.write(`${text}\n`),
    err: (text) => process.stderr.write(`${text}\n`),
  });
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  () => {
    process.exitCode = 0;
  },
);
