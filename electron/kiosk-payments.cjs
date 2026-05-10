function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function getPaymentReadiness(config) {
  const simulated = config?.simulatePayments === true || config?.payments?.simulate === true;
  const plugpagConfigured = hasText(config?.payments?.plugpagCommand);

  if (simulated) {
    return {
      ready: true,
      mode: "simulated",
      message: "Pagamentos simulados ativos para teste.",
      plugpagConfigured,
      simulated: true,
    };
  }

  if (plugpagConfigured) {
    return {
      ready: true,
      mode: "plugpag",
      message: "Comando local PlugPag configurado.",
      plugpagConfigured: true,
      simulated: false,
    };
  }

  return {
    ready: false,
    mode: "not_configured",
    message: "PlugPag nao configurado neste PC.",
    plugpagConfigured: false,
    simulated: false,
  };
}

module.exports = {
  getPaymentReadiness,
};
