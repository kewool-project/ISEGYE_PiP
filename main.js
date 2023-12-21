const electron = require("electron");
const path = require("path");
const { ElectronAuthProvider } = require("@twurple/auth-electron");
const { ApiClient } = require("@twurple/api");
const { app, BrowserWindow, ipcMain, Tray, Menu, screen, shell } = electron;
const { autoUpdater } = require("electron-updater");
const twitch = require("./lib.js");
const config = require("./config.json");
const Store = require("electron-store");

const page_dir = path.join(__dirname, "/src/");
const clientId = config["CLIENT_ID"];
const redirectUri = config["REDIRECT_URI"];
const twitterId = config["TWITTER_ID"];
const authProvider = new ElectronAuthProvider({
  clientId,
  redirectUri,
});
const apiClient = new ApiClient({ authProvider });

const store = new Store();

const lock = app.requestSingleInstanceLock();

let mainWin;
let tray;
let backWin;
let streamWin = {};
let spaceWin = {};
let chatWin = {};
let trayIcon;
let guideWin;

async function redactedFunc() {
  try {
    const { redactedFunc } = require("./redacted.js");
    return await redactedFunc();
  } catch (e) {
    return {};
  }
}

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 560,
    height: 596,
    frame: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
    icon: path.join(page_dir, "assets/icon.png"),
    resizable: false,
    titleBarStyle: "hidden",
    trafficLightPosition: {
      x: 12,
      y: 12,
    },
  });
  //mainWin.setMenu(null);
  mainWin.loadURL(
    "file://" +
      path.join(page_dir, `pages/main/index.html?platform=${process.platform}`),
  );
  mainWin.on("closed", () => {
    mainWin = null;
  });
}

function createBackground() {
  backWin = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  });
  // backWin.webContents.openDevTools();

  backWin.loadFile(path.join(page_dir, "pages/background/index.html"));
}

function createPIPWin(url, name) {
  streamWin[name] = {};
  streamWin[name].pip = new BrowserWindow({
    width: store.get("pip_options")[name].size.width,
    height: store.get("pip_options")[name].size.height,
    minWidth: 240,
    minHeight: 135,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
    frame: false,
    resizable: true,
    maximizable: false,
    skipTaskbar: true,
    x: store.get("pip_options")[name].location.x,
    y: store.get("pip_options")[name].location.y,
    opacity: store.get("pip_options")[name].opacity,
  });
  streamWin[name].pip.setAspectRatio(16 / 9);
  streamWin[name].pip.setMenu(null);
  streamWin[name].pip.loadURL(
    "file://" +
      path.join(page_dir, `pages/pip/index.html?url=${url}&name=${name}`),
  );
  streamWin[name].pip.setAlwaysOnTop(true, "screen-saver");
  streamWin[name].pip.setVisibleOnAllWorkspaces(true);

  createPointsWin(name);
}

function createPointsWin(name) {
  streamWin[name].points = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
  });
  streamWin[name].points.loadURL("https://twitch.tv/" + name);
  streamWin[name].points.webContents.setAudioMuted(true);
  streamWin[name].points.webContents.executeJavaScript(
    `
    setTimeout(() => {
      document.querySelector("#channel-player > div > div:nth-child(2) > div:nth-child(1) > div:nth-child(2) > div > button").click();
      document.querySelector("body > div:nth-child(19) > div > div > div > div > div:nth-child(1) > div > div > div:nth-child(2) > div:nth-child(3) > button").click();
      document.querySelector("body > div:nth-child(20) > div > div > div > div > div:nth-child(1) > div > div > div:nth-child(2) > div:nth-child(5) > div > div > div > div > label").click();
    }, 5000);
    setInterval(()=>{
        const box = document.querySelector("#live-page-chat > div > div > div:nth-child(2) > div > div > section > div > div:nth-child(6) > div:nth-child(2) > div:nth-child(2) > div:nth-child(1) > div > div > div > div:nth-child(2) > div > div > div > button");
        if(box) {
            box.click();
        }
        }, 30000);`,
  );
}

