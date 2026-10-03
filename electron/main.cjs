const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");

let mainWindow;
let printWindow;
let printQueue = Promise.resolve();

function getPrintWindow() {
  if (printWindow && !printWindow.isDestroyed()) return printWindow;
  printWindow = new BrowserWindow({
    show: false,
    width: 800,
    height: 1200,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });
  printWindow.on("closed", () => { printWindow = null; });
  return printWindow;
}

async function silentPrint({ html, deviceName }) {
  const win = getPrintWindow();
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  await win.loadURL(dataUrl);
  return await new Promise((resolve) => {
    win.webContents.print({
      silent: true,
      printBackground: true,
      deviceName: deviceName || undefined,
      margins: { marginType: "none" },
      usePrinterDefaultPageSize: true,
    }, (success, failureReason) => {
      resolve(success ? { ok: true } : { ok: false, error: failureReason || "Print job failed" });
    });
  });
}

ipcMain.handle("milkshop:print", (_event, payload) => {
  const job = printQueue.then(() => silentPrint(payload));
  printQueue = job.catch(() => undefined);
  return job;
});

ipcMain.handle("milkshop:printers", async () => {
  const win = getPrintWindow();
  const printers = await win.webContents.getPrintersAsync();
  return printers.map((p) => ({
    name: p.name,
    displayName: p.displayName || p.name,
    isDefault: Boolean(p.isDefault),
    status: Number(p.status || 0),
  }));
});

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const devUrl = process.env.MILKSHOP_DEV_URL;
  if (devUrl) mainWindow.loadURL(devUrl);
  else mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
}

app.whenReady().then(createMainWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
