const { ipcRenderer } = require("electron");
const Store = require("electron-store");
const store = new Store();

function docId(element) {
  return document.getElementById(element);
}

function docQuery(element) {
  return document.querySelector(element);
}

const params = new Proxy(new URLSearchParams(window.location.search), {
  get: (searchParams, prop) => searchParams.get(prop),
});

function window_close() {
  ipcRenderer.send("closeSpace", params.name);
}

let video = document.createElement("video");
let hls = new Hls();
hls.loadSource(params.url);
hls.attachMedia(video);
hls.on(Hls.Events.MANIFEST_PARSED, () => {
  video.play();
});
video.volume = store.get(`space_options.${params.name}.volume`);
video.addEventListener("loadedmetadata", () => {
  video.currentTime = video.duration - 3;
});
docId("panel").append(video);

docId("volume").value = video.volume;
docId("volume").addEventListener("change", (e) => {
  video.volume = e.target.value;
});

video.addEventListener("progress", () => {
  if (video.paused)
    docQuery(".control_time .control_progress").style.width =
      (video.currentTime / video.duration) * 100 + "%";
});

let realTimeTemp = false;
video.addEventListener("timeupdate", () => {
  docQuery(".control_time .control_progress").style.width =
    (video.currentTime / video.duration) * 100 + "%";
  if (video.currentTime <= video.duration - 4) {
    const realTimeText = docQuery(".real_time p");
    const realTimeSpan = docQuery(".real_time span");
    const time = video.duration - video.currentTime;
    const hour = Math.floor(time / 3600);
    const minute = Math.floor((time - hour * 3600) / 60);
    const second = Math.floor(time - hour * 3600 - minute * 60);
    realTimeText.innerText = `-${hour}:${minute}:${second}`;
    realTimeSpan.style.backgroundColor = "rgba(255, 255, 255, 0.40)";
    realTimeTemp = false;
  } else if (!realTimeTemp) {
    const realTimeText = docQuery(".real_time p");
    const realTimeSpan = docQuery(".real_time span");
    realTimeText.innerText = "실시간";
    realTimeSpan.style.backgroundColor = "#79EC84";
    realTimeTemp = true;
  }
});

const draggable = docId("draggable");

draggable.addEventListener("mousedown", (e) => {
  const moveHandler = (e) => {
    ipcRenderer.send("moveSpace", {
      name: params.name,
      x: e.movementX,
      y: e.movementY,
    });
  };
  const upHandler = () => {
    window.removeEventListener("mousemove", moveHandler);
    window.removeEventListener("mouseup", upHandler);
  };
  window.addEventListener("mousemove", moveHandler);
  window.addEventListener("mouseup", upHandler);
});

window.onresize = () => {
  const location = {
    x: window.screenLeft,
    y: window.screenTop,
  };

  ipcRenderer.send("resizeSpace", {
    name: params.name,
    size: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    location,
  });
};

let soundTemp = store.get(`space_options.${params.name}.volume`);

docQuery(".control_volume .control_progress").style.height =
  store.get(`space_options.${params.name}.volume`) * 100 + "%";

function volumeControl(e) {
  const barTop = docQuery(
    ".control_volume .control_background",
  ).getBoundingClientRect().top;
  const barBotom =
    docQuery(".control_volume .control_background").getBoundingClientRect()
      .bottom - barTop;
  if (e.clientY - barTop > 0 && e.clientY - barTop < barBotom) {
    const volume = 1 - (e.clientY - barTop) / barBotom;
    video.volume = volume;
    store.set(`space_options.${params.name}.volume`, volume);
    docQuery(".control_volume .control_progress").style.height =
      volume * 100 + "%";
    docQuery(".control_volume img").src = "../../assets/sound.svg";
  } else if (e.clientY - barTop <= 0) {
    video.volume = 1;
    store.set(`space_options.${params.name}.volume`, 1);
    docQuery(".control_volume .control_progress").style.height = "100%";
  } else if (e.clientY - barTop >= barBotom) {
    video.volume = 0;
    store.set(`space_options.${params.name}.volume`, 0);
    docQuery(".control_volume .control_progress").style.height = "0%";
    docQuery(".control_volume img").src = "../../assets/sound_off.svg";
  }
  soundTemp = video.volume;
}

docQuery(".control_volume .control_background").addEventListener(
  "mousedown",
  volumeControl,
);

docQuery(".control_volume .control_thumb").addEventListener(
  "mousedown",
  (e) => {
    const moveHandler = (e) => {
      docQuery(".control_volume .control_background").removeEventListener(
        "mousedown",
        volumeControl,
      );
      volumeControl(e);
    };
    const upHandler = () => {
      window.removeEventListener("mousemove", moveHandler);
      window.removeEventListener("mouseup", upHandler);
      docQuery(".control_volume .control_background").addEventListener(
        "mousedown",
        volumeControl,
      );
    };
    window.addEventListener("mousemove", moveHandler);
    window.addEventListener("mouseup", upHandler);
  },
);

docQuery(".control_volume img").addEventListener("click", () => {
  if (video.volume) {
    video.volume = 0;
    store.set(`space_options.${params.name}.volume`, 0);
    docQuery(".control_volume .control_progress").style.height = "0%";
    docQuery(".control_volume img").src = "../../assets/sound_off.svg";
  } else {
    video.volume = soundTemp;
    store.set(`space_options.${params.name}.volume`, soundTemp);
    docQuery(".control_volume .control_progress").style.height =
      soundTemp * 100 + "%";
    docQuery(".control_volume img").src = "../../assets/sound.svg";
  }
});

