import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scanRoots = ["dist", "electron"].map((item) => path.join(root, item)).filter(existsSync);
const forbiddenFiles = [
  "kiosk.config.json",
  ".env",
  ".env.local",
];
const forbiddenContent = [
  { name: "Supabase personal access token", pattern: /sbp_[A-Za-z0-9_=-]+/ },
  { name: "Replicate API token", pattern: /r8_[A-Za-z0-9_=-]+/ },
  { name: "Supabase service role reference", pattern: /service[_-]?role/i },
  { name: "PagBank backend token name", pattern: /PAGBANK_API_TOKEN/ },
  { name: "Replicate backend token name", pattern: /REPLICATE_API_TOKEN/ },
  { name: "Supabase backend service key name", pattern: /SUPABASE_SERVICE_ROLE/ },
];
const textExtensions = new Set([".html", ".js", ".cjs", ".mjs", ".css", ".json", ".txt", ".yml", ".yaml"]);
const findings = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const relativePath = path.relative(root, fullPath).replaceAll("\\", "/");
    const stat = statSync(fullPath);

    if (forbiddenFiles.includes(entry)) {
      findings.push(`${relativePath}: arquivo sensivel nao deve entrar no pacote`);
    }

    if (stat.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!textExtensions.has(path.extname(entry).toLowerCase())) continue;

    const source = readFileSync(fullPath, "utf8");
    for (const rule of forbiddenContent) {
      if (rule.pattern.test(source)) findings.push(`${relativePath}: encontrou ${rule.name}`);
    }
  }
}

for (const dir of scanRoots) walk(dir);

if (!scanRoots.length) {
  console.log("Nenhum build local encontrado para escanear. Execute npm run build antes do release.");
  process.exit(0);
}

if (findings.length) {
  console.error("Falha de seguranca no pacote do kiosk:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Pacote do kiosk escaneado sem secrets em: ${scanRoots.map((dir) => path.relative(root, dir)).join(", ")}.`);
