import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultRulesPath = path.join(root, "scripts", "affected-rules.json");

export function matchesPattern(filePath, pattern) {
  const file = filePath.replaceAll("\\", "/");
  const normalizedPattern = pattern.replaceAll("\\", "/");
  const escaped = normalizedPattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "::DOUBLE_STAR::")
    .replace(/\*/g, "[^/]*")
    .replace(/::DOUBLE_STAR::/g, ".*");
  return new RegExp(`^${escaped}$`).test(file);
}

export function selectChecks(files, rules) {
  const checks = [];
  const matches = [];
  const unmatched = [];
  let exclusive = false;

  for (const file of files) {
    const hitRules = rules.filter((rule) => rule.patterns.some((pattern) => matchesPattern(file, pattern)));
    if (!hitRules.length) {
      unmatched.push(file);
      continue;
    }
    for (const rule of hitRules) {
      matches.push({ file, rule: rule.name, checks: rule.checks });
      if (rule.exclusive) exclusive = true;
      for (const check of rule.checks) if (!checks.includes(check)) checks.push(check);
    }
  }

  if (unmatched.length && !checks.includes("check:all")) checks.push("check:all");
  return {
    checks: exclusive || checks.includes("check:all") ? ["check:all"] : checks,
    matches,
    unmatched,
  };
}

function loadRules() {
  return JSON.parse(readFileSync(defaultRulesPath, "utf8"));
}

function changedFilesFromGit() {
  const output = execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" });
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .map((file) => file.includes(" -> ") ? file.split(" -> ").pop() : file)
    .filter(Boolean)
    .map((file) => file.replaceAll("\\", "/"));
}

function runCheck(check) {
  const result = spawnSync("npm", ["run", check], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status ?? 1;
}

function main() {
  const rules = loadRules();
  const files = changedFilesFromGit();
  if (!files.length) {
    console.log("Nenhum arquivo alterado. Executando context:check como validacao leve.");
    process.exitCode = runCheck("context:check");
    return;
  }

  const selected = selectChecks(files, rules);
  console.log("Arquivos alterados:");
  for (const file of files) console.log(`- ${file}`);
  console.log("\nMotivos:");
  for (const match of selected.matches) console.log(`- ${match.file}: ${match.rule} -> ${match.checks.join(", ")}`);
  for (const file of selected.unmatched) console.log(`- ${file}: sem regra -> check:all`);
  console.log(`\nChecks selecionados: ${selected.checks.join(", ")}`);

  for (const check of selected.checks) {
    const code = runCheck(check);
    if (code !== 0) {
      process.exitCode = code;
      return;
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

