const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("milkShopDesktop", {
  silentPrint: (payload) => ipcRenderer.invoke("milkshop:print", payload),
  getPrinters: () => ipcRenderer.invoke("milkshop:printers"),
});
