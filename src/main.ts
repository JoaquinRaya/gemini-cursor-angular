import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  session,
  dialog,
  desktopCapturer,
} from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { CursorController } from "@/apps/cursor/controller";
import fs from "node:fs";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Ensure captures directory exists
const capturesDir = path.join(app.getPath("userData"), "captures");
if (!fs.existsSync(capturesDir)) {
  fs.mkdirSync(capturesDir, { recursive: true });
}

let tray: Tray | null = null;
let cursorWindow: BrowserWindow | null = null;
let controlWindow: BrowserWindow | null = null;
let cursorController: CursorController | null = null;

const createControlWindow = () => {
  controlWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true,
      // Enable screen capture and WebRTC features
      webSecurity: true,
      sandbox: false,
    },
  });

  // Enable screen capture permissions
  controlWindow.webContents.session.setPermissionCheckHandler(
    (webContents, permission) => {
      const allowedPermissions = [
        "media",
        "display-capture",
        "screen",
        "desktopCapture",
      ] as const;
      return allowedPermissions.includes(
        permission as (typeof allowedPermissions)[number]
      );
    }
  );

  controlWindow.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      const allowedPermissions = [
        "media",
        "display-capture",
        "screen",
        "desktopCapture",
      ] as const;
      callback(
        allowedPermissions.includes(
          permission as (typeof allowedPermissions)[number]
        )
      );
    }
  );

  // Set additional required permissions
  controlWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: mediastream: blob:; connect-src 'self' wss://generativelanguage.googleapis.com ws://generativelanguage.googleapis.com https://generativelanguage.googleapis.com; media-src 'self' mediastream: blob: data:; img-src 'self' data: blob:",
          ],
        },
      });
    }
  );

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    controlWindow.loadURL(
      `${MAIN_WINDOW_VITE_DEV_SERVER_URL}/src/apps/controls/index.html`
    );
  } else {
    controlWindow.loadFile(
      path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/src/apps/controls/index.html`
      )
    );
  }
};

const createCursorWindow = () => {
  cursorWindow = new BrowserWindow({
    width: 24,
    height: 24,
    frame: false,
    backgroundColor: "#D96570",
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    transparent: true,
    fullscreenable: false,
    skipTaskbar: true,
    roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false,
    },
  });

  // Make the window click-through and prevent it from accepting focus
  cursorWindow.setIgnoreMouseEvents(true, { forward: true });
  cursorWindow.setFocusable(false);

  // Load the index.html
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    cursorWindow.loadURL(
      `${MAIN_WINDOW_VITE_DEV_SERVER_URL}/src/apps/cursor/index.html`
    );
  } else {
    cursorWindow.loadFile(
      path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/src/apps/cursor/index.html`
      )
    );
  }

  // Initialize cursor controller
  cursorController = new CursorController(cursorWindow);

  // Create Tray
  const iconPath = path.join(app.getAppPath(), "resources", "gemini-logo.png");
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Controls",
      type: "normal",
      click: () => {
        controlWindow?.show();
      },
    },
    {
      label: "Quit",
      type: "normal",
      click: () => {
        cursorController?.cleanup();
        app.quit();
      },
    },
  ]);

  tray.setToolTip("Gemini Cursor");
  tray.setContextMenu(contextMenu);
};

// Before app.whenReady()
app.commandLine.appendSwitch("enable-features", "WebRTCPipeWireCapturer");

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Enable screen capture
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      const allowedPermissions = [
        "media",
        "display-capture",
        "screen",
      ] as const;
      callback(
        allowedPermissions.includes(
          permission as (typeof allowedPermissions)[number]
        )
      );
    }
  );

  // Set up display media request handler
  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen", "window"],
          thumbnailSize: { width: 0, height: 0 },
        });

        if (sources.length > 0) {
          callback({
            video: sources[0],
            audio: null,
          });
        } else {
          callback(null);
        }
      } catch (error) {
        console.error("Error getting screen sources:", error);
        callback(null);
      }
    }
  );

  ipcMain.on("move-cursor", (event, x: number, y: number) => {
    cursorController?.moveTo(x, y);
  });

  ipcMain.on(
    "save-image",
    async (event, imageData: string, autoSave?: boolean) => {
      try {
        let filePath: string;

        if (autoSave) {
          // For automatic saves, use the captures directory directly
          filePath = path.join(capturesDir, `capture-${Date.now()}.jpg`);
        } else {
          // For manual saves, show dialog but default to captures directory
          const { filePath: selectedPath } = await dialog.showSaveDialog({
            defaultPath: path.join(capturesDir, `capture-${Date.now()}.jpg`),
            filters: [{ name: "Images", extensions: ["jpg"] }],
          });
          filePath = selectedPath;
        }

        if (filePath) {
          // Remove the data URL prefix and convert to buffer
          const base64Data = imageData.replace(/^data:image\/jpeg;base64,/, "");
          fs.writeFileSync(filePath, base64Data, "base64");
        }
      } catch (error) {
        console.error("Error saving image:", error);
      }
    }
  );

  createCursorWindow();
  createControlWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  cursorController?.cleanup();

  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Add a before-quit handler to ensure proper cleanup
app.on("before-quit", () => {
  cursorController?.cleanup();

  // Destroy windows explicitly
  if (cursorWindow) {
    cursorWindow.destroy();
    cursorWindow = null;
  }

  if (controlWindow) {
    controlWindow.destroy();
    controlWindow = null;
  }

  if (tray) {
    tray.destroy();
    tray = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createCursorWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