function createChatWin(name, type) {
  chatWin[name] = new BrowserWindow({
    x:
      type === "stream"
        ? store.get("pip_options")[name].location.x +
          store.get("pip_options")[name].size.width
        : store.get("space_options")[name].location.x +
          store.get("space_options")[name].size.width,
    y:
      type === "stream"
        ? store.get("pip_options")[name].location.y
        : store.get("space_options")[name].location.y,
    width: 350,
    height: store.get("pip_options")[name].size.height,
    webPreferences: {
      webviewTag: true,
    },
    frame: false,
    resizable: true,
    maximizable: false,
    skipTaskbar: true,
  });
  chatWin[name].setMenu(null);
  chatWin[name].loadURL(
    "file://" + path.join(page_dir, `pages/chat/index.html?name=${name}`),
  );
  chatWin[name].setAlwaysOnTop(true, "screen-saver");
  chatWin[name].setVisibleOnAllWorkspaces(true);
}

function createSpaceWin(url, name) {
  spaceWin[name] = {};
  spaceWin[name].pip = new BrowserWindow({
    width: store.get("space_options")[name].size.width,
    height: store.get("space_options")[name].size.height,
    minWidth: 240,
    minHeight: 135,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
    frame: false,
    resizable: true,
    maximizable: false,
    skipTaskbar: true,
    x: store.get("space_options")[name].location.x,
    y: store.get("space_options")[name].location.y,
    opacity: store.get("space_options")[name].opacity,
  });
  spaceWin[name].pip.setAspectRatio(16 / 9);
  spaceWin[name].pip.setMenu(null);
  spaceWin[name].pip.loadURL(
    "file://" +
      path.join(page_dir, `pages/space/index.html?url=${url}&name=${name}`),
  );
  spaceWin[name].pip.setAlwaysOnTop(true, "screen-saver");
  spaceWin[name].pip.setVisibleOnAllWorkspaces(true);
}

function createGuideWin() {
  guideWin = new BrowserWindow({
    width: 1280,
    height: 1080,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
    opacity: 1,
  });
  guideWin.loadFile(path.join(page_dir, "pages/guide/index.html"));
}

if (!lock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWin) {
      if (mainWin.isMinimized() || !mainWin.isVisible()) mainWin.show();
      mainWin.focus();
    } else if (!mainWin) {
      createMainWindow();
    }
  });
}

app.on("ready", () => {
  store.set("app_start", false);
  // store.delete("pip_order"); //test
  // store.delete("auto_start"); //test
  // store.delete("pip_options"); //test
  // store.delete("space_auto_start"); //test
  // store.delete("space_options"); //test
  if (!store.get("pip_order")) {
    store.set("pip_order", config["CHANNEL_NAME"]);
    app.setLoginItemSettings({
      openAtLogin: true,
    });
  }
  if (!store.get("auto_start")) {
    const order = store.get("pip_order");
    let autoStart = {};
    order.forEach((e) => {
      autoStart[e] = {};
      autoStart[e].enabled = false;
      autoStart[e].closed = false;
      autoStart[e].status = false;
    });
    store.set("auto_start", autoStart);
  } else {
    const order = store.get("pip_order");
    order.forEach((e) => {
      store.set(`auto_start.${e}.closed`, false);
      store.set(`auto_start.${e}.status`, false);
    });
  }
  if (!store.get("space_auto_start")) {
    const order = store.get("pip_order");
    let spaceAutoStart = {};
    order.forEach((e) => {
      spaceAutoStart[e] = {};
      spaceAutoStart[e].enabled = false;
      spaceAutoStart[e].closed = false;
      spaceAutoStart[e].status = false;
    });
    store.set("space_auto_start", spaceAutoStart);
  } else {
    const order = store.get("pip_order");
    order.forEach((e) => {
      store.set(`space_auto_start.${e}.closed`, false);
      store.set(`space_auto_start.${e}.status`, false);
    });
  }
  if (!store.get("pip_options")) {
    const order = store.get("pip_order");
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    let pip_options = {};
    order.forEach((e) => {
      pip_options[e] = {
        location: {
          x: width - 530,
          y: height - 320,
        },
        size: {
          width: 480,
          height: 270,
        },
        volume: 0.5,
        opacity: 1,
      };
    });
    store.set("pip_options", pip_options);
  }
  if (!store.get("space_options")) {
    const order = store.get("pip_order");
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    let space_options = {};
    order.forEach((e) => {
      space_options[e] = {
        location: {
          x: width - 290,
          y: height - 185,
        },
        size: {
          width: 240,
          height: 135,
        },
        volume: 0.5,
        opacity: 1,
      };
    });
    store.set("space_options", space_options);
  }
  createMainWindow();
  createBackground();
  trayIcon =
    process.platform === "darwin" ? "assets/icon_mac.png" : "assets/icon.png";
  tray = new Tray(path.join(page_dir, trayIcon));
  const contextMenu = Menu.buildFromTemplate([
    { label: "Exit", type: "normal", role: "quit" },
  ]);
  tray.setToolTip(config["TOOLTIP_NAME"]);
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (!mainWin) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (backWin === null) createBackground();
  if (mainWin === null) createMainWindow();
});