docQuery(".control_opacity .control_progress").style.height =
  store.get(`space_options.${params.name}.opacity`) * 100 + "%";

function opacityControl(e) {
  const barTop = docQuery(
    ".control_opacity .control_background",
  ).getBoundingClientRect().top;
  const barBotom =
    docQuery(".control_opacity .control_background").getBoundingClientRect()
      .bottom - barTop;
  if (e.clientY - barTop > 0 && e.clientY - barTop < barBotom) {
    if (1 - (e.clientY - barTop) / barBotom < 0.1) {
      store.set(`space_options.${params.name}.opacity`, 0.1);
    } else {
      store.set(
        `space_options.${params.name}.opacity`,
        1 - (e.clientY - barTop) / barBotom,
      );
    }
    docQuery(".control_opacity .control_progress").style.height =
      (1 - (e.clientY - barTop) / barBotom) * 100 + "%";
  } else if (e.clientY - barTop <= 0) {
    store.set(`space_options.${params.name}.opacity`, 1);
    docQuery(".control_opacity .control_progress").style.height = "100%";
  } else if (e.clientY - barTop >= barBotom) {
    store.set(`space_options.${params.name}.opacity`, 0.1);
    docQuery(".control_opacity .control_progress").style.height = "0%";
  }
  ipcRenderer.send("changeOpacity", params.name);
}

docQuery(".control_opacity .control_background").addEventListener(
  "mousedown",
  opacityControl,
);

docQuery(".control_opacity .control_thumb").addEventListener(
  "mousedown",
  (e) => {
    const moveHandler = (e) => {
      docQuery(".control_opacity .control_background").removeEventListener(
        "mousedown",
        opacityControl,
      );
      opacityControl(e);
    };
    const upHandler = () => {
      window.removeEventListener("mousemove", moveHandler);
      window.removeEventListener("mouseup", upHandler);
      docQuery(".control_opacity .control_background").addEventListener(
        "mousedown",
        opacityControl,
      );
    };
    window.addEventListener("mousemove", moveHandler);
    window.addEventListener("mouseup", upHandler);
  },
);

docQuery(".control_time .control_background").addEventListener("click", (e) => {
  const barLeft = docQuery(
    ".control_time .control_background",
  ).getBoundingClientRect().left;
  const barRight =
    docQuery(".control_time .control_background").getBoundingClientRect()
      .right - barLeft;
  if (e.clientX - barLeft > 0 && e.clientX - barLeft < barRight) {
    video.currentTime = video.duration * ((e.clientX - barLeft) / barRight);
    docQuery(".control_time .control_progress").style.width =
      (video.currentTime / video.duration) * 100 + "%";
  }
});

docQuery(".control_time .control_thumb").addEventListener("mousedown", (e) => {
  const moveHandler = (e) => {
    const barLeft = docQuery(
      ".control_time .control_background",
    ).getBoundingClientRect().left;
    const barRight =
      docQuery(".control_time .control_background").getBoundingClientRect()
        .right - barLeft;
    if (e.clientX - barLeft > 0 && e.clientX - barLeft < barRight) {
      video.currentTime = video.duration * ((e.clientX - barLeft) / barRight);
      docQuery(".control_time .control_progress").style.width =
        (video.currentTime / video.duration) * 100 + "%";
    }
  };
  const upHandler = () => {
    window.removeEventListener("mousemove", moveHandler);
    window.removeEventListener("mouseup", upHandler);
  };
  window.addEventListener("mousemove", moveHandler);
  window.addEventListener("mouseup", upHandler);
});

docQuery(".control_chat").addEventListener("click", () => {
  ipcRenderer.send("openChat", params.name, "space");
});

docQuery(".control_play").addEventListener("click", () => {
  if (video.paused) {
    video.play();
    docQuery(".control_play img").src = "../../assets/pause.svg";
  } else {
    video.pause();
    docQuery(".control_play img").src = "../../assets/resume.svg";
  }
});

function panelMouseEnter() {
  console.log("panelMouseEnter");
  ipcRenderer.send("fixedSpace", true, { forward: true });
}
function panelMouseLeave() {
  ipcRenderer.send("fixedSpace", false);
}

docQuery(".not_fixed").addEventListener("click", () => {
  docQuery(".panel").classList.add("panel_fixed");
  docQuery(".fixed").style.display = "flex";
  docQuery(".panel").addEventListener("mouseenter", panelMouseEnter);
  docQuery(".panel").addEventListener("mouseleave", panelMouseLeave);
});

docQuery(".fixed").addEventListener("click", () => {
  docQuery(".panel").classList.remove("panel_fixed");
  docQuery(".fixed").style.display = "none";
  docQuery(".panel").removeEventListener("mouseenter", panelMouseEnter);
  docQuery(".panel").removeEventListener("mouseleave", panelMouseLeave);
});

let durationTemp = video.duration;
setInterval(() => {
  if (!video.paused && durationTemp !== video.duration) {
    durationTemp = video.duration;
  } else {
    ipcRenderer.send("isSpaceOffWhileOn", params.name);
  }
}, 10000);
