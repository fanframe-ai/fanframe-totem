const fs = require("node:fs");
const path = require("node:path");
const packageJson = require("../package.json");

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

const knownInstallerFileNames = [
  `FanFrame Kiosk Setup ${packageJson.version}.exe`,
  "FanFrame Kiosk Setup.exe",
  "FanFrame-Kiosk-Setup.exe",
];

function findLatestLocalInstaller(searchDirs = [], options = {}) {
  const candidates = [];
  const installerPattern = /^FanFrame Kiosk Setup .+\.exe$/i;
  const fileExists = typeof options.fileExists === "function" ? options.fileExists : fs.existsSync;

  for (const dir of searchDirs) {
    if (!hasText(dir)) continue;
    if (!fs.existsSync(dir)) {
      for (const fileName of knownInstallerFileNames) {
        const filePath = path.join(dir, fileName);
        if (fileExists(filePath)) return filePath;
      }
      continue;
    }
    for (const fileName of fs.readdirSync(dir)) {
      if (!installerPattern.test(fileName)) continue;
      const filePath = path.join(dir, fileName);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) candidates.push({ filePath, mtimeMs: stat.mtimeMs });
      } catch {
        // Ignore files that disappear while scanning.
      }
    }
  }

  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return candidates[0]?.filePath || "";
}

function normalizeUpdateConfig(config, options = {}) {
  const updates = config?.updates && typeof config.updates === "object" ? config.updates : {};
  const updateArgs = Array.isArray(updates.updateArgs)
    ? updates.updateArgs.filter((item) => typeof item === "string")
    : [];
  const discoveredInstallerPath = findLatestLocalInstaller(options.searchDirs || [], options);

  return {
    installerUrl: hasText(updates.installerUrl) ? updates.installerUrl.trim() : "",
    installerPath: hasText(updates.installerPath) ? updates.installerPath.trim() : discoveredInstallerPath,
    updateCommand: hasText(updates.updateCommand) ? updates.updateCommand.trim() : "",
    updateArgs,
  };
}

function getUpdateReadiness(config, options = {}) {
  const updates = normalizeUpdateConfig(config, options);

  if (updates.updateCommand) {
    return {
      ready: true,
      mode: "command",
      message: "Comando de atualizacao configurado neste PC.",
      ...updates,
    };
  }

  if (updates.installerUrl.startsWith("https://")) {
    return {
      ready: true,
      mode: "remote_installer",
      message: "Atualizacao pronta para baixar e instalar.",
      ...updates,
      installerPath: "",
    };
  }

  if (updates.installerPath) {
    return {
      ready: true,
      mode: "local_installer",
      message: "Instalador local configurado neste PC.",
      ...updates,
    };
  }

  return {
    ready: false,
    mode: "not_configured",
    message: "Nenhum instalador de atualizacao configurado neste PC.",
    ...updates,
  };
}

module.exports = {
  findLatestLocalInstaller,
  getUpdateReadiness,
  normalizeUpdateConfig,
};
