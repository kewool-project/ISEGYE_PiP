const { ipcRenderer } = require("electron");
const Store = require("electron-store");
const store = new Store();

let getStream;

ipcRenderer.on("login", () => {
  getStream = setInterval(() => {
    const auto_start = store.get("auto_start");
    const space_auto_start = store.get("space_auto_start");
    const spaceSetting =
      store.get("twitter_csrf_token") && store.get("twitter_auth_token");
    store.get("pip_order").forEach((e) => {
      if (
        auto_start[e].enabled &&
        !auto_start[e].closed &&
        !auto_start[e].status &&
        !space_auto_start[e].status
      ) {
        ipcRenderer.send("getStream", e);
      } else if (
        auto_start[e].closed &&
        !auto_start[e].status &&
        !space_auto_start[e].status
      ) {
        ipcRenderer.send("isStreamOff", e);
      } else if (
        space_auto_start[e].enabled &&
        !space_auto_start[e].closed &&
        !space_auto_start[e].status &&
        !auto_start[e].status &&
        spaceSetting
      ) {
        ipcRenderer.send("getSpace", e);
      } else if (
        space_auto_start[e].closed &&
        !space_auto_start[e].status &&
        !auto_start[e].status &&
        spaceSetting
      ) {
        ipcRenderer.send("isSpaceOff", e);
      }
    });
  }, 10000);
});