ipcMain.on("logout", async () => {
  let logoutWin = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
    width: 1080,
    height: 720,
  });
  logoutWin.webContents.setAudioMuted(true);
  let tempWin = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  });
  tempWin.loadURL("https://twitch.tv/");
  tempWin.webContents.setAudioMuted(true);
  tempWin.webContents.on("did-finish-load", () => {
    logoutWin.loadURL("https://twitch.tv/");
    logoutWin.webContents.on("did-finish-load", () => {
      logoutWin.webContents.executeJavaScript(
        `
        setTimeout(() => {
          document.querySelector("#root > div > div:nth-child(2) > nav > div > div:nth-child(3) > div:nth-child(7) > div > div > div > div > button").click();
          document.querySelector("body > div:nth-child(18) > div > div > div > div > div > div > div > div > div > div > div > div:nth-child(3) > div > div > div:nth-child(5) > button").click();
        }, 2000);
        `,
      );
      setTimeout(() => {
        app.exit();
      }, 3000);
    });
  });
});

ipcMain.on("getUserProfile", async (evt) => {
  const user = await apiClient.users.getUserById(
    (await apiClient.getTokenInfo()).userId,
  );
  evt.returnValue = {
    name: user?.name,
    profile: user?.profilePictureUrl,
  };
});

ipcMain.on("getChannelInfo", async (evt) => {
  const res = await apiClient.users.getUsersByNames(store.get("pip_order"));
  const info = await Promise.all(
    res.map(async (e) => {
      const stream = await apiClient.streams.getStreamByUserId(e.id);
      const follows = await apiClient.channels.getChannelFollowerCount(e);
      const lastStreamDate = await twitch.getLastStreamDate(e.name);
      let isSpace = null;
      if (store.get("twitter_csrf_token") && store.get("twitter_auth_token")) {
        isSpace = await twitch.checkSpace(
          store.get("twitter_csrf_token"),
          store.get("twitter_auth_token"),
          twitterId[e.name],
        );
      }
      return {
        name: e.name,
        displayName: e.displayName,
        profile: e.profilePictureUrl,
        id: e.id,
        follows: follows,
        startDate: stream?.startDate ?? false,
        lastStreamDate: lastStreamDate,
        isStream: stream ? true : false,
        game: stream?.gameName,
        isSpace: isSpace,
      };
    }),
  );
  backWin.webContents.send("login");
  autoUpdater.checkForUpdates();
  evt.returnValue = info;

  (async () => {
    if (!store.get("app_start")) {
      let tokenWin = new BrowserWindow({
        show: false,
      });
      tokenWin.loadURL("https://twitch.tv/");
      tokenWin.webContents.setAudioMuted(true);
      setTimeout(() => {
        tokenWin.close();
        tokenWin = null;
      }, 3000);
      store.set("app_start", true);
    }
  })();
});

// ipcMain.on("getChannelInfoDetail", async (evt, name) => {
//   const user = await apiClient.users.getUserByName(name);
//   const stream = await apiClient.streams.getStreamByUserId(user.id);
//   const follows = await apiClient.channels.getChannelFollowerCount(user);
//   evt.returnValue = {
//     name: user.name,
//     follows: follows,
//     startDate: stream?.startDate ?? false,
//   };
// });

ipcMain.handle("getChannelPoint", async (evt, name) => {
  const redacted = (await redactedFunc()).a;
  const res = await twitch.getChannelPoint(name, redacted);
  return res;
});

ipcMain.on("getStream", async (evt, name) => {
  if (streamWin[name]?.pip || store.get("auto_start")[name].status) {
    streamWin[name].pip.focus();
    return;
  }
  const isStream = (await apiClient.streams.getStreamByUserName(name))
    ? true
    : false;
  if (isStream) {
    store.set(`auto_start.${name}.status`, true);
    const redacted = (await redactedFunc()).a;
    await twitch.getStream(name, false, redacted).then((res) => {
      createPIPWin(res[0].url, name);
    });
  }
});

