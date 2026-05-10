function normalizeKey(key) {
  return String(key || "").toLowerCase();
}

function shouldEnableAutoLaunch(config) {
  if (!config || config.kiosk === false) return false;
  return config.autoLaunch !== false;
}

function isTechnicalShortcut(input) {
  return (
    input?.type === "keyDown" &&
    input.control === true &&
    input.shift === true &&
    normalizeKey(input.key) === "f12"
  );
}

function isBlockedKioskShortcut(input, kioskActive = true) {
  if (!kioskActive || input?.type !== "keyDown" || isTechnicalShortcut(input)) return false;

  const key = normalizeKey(input.key);
  const altBlocked = input.alt === true && ["f4", "tab", "escape", "space"].includes(key);
  const controlBlocked = input.control === true && ["f5", "l", "n", "r", "t", "w"].includes(key);
  const functionBlocked = ["f5", "f11", "f12"].includes(key);

  return altBlocked || controlBlocked || functionBlocked;
}

module.exports = {
  isBlockedKioskShortcut,
  isTechnicalShortcut,
  shouldEnableAutoLaunch,
};
