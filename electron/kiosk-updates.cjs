function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeUpdateConfig(config) {
  const updates = config?.updates && typeof config.updates === "object" ? config.updates : {};
  const updateArgs = Array.isArray(updates.updateArgs)
    ? updates.updateArgs.filter((item) => typeof item === "string")
    : [];

  return {
    installerUrl: hasText(updates.installerUrl) ? updates.installerUrl.trim() : "",
    installerPath: hasText(updates.installerPath) ? updates.installerPath.trim() : "",
    updateCommand: hasText(updates.updateCommand) ? updates.updateCommand.trim() : "",
    updateArgs,
  };
}

function getUpdateReadiness(config) {
  const updates = normalizeUpdateConfig(config);

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
    message: "Nenhum instalador de atualizacao configurado neste PC.",
    ...updates,
  };
}

module.exports = {
  getUpdateReadiness,
  normalizeUpdateConfig,
};
