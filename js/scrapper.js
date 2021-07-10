const XHR_HEADER = {
  'User-Agent' : "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36"
}

var xhr = function(method, url, data={}, query={}, headers={}) {
  return new Promise((resolve, reject) => {
    var xhttp = new XMLHttpRequest({ mozSystem: true });
    var _url = new URL(url);
    for (var y in query) {
      _url.searchParams.set(y, query[y]);
    }
    url = _url.origin + _url.pathname + '?' + _url.searchParams.toString();
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4) {
        if (this.status >= 200 && this.status <= 299) {
          try {
            const response = JSON.parse(xhttp.response);
            resolve({ raw: xhttp, response: response});
          } catch (e) {
            resolve({ raw: xhttp, response: xhttp.responseText});
          }
        } else {
          try {
            const response = JSON.parse(xhttp.response);
            reject({ raw: xhttp, response: response});
          } catch (e) {
            reject({ raw: xhttp, response: xhttp.responseText});
          }
        }
      }
    };
    xhttp.open(method, url, true);
    for (var x in headers) {
      xhttp.setRequestHeader(x, headers[x]);
    }
    if (Object.keys(data).length > 0) {
      xhttp.send(JSON.stringify(data));
    } else {
      xhttp.send();
    }
  });
}

function parse_str(str) {
  return str.split('&').reduce(function(params, param) {
      var paramSplit = param.split('=').map(function(value) {
          return decodeURIComponent(value.replace('+', ' '));
      });
      params[paramSplit[0]] = paramSplit[1];
      return params;
  }, {});
}

function prepareData(toEval) {
  var data = {
    "name": "JavaScript",
    "title": "3x4zmjmpz",
    "version": "ES6",
    "mode": "javascript",
    "description": null,
    "extension": "js",
    "languageType": "programming",
    "active": true,
    "properties": {
      "language": "javascript",
      "docs": true,
      "tutorials": true,
      "cheatsheets": true,
      "files": [{
        "name": "HelloWorld.js",
        "content": toEval
      }]
    }
  }
  return data;
}

function evalSig(data, qs) {
  return xhr('POST', `https://onecompiler.com/api/code/exec`, data, {}, {
    'Content-Type': 'application/json',
    'User-Agent': XHR_HEADER['User-Agent']
  })
  .then((res) => {
    return Promise.resolve(qs['url'] + '&' + qs['sp'] + '=' + res.response.stdout);
  })
  .catch((err) => {
    return Promise.reject(err);
  });
}

function decryptSignatureV2(signatureCipher, player) {

  var qs = deparam(signatureCipher);
  var query = {player: player, sig: qs['s']};

  var id = btoa(query.player)

  if (CACHED_DECRYPTOR[id]) {
      var toEval = CACHED_DECRYPTOR[id]['parent'] + CACHED_DECRYPTOR[id]['child'] + `console.log(${CACHED_DECRYPTOR[id]['childName']}('${query['sig']}'))`;
      return evalSig(prepareData(toEval), qs)
  } else {
    return xhr('GET', query.player)
    .then(data => {
      var a1 = data.response.search(`{return this.audioTracks};`)
      var b1 = data.response.substring(a1, data.response.length);
      var c1 = b1.substring(0, b1.indexOf(`}};`));
      c1 = c1 + `}};`
      c1 = c1.replace(`{return this.audioTracks};`, "");
      var d1 = c1.substring(4, 6);

      var a2 = data.response.search(`,isManifestless:!0,`);
      var b2 = data.response.substring(a2, document.body.length);
      var c2 = b2.indexOf(`})};`);
      c2 = b2.substring(c2, b2.length);
      c2 = c2.replace(`})};`, "var ");
      c2 = c2.substring(0, c2.indexOf(`};`));
      c2 = c2 + `};`
      c2 = c2.replace(`\n`, "");
      var d2 = c2.substring(4, 6);

      CACHED_DECRYPTOR[id] = { parent: c1, parentName: d1, child: c2, childName: d2 }
      var toEval = CACHED_DECRYPTOR[id]['parent'] + CACHED_DECRYPTOR[id]['child'] + `console.log(${CACHED_DECRYPTOR[id]['childName']}('${query['sig']}'))`;
      return evalSig(prepareData(toEval), qs);
    })
    .catch(err => {
      return Promise.reject(err);
    });
  }

}

function decryptSignature(signatureCipher, player) {
  var qs = deparam(signatureCipher);
  var query = {player: player, sig: qs['s']};
  return xhr('GET', 'https://web-sms-kaios.herokuapp.com/decrypt', {}, query, XHR_HEADER)
  .then((res) => {
    if (res.response !== "Error") {
      return Promise.resolve(qs['url'] + '&' + qs['sp'] + '=' + res.response);
    } else {
      return Promise.reject(res.response);
    }
  })
  .catch((err) => {
    return Promise.reject(err);
  });
}

