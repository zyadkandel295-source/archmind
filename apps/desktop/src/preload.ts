import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("archmindDesktop", {
  platform: process.platform,
  status: () => ipcRenderer.invoke("archmind:status"),
  chat: (input: { message: string; conversationId?: string }) => ipcRenderer.invoke("archmind:chat", input),
  selectFolder: () => ipcRenderer.invoke("archmind:select-folder"),
  setMode: (mode: "full" | "compact" | "bubble" | "tray") => ipcRenderer.invoke("archmind:set-mode", mode),
  undoLast: () => ipcRenderer.invoke("archmind:undo-last"),
  setLaunchAtLogin: (enabled: boolean) => ipcRenderer.invoke("archmind:set-launch-at-login", enabled),
  quitApp: () => ipcRenderer.invoke("archmind:quit-app")
});
