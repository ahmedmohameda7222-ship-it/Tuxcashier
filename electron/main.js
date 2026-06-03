const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");

const isDev = Boolean(process.env.ELECTRON_START_URL);
const RECEIPT_WINDOW_WIDTH = 460;

function receiptDataUrl(html) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(String(html || ""))}`;
}

async function createReceiptWindow(html, options = {}) {
  const widthMm = Math.max(58, Number(options.widthMm || 80));
  const win = new BrowserWindow({
    width: options.show ? Math.max(RECEIPT_WINDOW_WIDTH, Math.round(widthMm * 6)) : RECEIPT_WINDOW_WIDTH,
    height: options.show ? 760 : 520,
    show: Boolean(options.show),
    title: options.title || "TUX Receipt",
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  await win.loadURL(receiptDataUrl(html));
  try {
    await win.webContents.executeJavaScript(
      "document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true",
      true
    );
  } catch {
    // Font readiness is best-effort; printing can continue if Chromium cannot evaluate it.
  }
  return win;
}

function printWebContents(webContents, printOptions) {
  return new Promise((resolve) => {
    webContents.print(printOptions, (success, failureReason) => {
      resolve({ success, failureReason: failureReason || "" });
    });
  });
}

async function getDefaultPrinter(webContents) {
  try {
    const printers = await webContents.getPrintersAsync();
    return {
      printers,
      defaultPrinter: printers.find((printer) => printer.isDefault) || null,
    };
  } catch (error) {
    return { printers: [], defaultPrinter: null, error };
  }
}

async function printReceipt(html, options = {}) {
  const widthMm = Math.max(58, Number(options.widthMm || 80));
  const win = await createReceiptWindow(html, {
    widthMm,
    show: false,
    title: "TUX Receipt Print",
  });

  const { defaultPrinter } = await getDefaultPrinter(win.webContents);
  const baseOptions = {
    printBackground: true,
    margins: { marginType: "none" },
    pageSize: {
      width: Math.round(widthMm * 1000),
      height: 297000,
    },
  };

  let mode = defaultPrinter ? "silent" : "dialog";
  let result = await printWebContents(win.webContents, {
    ...baseOptions,
    silent: Boolean(defaultPrinter),
    deviceName: defaultPrinter ? defaultPrinter.name : undefined,
  });

  if (!result.success && defaultPrinter) {
    mode = "dialog";
    result = await printWebContents(win.webContents, {
      ...baseOptions,
      silent: false,
    });
  }

  setTimeout(() => {
    if (!win.isDestroyed()) win.close();
  }, 500);

  if (!result.success) {
    throw new Error(result.failureReason || "Receipt print failed.");
  }

  return {
    success: true,
    mode,
    printer: defaultPrinter ? defaultPrinter.name : null,
  };
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showPromptDialog(parentWebContents, options = {}) {
  return new Promise((resolve) => {
    const parent = BrowserWindow.fromWebContents(parentWebContents);
    const channel = `dialog:prompt-response:${Date.now()}:${Math.random()
      .toString(36)
      .slice(2)}`;
    const message = String(options.message || "");
    const defaultValue = String(options.defaultValue || "");
    const isPin = /pin/i.test(message);
    let settled = false;

    const promptWin = new BrowserWindow({
      width: 440,
      height: 210,
      parent,
      modal: Boolean(parent),
      resizable: false,
      minimizable: false,
      maximizable: false,
      title: "TUX Cashier",
      backgroundColor: "#ffffff",
      webPreferences: {
        contextIsolation: false,
        nodeIntegration: true,
      },
    });

    const settle = (value) => {
      if (settled) return;
      settled = true;
      ipcMain.removeAllListeners(channel);
      resolve(value);
      if (!promptWin.isDestroyed()) promptWin.close();
    };

    ipcMain.once(channel, (event, value) => {
      if (event.sender !== promptWin.webContents) return;
      settle(value == null ? null : String(value));
    });

    promptWin.on("closed", () => settle(null));
    promptWin.removeMenu();
    promptWin.loadURL(
      receiptDataUrl(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 18px;
      font: 14px/1.4 "Segoe UI", Arial, sans-serif;
      color: #111;
      background: #fff;
    }
    label { display: block; font-weight: 600; margin-bottom: 10px; }
    input {
      width: 100%;
      height: 36px;
      padding: 6px 9px;
      border: 1px solid #aaa;
      border-radius: 6px;
      font: inherit;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 18px;
    }
    button {
      min-width: 82px;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #999;
      background: #f4f4f4;
      font: inherit;
      cursor: pointer;
    }
    button.primary {
      border-color: #0b5cad;
      background: #1565c0;
      color: #fff;
    }
  </style>
</head>
<body>
  <label for="prompt-input">${escapeHtml(message)}</label>
  <input id="prompt-input" type="${isPin ? "password" : "text"}" value="${escapeHtml(defaultValue)}" autofocus>
  <div class="actions">
    <button id="cancel" type="button">Cancel</button>
    <button id="ok" class="primary" type="button">OK</button>
  </div>
  <script>
    const { ipcRenderer } = require("electron");
    const channel = ${JSON.stringify(channel)};
    const input = document.getElementById("prompt-input");
    const send = (value) => ipcRenderer.send(channel, value);
    document.getElementById("ok").addEventListener("click", () => send(input.value));
    document.getElementById("cancel").addEventListener("click", () => send(null));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") send(input.value);
      if (event.key === "Escape") send(null);
    });
    window.addEventListener("load", () => {
      input.focus();
      input.select();
    });
  </script>
</body>
</html>`)
    );
  });
}

ipcMain.handle("receipt:get-printers", async (event) => {
  const { printers } = await getDefaultPrinter(event.sender);
  return printers;
});

ipcMain.handle("receipt:print", async (_event, payload = {}) => {
  return printReceipt(payload.html, payload.options || {});
});

ipcMain.handle("receipt:preview", async (_event, payload = {}) => {
  const win = await createReceiptWindow(payload.html, {
    ...(payload.options || {}),
    show: true,
    title: "TUX Receipt Preview",
  });
  win.focus();
  return { success: true };
});

ipcMain.handle("dialog:prompt", async (event, payload = {}) => {
  return showPromptDialog(event.sender, payload);
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: "TUX Cashier",
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev) {
    win.loadURL(process.env.ELECTRON_START_URL);
    return;
  }

  win.loadFile(path.join(__dirname, "..", "build", "index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

process.on("uncaughtException", (error) => {
  dialog.showErrorBox("TUX Cashier startup error", String(error?.stack || error));
});