function fallback(id) {
  return xhr('GET', `https://www.youtube.com/watch?v=${id}`, {}, {}, XHR_HEADER)
  .then((res) => {
    const start = res.response.search('dashManifestUrl');
    if (start > -1) {
      const s = res.response.substring(start, res.response.length).replace('dashManifestUrl":"', '');
      return Promise.resolve(s.substring(0, s.indexOf('"')));
    } else {
      const start = res.response.search(`>var ytInitialPlayerResponse = `);
      if (start > -1) {
        const s = res.response.substring(start, res.response.length).replace(`>var ytInitialPlayerResponse = `, '');
        try {
          const pIdx = res.response.search(`<script src="/s/player/`);
          const pStr = res.response.substring(pIdx, res.response.length);
          const script = pStr.substring(0, pStr.indexOf(`</script>`)).replace(`<script src="`, '');
          const pUrl = `https://www.youtube.com` + script.substring(0, script.indexOf('"'));
          const ytInitialPlayerResponse = JSON.parse(s.substring(0, s.indexOf(`;var meta = document.createElement('meta');`)));
          if (ytInitialPlayerResponse.streamingData) {
            return Promise.resolve({
              adaptiveFormats: ytInitialPlayerResponse.streamingData.adaptiveFormats,
              player: pUrl
            });
          } else {
            return Promise.reject("VIDEO UNAVAILABLE");
          }
        } catch (e) {
          return Promise.reject(e);
        }
      }
      return Promise.reject('UNKNOWN ERROR FALLBACK');
    }
  })
  .then((result) => {
    if (typeof result == "string") {
      return xhr('GET', result, {}, {}, XHR_HEADER)
    } else if (typeof result == "object") {
      return Promise.resolve(result);
    }
  })
  .catch((e) => {
    return Promise.reject(e);
  })
}

function execute(id) {
  return xhr('GET', `https://www.youtube.com/get_video_info?video_id=${id}&html5=1`, {}, {}, XHR_HEADER)
  .then((res) => {
    try {
      var c = JSON.parse(parse_str(res.response).player_response);
      if (c) {
        return Promise.resolve(c);
      } else {
        return Promise.reject('No player_response');
      }
    } catch (e) {
      return Promise.reject('404');
    }
  })
  .then((player_response) => {
    if (player_response.streamingData && player_response.streamingData.dashManifestUrl) {
      return xhr('GET', player_response.streamingData.dashManifestUrl, {}, {}, XHR_HEADER)
    } else if (player_response.streamingData && player_response.streamingData.adaptiveFormats) {
      return fallback(id)
      .then((res) => {
        player_response.streamingData.player = res.player;
        player_response.streamingData.adaptiveFormatsFallback = res.adaptiveFormats;
        return Promise.resolve(player_response.streamingData);
      });
      // return Promise.resolve(player_response.streamingData);
      // return fallback(id);
    } else {
      return fallback(id);
    }
  })
  .then((result) => {
    return Promise.resolve(result);
  })
  .catch((e) => {
    return fallback(id);
    // return Promise.reject(e);
  })
}

function getVideoLinks(id) {
  return execute(id)
  .then((result) => {
    if (result.response) {
      var formats = [];
      const p = new X2JS()
      const AdaptationSet = p.xml2js(result.response).MPD.Period.AdaptationSet;
      for (var x in AdaptationSet) {
        if (typeof AdaptationSet[x].Representation == "object" && !AdaptationSet[x].Representation.length) {
          formats.push({
            id: id,
            mimeType: AdaptationSet[x]._mimeType,
            bitrate: AdaptationSet[x].Representation._id,
            url: AdaptationSet[x].Representation.BaseURL,
            width: AdaptationSet[x]._width || 0,
            height: AdaptationSet[x]._height || 0,
          });
        } else if (typeof AdaptationSet[x].Representation == "object" && AdaptationSet[x].Representation.length) {
          for (var y in AdaptationSet[x].Representation) {
            formats.push({
              id: id,
              mimeType: AdaptationSet[x]._mimeType,
              bitrate: AdaptationSet[x].Representation[y]._id,
              url: AdaptationSet[x].Representation[y].BaseURL,
              width: AdaptationSet[x].Representation[y]._width || 0,
              height: AdaptationSet[x].Representation[y]._height || 0,
            });
          }
        }
      }
      return Promise.resolve(formats);
    } else if (result.adaptiveFormats) {
      var formats = [];
      for (var x in result.adaptiveFormats) {
        formats.push({
          id: id,
          mimeType: result.adaptiveFormats[x].mimeType.split(';')[0],
          bitrate: result.adaptiveFormats[x].bitrate,
          signatureCipher: result.adaptiveFormats[x].signatureCipher,
          url: result.adaptiveFormats[x].url,
          player: result.player || null,
          width: result.adaptiveFormats[x].width || 0,
          height: result.adaptiveFormats[x].height || 0,
        });
      }
      return Promise.resolve(formats);
    } else {
      return Promise.reject("Unknown Error");
    }
  })
  .catch((err) => {
    return Promise.reject(err)
  })
}
