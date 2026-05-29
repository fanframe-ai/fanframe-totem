const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fanframeKiosk", {
  getConfig: () => ipcRenderer.invoke("fanframe:get-config"),
  startCardPayment: (request) => ipcRenderer.invoke("fanframe:start-card-payment", request),
  loadDeviceIdentity: () => ipcRenderer.invoke("kiosk:load-device-identity"),
  saveDeviceIdentity: (identity) => ipcRenderer.invoke("kiosk:save-device-identity", identity),
  clearDeviceIdentity: () => ipcRenderer.invoke("kiosk:clear-device-identity"),
  saveDeviceConfig: (config) => ipcRenderer.invoke("kiosk:save-device-config", config),
  saveCameraOrientation: (cameraOrientation) => ipcRenderer.invoke("kiosk:save-camera-orientation", cameraOrientation),
  getTechnicalStatus: () => ipcRenderer.invoke("kiosk:get-technical-status"),
  getPaymentStatus: () => ipcRenderer.invoke("kiosk:get-payment-status"),
  getUpdateStatus: () => ipcRenderer.invoke("kiosk:get-update-status"),
  startAppUpdate: () => ipcRenderer.invoke("kiosk:start-app-update"),
  relaunch: () => ipcRenderer.invoke("kiosk:relaunch"),
  onOpenTechnicalMode: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("kiosk:open-technical-mode", listener);
    return () => ipcRenderer.removeListener("kiosk:open-technical-mode", listener);
  },
});
