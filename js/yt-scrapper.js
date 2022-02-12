/**
 * Parse youtube search results from json sectionList array and add to json result object
 * @param {Array} contents - The array of sectionLists
 * @param {Object} json - The object being returned to caller
 */
function parseJsonFormat(contents, json) {
    contents.forEach(sectionList => {
        try {
            if (sectionList.hasOwnProperty("itemSectionRenderer")) {
                sectionList.itemSectionRenderer.contents.forEach(content => {
                    try {
                        if (content.hasOwnProperty("channelRenderer")) {
                            json.results.push(parseChannelRenderer(content.channelRenderer));
                        }
                        if (content.hasOwnProperty("videoRenderer")) {
                            json.results.push(parseVideoRenderer(content.videoRenderer));
                        }
                        if (content.hasOwnProperty("radioRenderer")) {
                            json.results.push(parseRadioRenderer(content.radioRenderer));
                        }
                        if (content.hasOwnProperty("playlistRenderer")) {
                            json.results.push(parsePlaylistRenderer(content.playlistRenderer));
                        }
                    }
                    catch(ex) {
                        console.error("Failed to parse renderer:", ex);
                        console.log(content);
                    }
                });
            }
            else if (sectionList.hasOwnProperty("richItemRenderer")) {
                try {
                    const content = sectionList.richItemRenderer.content;
                    if (content.hasOwnProperty("channelRenderer")) {
                        json.results.push(parseChannelRenderer(content.channelRenderer));
                    }
                    if (content.hasOwnProperty("videoRenderer")) {
                        json.results.push(parseVideoRenderer(content.videoRenderer));
                    }
                    if (content.hasOwnProperty("radioRenderer")) {
                        json.results.push(parseRadioRenderer(content.radioRenderer));
                    }
                    if (content.hasOwnProperty("playlistRenderer")) {
                        json.results.push(parsePlaylistRenderer(content.playlistRenderer));
                    }
                }
                catch(ex) {
                    console.error("Failed to parse renderer:", ex);
                    console.log(content);
                }
            }
            else if (sectionList.hasOwnProperty("continuationItemRenderer")) {
                json["nextPageToken"] = sectionList.continuationItemRenderer.continuationEndpoint.continuationCommand.token;
            }
        }
        catch (ex) {
            console.error("Failed to read contents for section list:", ex);
            console.log(sectionList);
        }
    });
}

/**
 * Parse a channelRenderer object from youtube search results
 * @param {object} renderer - The channel renderer
 * @returns object with data to return for this channel
 */
function parseChannelRenderer(renderer) {
    let channel = {
        "id": renderer.channelId,
        "title": renderer.title.simpleText,
        "url": `https://www.youtube.com${renderer.navigationEndpoint.commandMetadata.webCommandMetadata.url}`,
        "snippet": renderer.descriptionSnippet ? renderer.descriptionSnippet.runs.reduce(comb, "") : "",
        "thumbnail_src": renderer.thumbnail.thumbnails[renderer.thumbnail.thumbnails.length - 1].url,
        "video_count": renderer.videoCountText ? renderer.videoCountText.runs.reduce(comb, "") : "",
        "subscriber_count": renderer.subscriberCountText ? renderer.subscriberCountText.simpleText : "0 subscribers",
        "verified": renderer.ownerBadges &&
                    renderer.ownerBadges.some(badge => badge.metadataBadgeRenderer.style.indexOf("VERIFIED") > -1) || 
                    false
    };

    return { channel };
}

/**
 * Parse a playlistRenderer object from youtube search results
 * @param {object} renderer - The playlist renderer
 * @returns object with data to return for this playlist
 */
function parsePlaylistRenderer(renderer) {
    let thumbnails = renderer.thumbnailRenderer.playlistVideoThumbnailRenderer.thumbnail.thumbnails;
    let playlist = {
        "id": renderer.playlistId,
        "title": renderer.title.simpleText,
        "url": `https://www.youtube.com${renderer.navigationEndpoint.commandMetadata.webCommandMetadata.url}`,
        "thumbnail_src": thumbnails[thumbnails.length - 1].url,
        "video_count": renderer.videoCount
    };

    let uploader = {
        "username": renderer.shortBylineText.runs[0].text,
        "url": `https://www.youtube.com${renderer.shortBylineText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url}`
    };

    return { playlist: playlist, uploader: uploader };
}

/**
 * Parse a radioRenderer object from youtube search results
 * @param {object} renderer - The radio renderer
 * @returns object with data to return for this mix
 */
