function isObjectRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeKioskConfig(fileConfig = {}, remoteConfig = {}, env = process.env) {
  const safeFileConfig = isObjectRecord(fileConfig) ? fileConfig : {};
  const safeRemoteConfig = isObjectRecord(remoteConfig) ? remoteConfig : {};
  const fileUpdates = isObjectRecord(safeFileConfig.updates) ? safeFileConfig.updates : {};
  const remoteUpdates = isObjectRecord(safeRemoteConfig.updates) ? safeRemoteConfig.updates : {};
  const filePayments = isObjectRecord(safeFileConfig.payments) ? safeFileConfig.payments : {};
  const remotePayments = isObjectRecord(safeRemoteConfig.payments) ? safeRemoteConfig.payments : {};

  return {
    ...safeFileConfig,
    payments: {
      ...filePayments,
      ...remotePayments,
    },
    updates: {
      ...fileUpdates,
      ...remoteUpdates,
      installerUrl: env.FANFRAME_UPDATE_URL || remoteUpdates.installerUrl || fileUpdates.installerUrl || "",
      installerPath: env.FANFRAME_UPDATE_PATH || remoteUpdates.installerPath || fileUpdates.installerPath || "",
      updateCommand: env.FANFRAME_UPDATE_COMMAND || remoteUpdates.updateCommand || fileUpdates.updateCommand || "",
      updateArgs: Array.isArray(remoteUpdates.updateArgs)
        ? remoteUpdates.updateArgs
        : Array.isArray(fileUpdates.updateArgs)
          ? fileUpdates.updateArgs
          : [],
    },
  };
}

module.exports = {
  isObjectRecord,
  mergeKioskConfig,
};
