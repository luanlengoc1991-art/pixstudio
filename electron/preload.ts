import { ipcRenderer, contextBridge } from "electron";
import {
  getAppVersion,
  getDeviceSpecs,
  getPlatform,
} from "./utils/get-device-specs";

// Keep listener wrapper references so off() cleanly unsubscribes the exact ipcRenderer callback
const listenerMap = new WeakMap<(...args: any) => any, (event: Electron.IpcRendererEvent, args: any) => void>();

// 'ipcRenderer' will be available in index.js with the method 'window.electron'
contextBridge.exposeInMainWorld("electron", {
  send: (command: string, payload: any) => ipcRenderer.send(command, payload),
  on: (command: string, func: (...args: any) => any) => {
    const wrapped = (event: Electron.IpcRendererEvent, args: any) => {
      func(event, args);
    };
    listenerMap.set(func, wrapped);
    ipcRenderer.on(command, wrapped);
  },
  off: (command: string, func: (...args: any) => any) => {
    const wrapped = listenerMap.get(func);
    if (wrapped) {
      ipcRenderer.removeListener(command, wrapped);
      listenerMap.delete(func);
    }
  },
  invoke: (command: string, payload: any) =>
    ipcRenderer.invoke(command, payload),
  platform: getPlatform(),
  getSystemInfo: async () => await getDeviceSpecs(),
  getAppVersion: async () => await getAppVersion(),
});
