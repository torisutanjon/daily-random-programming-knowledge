import path from "node:path";
import type { UtilityProcess } from "electron";
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  Notification,
  powerMonitor,
  Tray,
  utilityProcess,
} from "electron";
import { createScheduler, type Scheduler } from "./scheduler";
import { getFreePort, standaloneServerPath, waitForServer } from "./server";

const APP_ID = "com.drpk.app";

app.setAppUserModelId(APP_ID);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let server: UtilityProcess | null = null;
let scheduler: Scheduler | null = null;
let quitting = false;
const liveNotifications = new Set<Notification>();
const MAX_LIVE_NOTIFICATIONS = 10;
const startHidden = process.argv.includes("--hidden");

function getIconPath(): string {
  return path.join(app.getAppPath(), "electron", "assets", "icon.ico");
}

function showMainWindow(): void {
  if (mainWindow === null || mainWindow.isDestroyed()) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

app.on("second-instance", () => {
  showMainWindow();
});

async function createWindow(url: string): Promise<void> {
  const icon = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    title: "drpk",
    icon,
    backgroundColor: "#1f1f22",
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#151517", symbolColor: "#a3a3ab", height: 38 },
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    if (!startHidden) {
      mainWindow?.show();
    }
  });

  mainWindow.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on("query-session-end", () => {
    quitting = true;
  });
  mainWindow.on("session-end", () => {
    quitting = true;
  });

  await mainWindow.loadURL(url);
}

function createTray(): void {
  const icon = getIconPath();
  tray = new Tray(icon);
  tray.setToolTip("drpk");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open",
      click: () => {
        showMainWindow();
      },
    },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    showMainWindow();
  });
}

async function startServer(): Promise<string> {
  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}`;
  const serverPath = standaloneServerPath(process.resourcesPath, app.isPackaged, app.getAppPath());

  server = utilityProcess.fork(serverPath, [], {
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      DATA_DIR: app.getPath("userData"),
    },
    serviceName: "drpk-next",
    stdio: "inherit",
  });

  const exited = new Promise<never>((_, reject) => {
    server?.once("exit", (code) => reject(new Error(`server process exited (code ${code})`)));
  });
  exited.catch(() => {}); // the later kill on quit must not surface as an unhandled rejection

  try {
    await Promise.race([waitForServer(url, { timeoutMs: 20000, intervalMs: 200 }), exited]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("drpk", `Couldn't start the app server: ${message}`);
    app.quit();
    throw error;
  }

  return url;
}

app.whenReady().then(async () => {
  if (!gotLock) {
    return;
  }

  let url: string;
  try {
    url = await startServer();
  } catch {
    return;
  }

  const notify = (body: string): void => {
    if (!Notification.isSupported()) {
      return;
    }
    const n = new Notification({ title: "drpk", body });
    n.on("click", () => {
      liveNotifications.delete(n);
      showMainWindow();
      mainWindow?.loadURL(url).catch(() => {});
    });
    n.on("close", (details) => {
      if (details.reason !== "timedOut") liveNotifications.delete(n);
    });
    liveNotifications.add(n);
    while (liveNotifications.size > MAX_LIVE_NOTIFICATIONS) {
      const oldest = liveNotifications.values().next().value;
      if (oldest === undefined) break;
      liveNotifications.delete(oldest);
    }
    n.show();
  };

  const applyLaunchAtLogin = (on: boolean): void => {
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: on, args: ["--hidden"] });
    }
  };

  scheduler = createScheduler({
    baseUrl: url,
    fetch,
    now: Date.now,
    setTimer: setTimeout,
    clearTimer: (h) => clearTimeout(h as NodeJS.Timeout),
    notify,
    applyLaunchAtLogin,
  });
  scheduler.start();
  powerMonitor.on("resume", () => void scheduler?.check());

  await createWindow(url);
  createTray();
});

app.on("before-quit", () => {
  quitting = true;
});

app.on("will-quit", () => {
  scheduler?.stop();
  server?.kill();
});
