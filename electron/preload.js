const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tuxCashierConfig", {
  supabaseUrl:
    process.env.VITE_SUPABASE_URL ||
    process.env.REACT_APP_SUPABASE_URL ||
    "",
  supabaseAnonKey:
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.REACT_APP_SUPABASE_ANON_KEY ||
    "",
});

contextBridge.exposeInMainWorld("tuxCashierPrinter", {
  isElectron: true,
  getPrinters: () => ipcRenderer.invoke("receipt:get-printers"),
  printReceipt: (html, options = {}) =>
    ipcRenderer.invoke("receipt:print", { html, options }),
  previewReceipt: (html, options = {}) =>
    ipcRenderer.invoke("receipt:preview", { html, options }),
});

contextBridge.exposeInMainWorld("tuxCashierDialogs", {
  prompt: (message, defaultValue = "") =>
    ipcRenderer.invoke("dialog:prompt", { message, defaultValue }),
});
