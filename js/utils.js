const MIME = {"audio/aac":"aac","audio/x-aac":"aac","audio/adpcm":"adp","application/vnd.audiograph":"aep","audio/x-aiff":"aif","audio/amr":"amr","audio/basic":"au","audio/x-caf":"caf","audio/vnd.dra":"dra","audio/vnd.dts":"dts","audio/vnd.dts.hd":"dtshd","audio/vnd.nuera.ecelp4800":"ecelp4800","audio/vnd.nuera.ecelp7470":"ecelp7470","audio/vnd.nuera.ecelp9600":"ecelp9600","audio/vnd.digital-winds":"eol","audio/x-flac":"flac","audio/vnd.lucent.voice":"lvp","audio/x-mpegurl":"m3u","audio/x-m4a":"m4a","audio/midi":"mid","audio/x-matroska":"mka","audio/mpeg":"mp3","audio/mp4":"mp4a","audio/mobile-xmf":"mxmf","audio/ogg":"opus","audio/vnd.ms-playready.media.pya":"pya","audio/x-realaudio":"ra","audio/x-pn-realaudio":"ram","audio/vnd.rip":"rip","audio/x-pn-realaudio-plugin":"rmp","audio/s3m":"s3m","application/vnd.yamaha.smaf-audio":"saf","audio/silk":"sil","audio/vnd.dece.audio":"uva","audio/x-wav":"wav","audio/x-ms-wax":"wax","audio/webm":"weba","audio/x-ms-wma":"wma","audio/xm":"xm"};

function convertTime(time) {
  if (isNaN(time)) {
    if (typeof time === 'string')
      return time.replace('00:', '');
    return '00:00';
  }
  var hours = "";
  var mins = Math.floor(time / 60);
  if (mins > 59) {
    var hr = Math.floor(mins / 60);
    mins = Math.floor(mins - Number(60 * hr));
    hours = hr;
  }
  if (hours != "") {
    if (hours < 10) {
      hours = "0" + String(hours) + ":";
    } else {
      hours = hours + ":";
    }
  }
  if (mins < 10) {
    mins = "0" + String(mins);
  }
  var secs = Math.floor(time % 60);
  if (secs < 10) {
    secs = "0" + String(secs);
  }
  return hours + mins + ":" + secs;
}

function readableFileSize(bytes, si = false, dp = 1) {
  if (typeof bytes !== 'number') {
    try {
      bytes = JSON.parse(bytes);
    } catch(e) {
      return false;
    }
  }
  const thresh = si ? 1000 : 1024;
  if (Math.abs(bytes) < thresh) {
    return bytes + ' Byte';
  }
  const units = si  ? ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = Math.pow(10, dp);
  do {
    bytes /= thresh;
    ++u;
  } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);
  return bytes.toFixed(dp) + '' + units[u];
}

function getURLParam(key, target) {
  var values = [];
  if (!target) target = location.href;

  key = key.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");

  var pattern = key + '=([^&#]+)';
  var o_reg = new RegExp(pattern,'ig');
  while (true){
    var matches = o_reg.exec(target);
    if (matches && matches[1]){
      values.push(matches[1]);
    } else {
      break;
    }
  }

  if (!values.length){
    return [];
  } else {
    return values.length == 1 ? [values[0]] : values;
  }
}

function pingInvidiousInstance(url) {
  const timeout = setTimeout(() => {
    throw("Timeout");
  }, 30000);
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const conn = navigator.mozTCPSocket.open(u.host, 443, { useSecureTransport: true });
    conn.onopen = () => {
      clearTimeout(timeout);
      conn.close();
      resolve(url);
    }
    conn.onerror = (err) => {
      console.error(err);
      clearTimeout(timeout);
      reject(err);
    }
  });
}

function checkDomainAvailability(list = [], result = [], callback = () => {}) {
  if (list.length === 0) {
    callback(result);return;
  }
  const u = list.pop();
  pingInvidiousInstance(`https://${u.uri}`)
  .then((url) => {
    result.push(u);
  })
  .catch(err => {
  })
  .finally(() => {
    checkDomainAvailability([...list], [...result], callback);
  });
}

function getInstance() {
  return new Promise((resolve, reject) => {
    xhr('GET', 'https://api.invidious.io/instances.json', {}, {}, {})
    .then(result => {
      let list = [];
      result.response.forEach((instance) => {
        if (instance[1].type && instance[1].type.indexOf('https') > -1) {
          list.push({ uri: instance[0], region: instance[1].region });
        }
      });
      resolve(list);
    })
    .catch(err => {
      throw(err);
    });
  });
}

function getAvailableInvidiousInstance() {
  return new Promise((resolve, reject) => {
    getInstance().
    then(list => {
      try {
        console.clear();
        checkDomainAvailability([...list], [], (result) => {
          resolve(result);
        });
      } catch (err) {
        throw(err);
      }
    })
    .catch(err => {
      throw(err);
    });
  });
}
