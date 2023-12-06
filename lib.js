const { BrowserWindow } = require("electron");
const https = require("https");

const clientId = "kimne78kx3ncx6brgo4mv6wki5h1ko";

function getAccessToken(id, isVod, redacted = {}) {
  const data = JSON.stringify({
    operationName: "PlaybackAccessToken",
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash:
          "0828119ded1c13477966434e15800ff57ddacf13ba1911c129dc2200705b0712",
      },
    },
    variables: {
      isLive: !isVod,
      login: isVod ? "" : id,
      isVod: isVod,
      vodID: isVod ? id : "",
      playerType: "site",
    },
  });

  const options = {
    hostname: "gql.twitch.tv",
    port: 443,
    path: "/gql",
    method: "POST",
    headers: {
      "Client-id": clientId,
      ...redacted,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      let resData = {};
      resData.statusCode = response.statusCode;
      resData.body = [];
      response.on("data", (chunk) => resData.body.push(chunk));
      response.on("end", () => {
        resData.body = resData.body.join("");

        if (resData.statusCode !== 200) {
          let win = new BrowserWindow();
          win.loadURL("https://twitch.tv/login");
          reject(new Error(`mabye not authorized`));
        } else {
          if (isVod) {
            resolve(JSON.parse(resData.body).data.videoPlaybackAccessToken);
          } else {
            resolve(JSON.parse(resData.body).data.streamPlaybackAccessToken);
          }
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.write(data);
    req.end();
  });
}

function getPlaylist(id, accessToken, vod) {
  return new Promise((resolve, reject) => {
    const req = https
      .get(
        `https://usher.ttvnw.net/${
          vod ? "vod" : "api/channel/hls"
        }/${id}.m3u8?client_id=${clientId}&token=${accessToken.value}&sig=${
          accessToken.signature
        }&allow_source=true&allow_audio_only=true`,
        (response) => {
          let data = {};
          data.statusCode = response.statusCode;
          data.body = [];
          response.on("data", (chunk) => data.body.push(chunk));
          response.on("end", () => {
            data.body = data.body.join("");

            switch (data.statusCode) {
              case 200:
                resolve(resolve(data.body));
                break;
              case 404:
                reject(
                  new Error(
                    "Transcode does not exist - the stream is probably offline",
                  ),
                );
                break;
              default:
                reject(
                  new Error(`Twitch returned status code ${data.statusCode}`),
                );
                break;
            }
          });
        },
      )
      .on("error", (error) => reject(error));

    req.end();
  });
}

function parsePlaylist(playlist) {
  const parsedPlaylist = [];
  const lines = playlist.split("\n");
  for (let i = 4; i < lines.length; i += 3) {
    parsedPlaylist.push({
      // eslint-disable-next-line quotes
      quality: lines[i - 2].split('NAME="')[1].split('"')[0],
      resolution:
        lines[i - 1].indexOf("RESOLUTION") !== -1
          ? lines[i - 1].split("RESOLUTION=")[1].split(",")[0]
          : null,
      url: lines[i],
    });
  }
  return parsedPlaylist;
}

function getStream(channel, raw, redacted = {}) {
  return new Promise((resolve, reject) => {
    getAccessToken(channel, false, redacted)
      .then((accessToken) => getPlaylist(channel, accessToken, false))
      .then((playlist) => resolve(raw ? playlist : parsePlaylist(playlist)))
      .catch((error) => reject(error));
  });
}

function getLastStreamDate(channel) {
  const data = [
    {
      operationName: "StreamSchedule",
      variables: {
        login: channel,
        startingWeekday: "MONDAY",
        utcOffsetMinutes: 540,
        startAt: "2023-08-20T15:00:00.000Z",
        endAt: "2023-08-27T14:59:59.059Z",
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash:
            "d495cb17a67b6f7a8842e10297e57dcd553ea17fe691db435e39a618fe4699cf",
        },
      },
    },
  ];

  const options = {
    hostname: "gql.twitch.tv",
    port: 443,
    path: "/gql",
    method: "POST",
    headers: {
      "Client-id": clientId,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      let resData = {};
      resData.statusCode = response.statusCode;
      resData.body = [];
      response.on("data", (chunk) => resData.body.push(chunk));
      response.on("end", () => {
        resData.body = resData.body.join("");

        if (resData.statusCode !== 200) {
          reject(new Error(`${JSON.parse(data.body).message}`));
        } else {
          resolve(
            JSON.parse(resData.body)[0].data.user.lastBroadcast.startedAt,
          );
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.write(JSON.stringify(data));
    req.end();
  });
}

function getChannelPoint(channel, redacted = {}) {
  const data = [
    {
      operationName: "ChannelPointsContext",
      variables: {
        channelLogin: channel,
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash:
            "1530a003a7d374b0380b79db0be0534f30ff46e61cffa2bc0e2468a909fbc024",
        },
      },
    },
  ];

  const options = {
    hostname: "gql.twitch.tv",
    port: 443,
    path: "/gql",
    method: "POST",
    headers: {
      "Client-id": clientId,
      ...redacted,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      let resData = {};
      resData.statusCode = response.statusCode;
      resData.body = [];
      response.on("data", (chunk) => resData.body.push(chunk));
      response.on("end", () => {
        resData.body = resData.body.join("");

        if (resData.statusCode !== 200) {
          reject(new Error(`${JSON.parse(data.body).message}`));
        } else {
          resolve(
            JSON.parse(resData.body)[0].data.community.channel.self
              .communityPoints.balance,
          );
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function checkSpace(ct0, auth_token, userId) {
  const headers = {
    authorization:
      "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
    cookie: `ct0=${ct0}; auth_token=${auth_token};`,
  };

  const options = {
    hostname: "twitter.com",
    port: 443,
    path: `/i/api/fleets/v1/avatar_content?user_ids=${userId}&only_spaces=true`,
    method: "GET",
    headers: headers,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      let resData = {};
      resData.statusCode = response.statusCode;
      resData.body = [];
      response.on("data", (chunk) => resData.body.push(chunk));
      response.on("end", () => {
        resData.body = resData.body.join("");
        try {
          resolve(
            JSON.parse(resData.body).users[userId].spaces.live_content
              .audiospace.broadcast_id,
          );
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.end();
  });
}

async function getSpaceMediaKey(id, ct0, auth_token) {
  const params = {
    variables: JSON.stringify({
      id: id,
      isMetatagsQuery: true,
      withSuperFollowsUserFields: true,
      withDownvotePerspective: false,
      withReactionsMetadata: false,
      withReactionsPerspective: false,
      withSuperFollowsTweetFields: true,
      withReplays: true,
    }),
    features: JSON.stringify({
      spaces_2022_h2_clipping: true,
      spaces_2022_h2_spaces_communities: true,
      responsive_web_twitter_blue_verified_badge_is_enabled: true,
      verified_phone_label_enabled: false,
      view_counts_public_visibility_enabled: true,
      longform_notetweets_consumption_enabled: false,
      tweetypie_unmention_optimization_enabled: true,
      responsive_web_uc_gql_enabled: true,
      vibe_api_enabled: true,
      responsive_web_edit_tweet_api_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      view_counts_everywhere_api_enabled: true,
      standardized_nudges_misinfo: true,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: true,
      interactive_text_enabled: true,
      responsive_web_text_conversations_enabled: false,
      responsive_web_enhance_cards_enabled: false,
    }),
  };

  const headers = {
    authorization:
      "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
    "x-csrf-token": ct0,
    cookie: `ct0=${ct0}; auth_token=${auth_token};`,
  };

  const options = {
    hostname: "api.twitter.com",
    port: 443,
    path:
      "/graphql/xjTKygiBMpX44KU8ywLohQ/AudioSpaceById?" +
      new URLSearchParams(params),
    method: "GET",
    headers: headers,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      let resData = {};
      resData.statusCode = response.statusCode;
      resData.body = [];
      response.on("data", (chunk) => resData.body.push(chunk));
      response.on("end", () => {
        resData.body = resData.body.join("");

        try {
          resolve(JSON.parse(resData.body).data.audioSpace.metadata.media_key);
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.end();
  });
}

async function getSpaceM3U8(id, ct0, auth_token) {
  const media_key = await getSpaceMediaKey(id, ct0, auth_token);
  const headers = {
    authorization:
      "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
    cookie: "auth_token=",
  };

  const options = {
    hostname: "twitter.com",
    port: 443,
    path: "/i/api/1.1/live_video_stream/status/" + media_key,
    method: "GET",
    headers: headers,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (response) => {
      let resData = {};
      resData.statusCode = response.statusCode;
      resData.body = [];
      response.on("data", (chunk) => resData.body.push(chunk));
      response.on("end", () => {
        resData.body = resData.body.join("");

        try {
          resolve(JSON.parse(resData.body).source.location);
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.end();
  });
}

module.exports = {
  getStream: getStream,
  getLastStreamDate: getLastStreamDate,
  getChannelPoint: getChannelPoint,
  checkSpace: checkSpace,
  getSpaceM3U8: getSpaceM3U8,
};
