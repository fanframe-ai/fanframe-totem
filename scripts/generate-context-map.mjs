import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, ".codex", "context-map.md");

const DOMAIN_ORDER = [
  "Admin remoto",
  "Kiosk runtime",
  "UI compartilhada",
  "Electron",
  "Supabase",
  "Scripts e configuracao",
  "Documentacao",
  "Outros",
];

const ALLOWED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".css", ".sql", ".ps1", ".md", ".json",
]);

const IGNORED_PREFIXES = [
  "node_modules/",
  "dist/",
  "release/",
  "apps/admin/node_modules/",
  "apps/admin/dist/",
  "docs/archive/",
  ".git/",
  ".vercel/",
  "supabase/.temp/",
];

const IGNORED_NAMES = new Set([
  "package-lock.json",
  "bun.lock",
  "bun.lockb",
  ".env",
  "context-map.md",
]);

export function shouldIncludeFile(inputPath) {
  const normalized = inputPath.replaceAll("\\", "/");
  if (IGNORED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  if (IGNORED_NAMES.has(path.posix.basename(normalized))) return false;
  if (path.posix.basename(normalized).startsWith(".env.")) return false;
  return ALLOWED_EXTENSIONS.has(path.posix.extname(normalized));
}

export function classifyDomain(inputPath) {
  const normalized = inputPath.replaceAll("\\", "/");
  if (normalized.startsWith("apps/admin/")) return "Admin remoto";
  if (normalized.startsWith("src/shared/kiosk-ui/")) return "UI compartilhada";
  if (normalized === "src/pages/Kiosk.tsx" || normalized.startsWith("src/features/kiosk/")) return "Kiosk runtime";
  if (normalized.startsWith("electron/")) return "Electron";
  if (normalized.startsWith("supabase/")) return "Supabase";
  if (normalized.startsWith("scripts/") || /(^|\/)(package\.json|tsconfig[^/]*\.json|vite\.config\.ts|eslint\.config\.js)$/.test(normalized)) {
    return "Scripts e configuracao";
  }
  if (normalized === "README.md" || normalized.startsWith("docs/")) return "Documentacao";
  return "Outros";
}

function extractExports(source) {
  const values = new Set();
  const patterns = [
    /export\s+(?:default\s+)?function\s+([A-Za-z0-9_]+)/g,
    /export\s+(?:const|class|type|interface)\s+([A-Za-z0-9_]+)/g,
    /export\s+default\s+([A-Za-z0-9_]+)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) values.add(match[1]);
  }
  return [...values].slice(0, 8);
}

function isTestFile(filePath) {
  return /(?:^|\/)[^/]+\.(?:test|spec)\.(?:ts|tsx|js|cjs|mjs)$/.test(filePath);
}

function relatedTests(domain, tests) {
  if (domain === "Kiosk runtime" || domain === "UI compartilhada") {
    return tests.filter((file) => file.startsWith("src/") || file.startsWith("electron/"));
  }
  return tests.filter((file) => classifyDomain(file) === domain);
}

export function buildContextMap(files, options = {}) {
  const grouped = new Map(DOMAIN_ORDER.map((domain) => [domain, []]));
  for (const file of files) grouped.get(classifyDomain(file.path)).push(file);
  const tests = files.filter((file) => isTestFile(file.path)).map((file) => file.path);
  const lines = [
    "# FanFrame Context Map",
    "",
    `Gerado por \`npm run context:map\` a partir de arquivos rastreados e novos nao ignorados (${options.generatedAt || "working-tree"}).`,
    "Use `docs/architecture/INDEX.md` para escolher o fluxo antes de abrir codigo.",
    "",
  ];

  for (const domain of DOMAIN_ORDER) {
    const entries = grouped.get(domain).sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path));
    if (!entries.length) continue;
    lines.push(`## ${domain}`, "", "| Arquivo | Linhas | Exports principais |", "| --- | ---: | --- |");
    for (const file of entries.slice(0, 18)) {
      lines.push(`| \`${file.path}\` | ${file.lines} | ${file.exports.length ? file.exports.map((value) => `\`${value}\``).join(", ") : "-"} |`);
    }
    if (entries.length > 18) lines.push(`| ... | +${entries.length - 18} arquivos | use \`rg --files\` no dominio |`);
    const nearby = relatedTests(domain, tests).slice(0, 12);
    if (nearby.length) lines.push("", `Testes proximos: ${nearby.map((file) => `\`${file}\``).join(", ")}`);
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function loadTrackedFiles() {
  const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean)
    .filter(shouldIncludeFile);
  return tracked.map((filePath) => {
    const source = readFileSync(path.join(ROOT, filePath), "utf8");
    return {
      path: filePath.replaceAll("\\", "/"),
      lines: source ? source.split(/\r?\n/).length : 0,
      exports: extractExports(source),
    };
  });
}

function currentRevision() {
  return execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
}

export function generateContextMap() {
  return buildContextMap(loadTrackedFiles(), { generatedAt: `commit ${currentRevision()}` });
}

function run() {
  const output = generateContextMap();
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(OUTPUT, "utf8");
    } catch {
      // A missing map is reported as stale below.
    }
    if (current !== output) {
      process.stderr.write("Context map desatualizado. Execute npm run context:map.\n");
      process.exitCode = 1;
      return;
    }
    process.stdout.write("Context map atualizado.\n");
    return;
  }
  writeFileSync(OUTPUT, output, "utf8");
  process.stdout.write(`Context map escrito em ${path.relative(ROOT, OUTPUT)}.\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