ipcMain.on("openSelectPIP", async (evt, name) => {
  if (streamWin[name]?.pip) {
    streamWin[name].pip.focus();
    return;
  }
  const isStream = (await apiClient.streams.getStreamByUserName(name))
    ? true
    : false;
  if (isStream) {
    store.set(`auto_start.${name}.status`, true);
    const redacted = (await redactedFunc()).a;
    await twitch.getStream(name, false, redacted).then((res) => {
      createPIPWin(res[0].url, name);
    });
  }
});

ipcMain.on("movePIP", (evt, arg) => {
  const currentPostion = streamWin[arg.name].pip.getPosition();
  const newPosition = {
    x: currentPostion[0] + arg.x,
    y: currentPostion[1] + arg.y,
  };
  streamWin[arg.name].pip.setBounds({
    x: newPosition.x,
    y: newPosition.y,
    width: store.get("pip_options")[arg.name].size.width,
    height: store.get("pip_options")[arg.name].size.height,
  });
  store.set(`pip_options.${arg.name}.location`, newPosition);
});

ipcMain.on("resizePIP", (evt, arg) => {
  store.set(`pip_options.${arg.name}.size`, arg.size);
  store.set(`pip_options.${arg.name}.location`, arg.location);
});

ipcMain.on("changeOpacity", (evt, name) => {
  streamWin[name].pip.setOpacity(store.get(`pip_options.${name}.opacity`));
});

ipcMain.on("openChat", (evt, name, type) => {
  if (chatWin[name]) {
    chatWin[name].close();
    chatWin[name] = null;
    return;
  }
  createChatWin(name, type);
});

ipcMain.on("fixedPIP", (evt, fixed, option) => {
  const pip = BrowserWindow.fromWebContents(evt.sender);
  pip.resizable = !fixed;
  pip.setIgnoreMouseEvents(fixed, option);
});

ipcMain.on("closePIP", (evt, name) => {
  streamWin[name].pip.close();
  streamWin[name].pip = null;
  streamWin[name].points.close();
  streamWin[name].points = null;
  if (chatWin[name]) {
    chatWin[name].close();
    chatWin[name] = null;
  }
  streamWin[name] = null;
  store.set(`auto_start.${name}.status`, false);
  store.set(`auto_start.${name}.closed`, true);
});

ipcMain.on("closeAllPIP", () => {
  const order = store.get("pip_order");
  order.forEach((e) => {
    if (streamWin[e]?.pip) {
      streamWin[e].pip.close();
      streamWin[e].pip = null;
      streamWin[e].points.close();
      streamWin[e].points = null;
      if (chatWin[e]) {
        chatWin[e].close();
        chatWin[e] = null;
      }
      streamWin[e] = null;
      store.set(`auto_start.${e}.status`, false);
      store.set(`auto_start.${e}.closed`, true);
    }
  });
});

ipcMain.on("isStreamOff", async (evt, name) => {
  const isStream = (await apiClient.streams.getStreamByUserName(name))
    ? true
    : false;
  if (!isStream) store.set(`auto_start.${name}.closed`, false);
});

ipcMain.on("isStreamOffWhileOn", async (evt, name) => {
  const isStream = (await apiClient.streams.getStreamByUserName(name))
    ? true
    : false;
  if (!isStream) {
    streamWin[name].pip.close();
    streamWin[name].pip = null;
    streamWin[name].points.close();
    streamWin[name].points = null;
    if (chatWin[name]) {
      chatWin[name].close();
      chatWin[name] = null;
    }
    streamWin[name] = null;
    store.set(`auto_start.${name}.status`, false);
    store.set(`auto_start.${name}.closed`, false);
  }
});

ipcMain.on("openNewWindow", (evt, url) => {
  shell.openExternal(url);
});

ipcMain.on("resetPIPSetting", () => {
  store.delete("pip_options");
  const order = store.get("pip_order");
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  let pip_options = {};
  order.forEach((e) => {
    pip_options[e] = {
      location: {
        x: width - 530,
        y: height - 320,
      },
      size: {
        width: 480,
        height: 270,
      },
      volume: 0.5,
      opacity: 1,
    };
  });
  store.set("pip_options", pip_options);
});

