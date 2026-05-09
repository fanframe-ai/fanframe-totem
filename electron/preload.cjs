const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fanframeKiosk", {
  getConfig: () => ipcRenderer.invoke("fanframe:get-config"),
  startCardPayment: (request) => ipcRenderer.invoke("fanframe:start-card-payment", request),
});
