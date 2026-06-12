import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = execFileSync("git", ["ls-files", "supabase/functions/**/*.ts"], {
  cwd: root,
  encoding: "utf8",
}).split(/\r?\n/).filter(Boolean);

const failures = [];
for (const file of files) {
  const source = readFileSync(path.join(root, file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: file,
    reportDiagnostics: true,
  });
  for (const diagnostic of output.diagnostics || []) {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, " ");
    failures.push(`${file}: ${message}`);
  }
}

if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Edge Functions: ${files.length} arquivos TypeScript com sintaxe valida.\n`);
}

