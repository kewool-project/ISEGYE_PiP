const params = new Proxy(new URLSearchParams(window.location.search), {
  get: (searchParams, prop) => searchParams.get(prop),
});

document.getElementById("chat").src =
  `https://www.twitch.tv/embed/${params.name}/chat?parent=localhost`;
