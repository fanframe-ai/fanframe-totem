function normalizeKey(key) {
  return String(key || "").toLowerCase();
}

function shouldEnableAutoLaunch(config) {
  if (!config || config.kiosk === false) return false;
  return config.autoLaunch !== false;
}

function isTechnicalShortcut(input) {
  const key = normalizeKey(input?.key);
  const code = normalizeKey(input?.code);
  return (
    input?.type === "keyDown" &&
    (
      (input.control === true && input.shift === true && (key === "f12" || code === "f12")) ||
      (input.control === true && input.alt === true && key === "t")
    )
  );
}

function getKioskControlShortcut(input) {
  if (input?.type !== "keyDown" || input.control !== true || (input.alt !== true && input.shift !== true)) return null;

  const key = normalizeKey(input.key);
  if (key === "m") return "minimize";
  if (key === "f") return "toggle_fullscreen";
  if (key === "q") return "quit";
  return null;
}

function getKioskControlAccelerators() {
  return [
    ["CommandOrControl+Alt+M", "minimize"],
    ["CommandOrControl+Shift+M", "minimize"],
    ["CommandOrControl+Alt+F", "toggle_fullscreen"],
    ["CommandOrControl+Shift+F", "toggle_fullscreen"],
    ["CommandOrControl+Alt+Q", "quit"],
    ["CommandOrControl+Shift+Q", "quit"],
  ];
}

function isBlockedKioskShortcut(input, kioskActive = true) {
  if (!kioskActive || input?.type !== "keyDown" || isTechnicalShortcut(input) || getKioskControlShortcut(input)) return false;

  const key = normalizeKey(input.key);
  const altBlocked = input.alt === true && ["f4", "tab", "escape", "space"].includes(key);
  const controlBlocked = input.control === true && ["f5", "l", "n", "r", "t", "w"].includes(key);
  const functionBlocked = ["f5", "f11", "f12"].includes(key);

  return altBlocked || controlBlocked || functionBlocked;
}

module.exports = {
  getKioskControlAccelerators,
  getKioskControlShortcut,
  isBlockedKioskShortcut,
  isTechnicalShortcut,
  shouldEnableAutoLaunch,
};
