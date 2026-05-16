const { app, BrowserWindow, globalShortcut, ipcMain, Menu, net, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const {
  getKioskControlAccelerators,
  getKioskControlShortcut,
  isBlockedKioskShortcut,
  isTechnicalShortcut,
  shouldEnableAutoLaunch,
} = require("./kiosk-hardening.cjs");
const { getPaymentReadiness } = require("./kiosk-payments.cjs");
const { getUpdateReadiness } = require("./kiosk-updates.cjs");

let staticServer;
let mainWindow;
let shortcutStatus = [];

function identityPath() {
  return path.join(app.getPath("userData"), "device-identity.json");
}

async function readIdentity() {
  try {
    return JSON.parse(await fs.promises.readFile(identityPath(), "utf8"));
  } catch {
    return null;
  }
}

async function writeIdentity(identity) {
  await fs.promises.mkdir(path.dirname(identityPath()), { recursive: true });
  await fs.promises.writeFile(identityPath(), JSON.stringify(identity, null, 2), "utf8");
}

async function clearIdentity() {
  try {
    await fs.promises.unlink(identityPath());
  } catch {
    return;
  }
}

function resolveDistDir() {
  const candidates = [
    path.join(app.getAppPath(), "dist"),
    path.join(process.cwd(), "dist"),
    path.join(__dirname, "..", "dist"),
  ];

  const distDir = candidates.find((candidate) => fs.existsSync(path.join(candidate, "index.html")));
  if (!distDir) {
    console.error("[kiosk] Build not found. Checked:", candidates);
  }
  return distDir || candidates[0];
}

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`[kiosk] Failed to read ${filePath}:`, error);
    return null;
  }
}

function loadKioskConfig() {
  const userDataConfig = path.join(app.getPath("userData"), "kiosk.config.json");
  const localConfig = path.join(process.cwd(), "kiosk.config.json");
  const explicitConfig = process.env.FANFRAME_KIOSK_CONFIG;
  const fileConfig =
    (explicitConfig && readJson(explicitConfig)) ||
    readJson(localConfig) ||
    readJson(userDataConfig) ||
    {};

  return {
    teamSlug: process.env.FANFRAME_TEAM_SLUG || fileConfig.teamSlug || "",
    deviceCode: process.env.FANFRAME_DEVICE_CODE || fileConfig.deviceCode || os.hostname(),
    deviceSecret: process.env.FANFRAME_DEVICE_SECRET || fileConfig.deviceSecret || "",
    appVersion: app.getVersion(),
    kiosk: fileConfig.kiosk !== false,
    fullscreen: fileConfig.fullscreen !== false,
    autoLaunch: fileConfig.autoLaunch !== false,
    blockShortcuts: fileConfig.blockShortcuts !== false,
    simulatePayments:
      process.env.FANFRAME_SIMULATE_PAYMENTS === "true" ||
      fileConfig.simulatePayments === true ||
      fileConfig.payments?.simulate === true,
    payments: fileConfig.payments || {},
    updates: {
      ...(fileConfig.updates || {}),
      installerUrl: process.env.FANFRAME_UPDATE_URL || fileConfig.updates?.installerUrl || "",
      installerPath: process.env.FANFRAME_UPDATE_PATH || fileConfig.updates?.installerPath || "",
      updateCommand: process.env.FANFRAME_UPDATE_COMMAND || fileConfig.updates?.updateCommand || "",
      updateArgs: Array.isArray(fileConfig.updates?.updateArgs) ? fileConfig.updates.updateArgs : [],
    },
  };
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".ico") return "image/x-icon";
  return "application/octet-stream";
}

