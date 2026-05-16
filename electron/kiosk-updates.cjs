const fs = require("node:fs");
const path = require("node:path");

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function findLatestLocalInstaller(searchDirs = []) {
  const candidates = [];
  const installerPattern = /^FanFrame Kiosk Setup .+\.exe$/i;

  for (const dir of searchDirs) {
    if (!hasText(dir) || !fs.existsSync(dir)) continue;
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
  const discoveredInstallerPath = findLatestLocalInstaller(options.searchDirs || []);

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

  if (updates.installerPath) {
    return {
      ready: true,
      mode: "local_installer",
      message: "Instalador local configurado neste PC.",
      ...updates,
    };
  }

  if (updates.installerUrl) {
    return {
      ready: true,
      mode: "download",
      message: "Link do instalador configurado. O app pode baixar e abrir a atualizacao.",
      ...updates,
    };
  }

  return {
    ready: false,
    mode: "not_configured",
    message: "Nenhum instalador de atualizacao encontrado. Baixe o FanFrame Kiosk Setup mais recente na pasta Downloads ou configure um link de atualizacao.",
    ...updates,
  };
}

module.exports = {
  findLatestLocalInstaller,
  getUpdateReadiness,
  normalizeUpdateConfig,
};
