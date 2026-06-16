const { contextBridge, ipcRenderer } = require("electron");

const invoke = (ch, payload) => ipcRenderer.invoke(ch, payload);

contextBridge.exposeInMainWorld("api", {
  isElectron: true,
  auth: {
    login: (username, password) => invoke("auth:login", { username, password }),
    session: () => invoke("auth:session"),
    logout: () => invoke("auth:logout"),
    change: (currentPassword, newUsername, newPassword) =>
      invoke("auth:change", { currentPassword, newUsername, newPassword }),
  },
  settings: {
    getAll: () => invoke("settings:getAll"),
    set: (key, value) => invoke("settings:set", { key, value }),
    getPrinters: () => invoke("settings:getPrinters"),
  },
  cash: {
    add: (amount) => invoke("cash:add", { amount }),
    recent: (limit) => invoke("cash:recent", { limit }),
    todayTotal: () => invoke("cash:todayTotal"),
    range: (from, to) => invoke("cash:range", { from, to }),
  },
  udhar: {
    customers: () => invoke("udhar:customers"),
    customer: (id) => invoke("udhar:customer", { id }),
    addCustomer: (input) => invoke("udhar:addCustomer", input),
    deleteCustomer: (id) => invoke("udhar:deleteCustomer", { id }),
    entries: (customerId) => invoke("udhar:entries", { customerId }),
    addEntry: (input) => invoke("udhar:addEntry", input),
  },
  monthly: {
    list: () => invoke("monthly:list"),
    add: (input) => invoke("monthly:add", input),
    update: (input) => invoke("monthly:update", input),
    delete: (id) => invoke("monthly:delete", { id }),
    payments: (clientId) => invoke("monthly:payments", { clientId }),
    addPayment: (input) => invoke("monthly:addPayment", input),
    deletePayment: (id) => invoke("monthly:deletePayment", { id }),
  },
  purchases: {
    suppliers: () => invoke("purchases:suppliers"),
    supplier: (id) => invoke("purchases:supplier", { id }),
    addSupplier: (input) => invoke("purchases:addSupplier", input),
    deleteSupplier: (id) => invoke("purchases:deleteSupplier", { id }),
    entries: (supplierId) => invoke("purchases:entries", { supplierId }),
    addEntry: (input) => invoke("purchases:addEntry", input),
    totals: () => invoke("purchases:totals"),
  },
  print: {
    receipt: (payload) => invoke("print:receipt", payload),
    test: () => invoke("print:testReceipt"),
  },
  data: {
    backup: () => invoke("data:backup"),
    restore: () => invoke("data:restore"),
    clearAll: (currentPassword) => invoke("data:clearAll", { currentPassword }),
  },
});
