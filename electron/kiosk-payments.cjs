function getPaymentReadiness(config) {
  const simulated = config?.simulatePayments === true || config?.payments?.simulate === true;

  if (simulated) {
    return {
      ready: true,
      mode: "simulated",
      message: "Pagamentos simulados ativos para teste.",
      plugpagConfigured: false,
      simulated: true,
    };
  }

  return {
    ready: true,
    mode: "pix",
    message: "PIX PagBank em modo producao. Pagamento por cartao desativado.",
    plugpagConfigured: false,
    simulated: false,
  };
}

module.exports = {
  getPaymentReadiness,
};
