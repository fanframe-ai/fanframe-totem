export type OwnerInstallMessageInput = {
  deviceLabel: string;
  teamName?: string | null;
  location?: string | null;
  installCode: string;
  supportPin: string;
  expiresAt: string;
};

export type OwnerUpdateMessageInput = {
  deviceLabel: string;
  teamName?: string | null;
  location?: string | null;
  currentVersion?: string | null;
  expectedVersion?: string | null;
};

export function formatInstallExpiration(expiresAt: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(expiresAt));
}

export function buildOwnerInstallMessage(input: OwnerInstallMessageInput) {
  const teamLine = input.teamName ? `Time: ${input.teamName}` : "Time: definido pelo administrador";
  const locationLine = input.location ? `Local: ${input.location}` : "Local: conferir no painel";

  return [
    `Instalacao FanFrame Totem - ${input.deviceLabel}`,
    "",
    teamLine,
    locationLine,
    `Codigo de instalacao: ${input.installCode}`,
    `PIN tecnico: ${input.supportPin}`,
    `Expira em: ${formatInstallExpiration(input.expiresAt)}`,
    "",
    "Passos no PC Windows do totem:",
    "1. Abra o FanFrame Kiosk.",
    "2. Digite o codigo de instalacao.",
    "3. Aguarde aparecer a tela inicial do time.",
    "4. Para testar internet/camera, pressione Ctrl + Shift + F12 e digite o PIN tecnico.",
    "",
    "Nao altere arquivos internos do aplicativo. Configuracoes de time, preco e IA sao atualizadas remotamente pelo administrador FanFrame.",
  ].join("\n");
}

export function buildOwnerUpdateMessage(input: OwnerUpdateMessageInput) {
  const teamLine = input.teamName ? `Time: ${input.teamName}` : "Time: definido pelo administrador";
  const locationLine = input.location ? `Local: ${input.location}` : "Local: conferir no painel";

  return [
    `Atualizacao FanFrame Totem - ${input.deviceLabel}`,
    "",
    teamLine,
    locationLine,
    `Versao instalada: ${input.currentVersion || "nao informada"}`,
    `Nova versao esperada: ${input.expectedVersion || "mais recente enviada pelo administrador"}`,
    "",
    "Passos no PC Windows do totem:",
    "1. Feche o FanFrame Kiosk se ele estiver aberto.",
    "2. Execute o novo instalador enviado pelo administrador.",
    "3. Avance a instalacao mantendo a mesma pasta sugerida.",
    "4. Abra o FanFrame Kiosk e confira se a tela inicial do time aparece.",
    "5. Para testar internet/camera/pagamentos, pressione Ctrl + Shift + F12 e digite o PIN tecnico.",
    "",
    "Importante: nao desinstale o app antes de atualizar. Assim o pareamento local do totem continua salvo.",
    "Nao altere arquivos internos do aplicativo. Configuracoes de time, preco e IA sao atualizadas remotamente pelo administrador FanFrame.",
  ].join("\n");
}
