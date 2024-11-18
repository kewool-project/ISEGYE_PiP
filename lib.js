const { BrowserWindow } = require("electron");
const https = require("https");

function getLiveByName(name) {
  const data = {
    bid: name,
    type: "live",
    player_type: "html5",
    stream_type: "common",
    quality: "master",
    mode: "landing",
    from_api: 0,
  };

  const options = {
    hostname: "live.sooplive.co.kr",
    port: 443,
    path: `/afreeca/player_live_api.php?bjid=${name}`,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
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
          reject(new Error(`${resData.statusCode}`));
        } else {
          resolve(JSON.parse(resData.body));
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.write(new URLSearchParams(data).toString());
    req.end();
  });
}

function getUserByName(name) {
  const options = {
    hostname: "st.sooplive.co.kr",
    port: 443,
    path: `/api/get_station_status.php?szBjId=${name}`,
    method: "GET",
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
          reject(new Error(`${resData.statusCode}`));
        } else {
          resolve(JSON.parse(resData.body));
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.end();
  });
}

async function getPlaylist(name, bno) {
  const aidData = {
    bid: name,
    type: "aid",
    player_type: "html5",
    stream_type: "common",
    quality: "master",
    mode: "landing",
    from_api: 0,
  };

  const aidOptions = {
    hostname: "live.sooplive.co.kr",
    port: 443,
    path: `/afreeca/player_live_api.php?bjid=${name}`,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };

  const aid = await new Promise((resolve, reject) => {
    const req = https.request(aidOptions, (response) => {
      let resData = {};
      resData.statusCode = response.statusCode;
      resData.body = [];
      response.on("data", (chunk) => resData.body.push(chunk));
      response.on("end", () => {
        resData.body = resData.body.join("");

        if (resData.statusCode !== 200) {
          reject(new Error(`${resData.statusCode}`));
        } else {
          resolve(JSON.parse(resData.body));
        }
      });
    });

    req.on("error", (error) => reject(error));
    req.write(new URLSearchParams(aidData).toString());
    req.end();
  });

  const viewUrlOptions = {
    hostname: "livestream-manager.sooplive.co.kr",
    port: 443,
    path: `/broad_stream_assign.html?return_type=gs_cdn_pc_web&use_cors=true&cors_origin_url=play.sooplive.co.kr&broad_key=${bno}-common-master-hls&time=3072.3733594524338`,
  };

  const viewUrl = await new Promise((resolve, reject) => {
    const req = https.request(viewUrlOptions, (response) => {
      let resData = {};
      resData.statusCode = response.statusCode;
      resData.body = [];
      response.on("data", (chunk) => resData.body.push(chunk));
      response.on("end", () => {
        resData.body = resData.body.join("");
        resolve(JSON.parse(resData.body).view_url);
      });
    });

    req.on("error", (error) => reject(error));
    req.end();
  });

  const options = {
    hostname: viewUrl.split("/")[2],
    port: 443,
    path: `/${viewUrl.split("/").slice(3).join("/")}?aid=${aid.CHANNEL.AID}`,
    headers: {
      Referer: "https://play.sooplive.co.kr/",
    },
  };

  return {
    hlsList: await new Promise((resolve, reject) => {
      const req = https
        .request(options, (response) => {
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
                  new Error(
                    `Afreecatv returned status code ${data.statusCode}`,
                  ),
                );
                break;
            }
          });
        })
        .on("error", (error) => reject(error));

      req.end();
    }),
    viewUrl: viewUrl.split("/").slice(0, -1).join("/"),
  };
}

function parsePlaylist(playlist) {
  const parsedPlaylist = [];
  const lines = playlist.split("\n");
  lines.shift();
  lines.pop();
  for (let i = 0; i < lines.length; i += 2) {
    if (!lines[i].includes("540")) continue;
    parsedPlaylist.push({
      quality: lines[i].split("NAME=")[1].split(",")[0],
      resolution: lines[i].split("RESOLUTION=")[1].split("\r")[0],
      url: lines[i + 1],
    });
  }
  return parsedPlaylist;
}

function getStream(name, bno) {
  return new Promise((resolve, reject) => {
    getPlaylist(name, bno)
      .then((playlist) =>
        resolve({
          playlist: parsePlaylist(playlist.hlsList),
          viewUrl: playlist.viewUrl,
        }),
      )
      .catch((error) => reject(error));
  });
}

function getLastStreamDate(userName) {
  const options = {
    hostname: "chapi.sooplive.co.kr",
    port: 443,
    path: `/api/${userName}/station`,
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
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
          reject(new Error(`${resData.statusCode}`));
        } else {
          resolve(JSON.parse(resData.body).station.broad_start);
        }
      });
    });

    req.on("error", (error) => reject(error));
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
  getLiveByName: getLiveByName,
  getUserByName: getUserByName,
  getStream: getStream,
  getLastStreamDate: getLastStreamDate,
  checkSpace: checkSpace,
  getSpaceM3U8: getSpaceM3U8,
};