function startStaticServer() {
  const distDir = resolveDistDir();
  staticServer = http.createServer((req, res) => {
    const requestedUrl = new URL(req.url || "/", "http://127.0.0.1");
    const cleanPath = decodeURIComponent(requestedUrl.pathname.replace(/^\/+/, ""));
    const candidate = path.normalize(path.join(distDir, cleanPath));
    const relativePath = path.relative(distDir, candidate);
    const safeCandidate = relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)
      ? candidate
      : path.join(distDir, "index.html");
    const filePath = fs.existsSync(safeCandidate) && fs.statSync(safeCandidate).isFile()
      ? safeCandidate
      : path.join(distDir, "index.html");

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(500);
        res.end("FanFrame Kiosk build not found. Run npm run build first.");
        return;
      }
      res.writeHead(200, { "Content-Type": contentTypeFor(filePath) });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    staticServer.listen(0, "127.0.0.1", () => {
      const address = staticServer.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function runPlugPagCommand(config, request) {
  return new Promise((resolve) => {
    const command = config.payments?.plugpagCommand;
    if (!command) {
      resolve({
        approved: false,
        status: "not_configured",
        message: "PlugPag command is not configured.",
      });
      return;
    }

    const args = Array.isArray(config.payments?.plugpagArgs) ? config.payments.plugpagArgs : [];
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ approved: false, status: "error", message: error.message });
    });
    child.on("close", (code) => {
      try {
        const parsed = JSON.parse(stdout);
        resolve({ approved: parsed.approved === true, status: parsed.status || "finished", ...parsed });
      } catch {
        resolve({
          approved: code === 0,
          status: code === 0 ? "approved" : "failed",
          message: stderr || stdout || `PlugPag command exited with code ${code}`,
          rawOutput: stdout,
        });
      }
    });

    child.stdin.write(JSON.stringify(request));
    child.stdin.end();
  });
}

async function startCardPayment(_event, request) {
  const config = loadKioskConfig();
  if (config.simulatePayments) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    return {
      approved: true,
      status: "approved",
      provider: "simulated",
      transactionCode: `SIM-${Date.now()}`,
      amountCents: request.amountCents,
    };
  }

  return runPlugPagCommand(config, request);
}

