const { ipcRenderer } = require("electron");
const Store = require("electron-store");
const store = new Store();

let getStream;

ipcRenderer.on("login", () => {
  getStream = setInterval(() => {
    const auto_start = store.get("auto_start");
    store.get("pip_order").forEach((e) => {
      if (
        auto_start[e].enabled &&
        !auto_start[e].closed &&
        !auto_start[e].status
      ) {
        ipcRenderer.send("getStream", e);
      } else if (
        auto_start[e].enabled &&
        auto_start[e].closed &&
        !auto_start[e].status
      ) {
        ipcRenderer.send("isStreamOff", e);
      } else if (
        auto_start[e].enabled &&
        !auto_start[e].closed &&
        auto_start[e].status
      ) {
        ipcRenderer.send("isStreamOffWhileOn", e);
      }
    });
  }, 10000);
});
