import path from "node:path";
import type { UtilityProcess } from "electron";
import { app, BrowserWindow, dialog, Menu, Notification, Tray, utilityProcess } from "electron";
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
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  await mainWindow.loadURL(url);
}

function createTray(url: string): void {
  const icon = getIconPath();
  tray = new Tray(icon);
  tray.setToolTip("drpk");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open",
      click: () => {
        if (mainWindow === null || mainWindow.isDestroyed()) {
          void createWindow(url);
        } else {
          showMainWindow();
        }
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
    if (mainWindow === null || mainWindow.isDestroyed()) {
      void createWindow(url);
    } else {
      showMainWindow();
    }
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
    },
    serviceName: "drpk-next",
    stdio: "inherit",
  });

  let exitedEarly = false;
  server.once("exit", () => {
    exitedEarly = true;
  });

  try {
    await waitForServer(url, { timeoutMs: 20000, intervalMs: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("drpk", `Couldn't start the app server: ${message}`);
    app.quit();
    throw error;
  }

  if (exitedEarly) {
    dialog.showErrorBox("drpk", "Couldn't start the app server: server process exited early");
    app.quit();
    throw new Error("Server process exited before it was ready");
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

  await createWindow(url);
  createTray(url);

  if (Notification.isSupported()) {
    new Notification({ title: "drpk", body: "drpk is running" }).show();
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("will-quit", () => {
  server?.kill();
});