function parseRadioRenderer(renderer) {
    let radio = {
        "id": renderer.playlistId,
        "title": renderer.title.simpleText,
        "url": `https://www.youtube.com${renderer.navigationEndpoint.commandMetadata.webCommandMetadata.url}`,
        "thumbnail_src": renderer.thumbnail.thumbnails[renderer.thumbnail.thumbnails.length - 1].url,
        "video_count": renderer.videoCountText.runs.reduce(comb, "")
    };

    let uploader = {
        "username": renderer.shortBylineText ? renderer.shortBylineText.simpleText : "YouTube"
    };

    return { radio: radio, uploader: uploader };
}

/**
 * Parse a videoRenderer object from youtube search results
 * @param {object} renderer - The video renderer
 * @returns object with data to return for this video
 */
function parseVideoRenderer(renderer) {
    let video = {
        "id": renderer.videoId,
        "title": renderer.title.runs.reduce(comb, ""),
        "url": `https://www.youtube.com${renderer.navigationEndpoint.commandMetadata.webCommandMetadata.url}`,
        "duration": renderer.lengthText ? renderer.lengthText.simpleText : "Live",
        "snippet": renderer.descriptionSnippet ?
                   renderer.descriptionSnippet.runs.reduce((a, b) => a + (b.bold ? `<b>${b.text}</b>` : b.text), ""):
                   "",
        "upload_date": renderer.publishedTimeText ? renderer.publishedTimeText.simpleText : "Live",
        "thumbnail_src": renderer.thumbnail.thumbnails[renderer.thumbnail.thumbnails.length - 1].url,
        "views": renderer.viewCountText ?
            renderer.viewCountText.simpleText || renderer.viewCountText.runs.reduce(comb, "") :
            (renderer.publishedTimeText ? "0 views" : "0 watching")
    };

    let uploader = {
        "username": renderer.ownerText.runs[0].text,
        "url": `https://www.youtube.com${renderer.ownerText.runs[0].navigationEndpoint.commandMetadata.webCommandMetadata.url}`
    };
    uploader.verified = renderer.ownerBadges &&
        renderer.ownerBadges.some(badge => badge.metadataBadgeRenderer.style.indexOf("VERIFIED") > -1) || 
        false;

    return { video: video, uploader: uploader };
}

/**
 * Combine array containing objects in format { text: "string" } to a single string
 * For use with reduce function
 * @param {string} a - Previous value
 * @param {object} b - Current object
 * @returns Previous value concatenated with new object text
 */
function comb(a, b) {
    return a + b.text;
}

function searchVideo(query = '', key, pageToken) {
  var json = { results: [] };
  return new Promise((resolve, reject) => {
    if (key) {
      json["parser"] = "json_format.page_token";
      json["key"] = key;
      const form = {
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20201022.01.01",
          },
        },
        continuation: pageToken
      };
      xhr('POST', `https://www.youtube.com/youtubei/v1/search?app=desktop&key=${key}`, form, {}, XHR_HEADER)
      .then((data) => {
        parseJsonFormat(data.response.onResponseReceivedCommands[0].appendContinuationItemsAction.continuationItems, json);
        resolve(json);
      })
      .catch(e => {
        reject(e);
      })
    } else {
      var URL = `https://www.youtube.com/`;
      if (query.trim().length > 0) {
        URL = `https://www.youtube.com/results?app=desktop&q=${encodeURIComponent(query)}`;
      }
      xhr('GET', URL, {}, {}, XHR_HEADER)
      .then((data) => {
        json["parser"] = "json_format";
        json["key"] = data.response.match(/"innertubeApiKey":"([^"]*)/)[1];
        const start = data.response.search(`var ytInitialData = `);
        if (start > -1) {
          const s = data.response.substring(start, data.response.length).replace(`var ytInitialData = `, '');
          const objStr = s.substring(0, s.indexOf(`;</script>`));
          data = JSON.parse(objStr);
          json["estimatedResults"] = data.estimatedResults || "0";
          if (data.contents.twoColumnSearchResultsRenderer) {
            json["parser"] += ".object_var";
            sectionLists = data.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents;
            parseJsonFormat(sectionLists, json);
          } else if (data.contents.twoColumnBrowseResultsRenderer) {
            //json["parser"] += ".original";
            //sectionLists = data.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.richGridRenderer.contents;
            //parseJsonFormat(sectionLists, json);
          }
          resolve(json);
        }
      })
      .catch(e => {
        reject(e);
      })
    }
  })
}
