const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const http = require("node:http");
const fs = require("node:fs");

let mainWindow;
let printWindow;
let printQueue = Promise.resolve();
let localServer;

function startLocalServer() {
  if (localServer) return Promise.resolve(localServer.address().port);
  const root = path.join(__dirname, "..", "dist");
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2" };
  localServer = http.createServer((req, res) => {
    const rawPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let filePath = path.join(root, rawPath === "/" ? "index.html" : rawPath);
    if (!filePath.startsWith(root)) { res.writeHead(403); return res.end("Forbidden"); }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) filePath = path.join(root, "index.html");
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(500); return res.end("Unable to load app"); }
      res.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    localServer.once("error", reject);
    localServer.listen(0, "127.0.0.1", () => resolve(localServer.address().port));
  });
}

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

async function silentPrint({ html, deviceName, pageSize }) {
  const win = getPrintWindow();
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  await win.loadURL(dataUrl);
  return await new Promise((resolve) => {
    win.webContents.print({
      silent: true,
      printBackground: true,
      deviceName: deviceName || undefined,
      margins: { marginType: "none" },
      ...(pageSize
        ? { pageSize: { width: pageSize.widthMicrons, height: pageSize.heightMicrons } }
        : { usePrinterDefaultPageSize: true }),
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

async function createMainWindow() {
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
  if (devUrl) await mainWindow.loadURL(devUrl);
  else {
    const port = await startLocalServer();
    await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  }
  mainWindow.once("ready-to-show", () => mainWindow.show());
}

app.whenReady().then(createMainWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => { if (localServer) localServer.close(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
