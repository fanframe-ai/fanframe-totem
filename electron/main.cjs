const { app, BrowserWindow, ipcMain, Menu, net, shell } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const {
  isBlockedKioskShortcut,
  isTechnicalShortcut,
  shouldEnableAutoLaunch,
} = require("./kiosk-hardening.cjs");

let staticServer;

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

function configureAutoLaunch(config) {
  if (process.platform !== "win32" || !app.isPackaged) return;

  app.setLoginItemSettings({
    openAtLogin: shouldEnableAutoLaunch(config),
    path: process.execPath,
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

  win.webContents.on("before-input-event", (event, input) => {
    if (isTechnicalShortcut(input)) {
      win.webContents.send("kiosk:open-technical-mode");
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
  }));
  ipcMain.handle("kiosk:relaunch", async () => {
    app.relaunch();
    app.exit(0);
  });
  createWindow();
});

app.on("window-all-closed", () => {
  if (staticServer) staticServer.close();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