function downloadUpdateInstaller(url, destinationPath, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const request = net.request(url);

    request.on("response", (response) => {
      const location = response.headers.location;
      if (response.statusCode >= 300 && response.statusCode < 400 && location && redirectsLeft > 0) {
        const redirectLocation = Array.isArray(location) ? location[0] : location;
        const redirectUrl = new URL(redirectLocation, url).toString();
        downloadUpdateInstaller(redirectUrl, destinationPath, redirectsLeft - 1).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download retornou HTTP ${response.statusCode}`));
        return;
      }

      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      const file = fs.createWriteStream(destinationPath);

      response.on("data", (chunk) => file.write(Buffer.from(chunk)));
      response.on("end", () => {
        file.end(() => resolve(destinationPath));
      });
      response.on("error", (error) => {
        file.destroy();
        reject(error);
      });
      file.on("error", reject);
    });

    request.on("error", reject);
    request.end();
  });
}

async function startAppUpdate() {
  const config = loadKioskConfig();
  const readiness = getUpdateReadiness(config, { searchDirs: getUpdateSearchDirs() });

  if (!readiness.ready) {
    return {
      ok: false,
      status: readiness.mode,
      message: readiness.message,
    };
  }

  let command = readiness.updateCommand || readiness.installerPath;
  let args = readiness.updateArgs || [];

  if (!command && readiness.installerUrl) {
    const updateDir = path.join(app.getPath("userData"), "updates");
    const fileName = `FanFrame-Kiosk-Setup-${Date.now()}.exe`;
    command = await downloadUpdateInstaller(readiness.installerUrl, path.join(updateDir, fileName));
    args = [];
  }

  if (!command) {
    return {
      ok: false,
      status: "not_configured",
      message: "Nenhum instalador de atualizacao configurado neste PC.",
    };
  }

  if (readiness.mode === "local_installer" && !fs.existsSync(command)) {
    return {
      ok: false,
      status: "installer_not_found",
      message: "Instalador de atualizacao nao encontrado neste PC.",
    };
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  await new Promise((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  child.unref();

  setTimeout(() => app.quit(), 1200);

  return {
    ok: true,
    status: "started",
    message: "Atualizacao iniciada. O FanFrame sera fechado para o instalador continuar.",
  };
}

function getUpdateSearchDirs() {
  const dirs = [
    path.join(app.getPath("userData"), "updates"),
    app.getPath("downloads"),
    app.getPath("desktop"),
    process.cwd(),
  ];
  return [...new Set(dirs.filter(Boolean))];
}

function configureAutoLaunch(config) {
  if (process.platform !== "win32" || !app.isPackaged) return;

  app.setLoginItemSettings({
    openAtLogin: shouldEnableAutoLaunch(config),
    path: process.execPath,
  });
}

function applyKioskWindowControl(action, win = mainWindow) {
  if (!win || win.isDestroyed()) return;

  if (action === "minimize") {
    win.setKiosk(false);
    win.setFullScreen(false);
    win.minimize();
    return;
  }

  if (action === "toggle_fullscreen") {
    const shouldLeaveFullscreen = win.isKiosk() || win.isFullScreen();
    win.setKiosk(!shouldLeaveFullscreen);
    win.setFullScreen(!shouldLeaveFullscreen);
    if (shouldLeaveFullscreen) win.show();
    return;
  }

  if (action === "quit") {
    win.setKiosk(false);
    win.setFullScreen(false);
    app.quit();
  }
}

function registerKioskControlShortcuts() {
  globalShortcut.unregisterAll();
  shortcutStatus = getKioskControlAccelerators().map(([accelerator, action]) => {
    const ok = globalShortcut.register(accelerator, () => applyKioskWindowControl(action));
    if (!ok) console.warn(`[kiosk] Failed to register shortcut ${accelerator}`);
    return { accelerator, action, registered: ok };
  });
}

async function createWindow() {
  const config = loadKioskConfig();
  configureAutoLaunch(config);
  const devServerArg = process.argv.find((arg) => arg.startsWith("--dev-server="));
  const devServerUrl = devServerArg?.split("=")[1] || process.env.VITE_DEV_SERVER_URL;
  const baseUrl = devServerUrl || await startStaticServer();

  Menu.setApplicationMenu(null);

  const win = new BrowserWindow({
    width: 1080,
    height: 1920,
    kiosk: config.kiosk,
    fullscreen: config.fullscreen,
    autoHideMenuBar: true,
    backgroundColor: "#050505",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(baseUrl)) event.preventDefault();
  });
  mainWindow = win;
  registerKioskControlShortcuts();

  win.webContents.on("before-input-event", (event, input) => {
    if (isTechnicalShortcut(input)) {
      win.webContents.send("kiosk:open-technical-mode");
      event.preventDefault();
      return;
    }

    const controlShortcut = getKioskControlShortcut(input);
    if (controlShortcut) {
      applyKioskWindowControl(controlShortcut, win);
      event.preventDefault();
      return;
    }

    if (isBlockedKioskShortcut(input, config.kiosk && config.blockShortcuts)) {
      event.preventDefault();
    }
  });

  await win.loadURL(`${baseUrl}/kiosk`);
}

app.whenReady().then(() => {
  ipcMain.handle("fanframe:get-config", () => loadKioskConfig());
  ipcMain.handle("fanframe:start-card-payment", startCardPayment);
  ipcMain.handle("kiosk:load-device-identity", readIdentity);
  ipcMain.handle("kiosk:save-device-identity", (_event, identity) => writeIdentity(identity));
  ipcMain.handle("kiosk:clear-device-identity", clearIdentity);
  ipcMain.handle("kiosk:get-technical-status", async () => ({
    online: net.isOnline(),
    appVersion: app.getVersion(),
    deviceCode: (await readIdentity())?.deviceCode || null,
    lastSyncAt: null,
    shortcuts: shortcutStatus,
  }));
  ipcMain.handle("kiosk:get-payment-status", () => getPaymentReadiness(loadKioskConfig()));
  ipcMain.handle("kiosk:get-update-status", () => ({
    ...getUpdateReadiness(loadKioskConfig(), { searchDirs: getUpdateSearchDirs() }),
    appVersion: app.getVersion(),
  }));
  ipcMain.handle("kiosk:start-app-update", startAppUpdate);
  ipcMain.handle("kiosk:relaunch", async () => {
    app.relaunch();
    app.exit(0);
  });
  createWindow();
});

app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  if (staticServer) staticServer.close();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