ipcMain.on("getSpace", async (evt, name) => {
  if (spaceWin[name]?.pip || store.get("space_auto_start")[name].status) {
    spaceWin[name].pip.focus();
    return;
  }
  const spaceId = await twitch.checkSpace(
    store.get("twitter_csrf_token"),
    store.get("twitter_auth_token"),
    twitterId[name],
  );
  if (spaceId) {
    const spaceM3U8 = await twitch.getSpaceM3U8(
      spaceId,
      store.get("twitter_csrf_token"),
      store.get("twitter_auth_token"),
    );
    createSpaceWin(spaceM3U8, name);
    store.set(`space_auto_start.${name}.status`, true);
  }
});

ipcMain.on("moveSpace", (evt, arg) => {
  const currentPostion = spaceWin[arg.name].pip.getPosition();
  const newPosition = {
    x: currentPostion[0] + arg.x,
    y: currentPostion[1] + arg.y,
  };
  spaceWin[arg.name].pip.setBounds({
    x: newPosition.x,
    y: newPosition.y,
    width: store.get("space_options")[arg.name].size.width,
    height: store.get("space_options")[arg.name].size.height,
  });
  store.set(`space_options.${arg.name}.location`, newPosition);
});

ipcMain.on("resizeSpace", (evt, arg) => {
  store.set(`space_options.${arg.name}.size`, arg.size);
  store.set(`space_options.${arg.name}.location`, arg.location);
});

ipcMain.on("changeSpaceOpacity", (evt, name) => {
  spaceWin[name].pip.setOpacity(store.get(`space_options.${name}.opacity`));
});

ipcMain.on("closeSpace", (evt, name) => {
  spaceWin[name].pip.close();
  spaceWin[name].pip = null;
  spaceWin[name] = null;
  store.set(`space_auto_start.${name}.status`, false);
  store.set(`space_auto_start.${name}.closed`, true);
});

ipcMain.on("closeAllSpace", () => {
  const order = store.get("pip_order");
  order.forEach((e) => {
    if (spaceWin[e]?.pip) {
      spaceWin[e].pip.close();
      spaceWin[e].pip = null;
      spaceWin[e] = null;
      store.set(`space_auto_start.${e}.status`, false);
      store.set(`space_auto_start.${e}.closed`, true);
    }
  });
});

ipcMain.on("isSpaceOff", async (evt, name) => {
  const isSpace = await twitch.checkSpace(
    store.get("twitter_csrf_token"),
    store.get("twitter_auth_token"),
    twitterId[name],
  );
  if (!isSpace) store.set(`space_auto_start.${name}.closed`, false);
});

ipcMain.on("isSpaceOffWhileOn", async (evt, name) => {
  const isSpace = await twitch.checkSpace(
    store.get("twitter_csrf_token"),
    store.get("twitter_auth_token"),
    twitterId[name],
  );
  if (!isSpace) {
    spaceWin[name].pip.close();
    spaceWin[name].pip = null;
    spaceWin[name] = null;
    store.set(`space_auto_start.${name}.status`, false);
    store.set(`space_auto_start.${name}.closed`, false);
  }
});

ipcMain.on("resetSpaceSetting", () => {
  store.delete("space_options");
  const order = store.get("pip_order");
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  let space_options = {};
  order.forEach((e) => {
    space_options[e] = {
      location: {
        x: width - 290,
        y: height - 185,
      },
      size: {
        width: 240,
        height: 135,
      },
      volume: 0.5,
      opacity: 1,
    };
  });
  store.set("space_options", space_options);
});

ipcMain.on("openGuide", () => {
  createGuideWin();
});

ipcMain.on("app_version", (evt) => {
  evt.sender.send("app_version_reply", { version: app.getVersion() });
});

ipcMain.on("mac_update", () => {
  shell.openExternal(config.RELEASE_URL);
});

autoUpdater.on("update-downloaded", () => {
  mainWin.webContents.send("update_downloaded");
});

ipcMain.on("restart_app", () => {
  autoUpdater.quitAndInstall();
});

ipcMain.on("closeMainWin", () => {
  mainWin.close();
  mainWin = null;
});

ipcMain.on("minimizeMainWin", () => {
  mainWin.minimize();
});
