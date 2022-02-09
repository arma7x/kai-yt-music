localforage.setDriver(localforage.LOCALSTORAGE);

const CACHED_DECRYPTOR = {};
const DB_NAME = 'YT_MUSIC';
const DB_PLAYLIST = 'YT_PLAYLIST';
const DB_CACHED_URLS = 'YT_CACHED_URLS';
const DB_PLAYING = 'YT_PLAYING';
const DB_CONFIGURATION = 'YT_CONFIGURATION';
const DEFAULT_VOLUME = 0.02;

const EQL_PRESENT={Classical:{hz60:33,hz170:33,hz310:33,hz600:33,hz1000:33,hz3000:33,hz6000:20,hz12000:20,hz14000:20,hz16000:16,preamp:33},Club:{hz60:33,hz170:33,hz310:38,hz600:42,hz1000:42,hz3000:42,hz6000:38,hz12000:33,hz14000:33,hz16000:33,preamp:33},Dance:{hz60:48,hz170:44,hz310:36,hz600:32,hz1000:32,hz3000:22,hz6000:20,hz12000:20,hz14000:32,hz16000:32,preamp:33},"Laptop speakers/headphones":{hz60:40,hz170:50,hz310:41,hz600:26,hz1000:28,hz3000:35,hz6000:40,hz12000:48,hz14000:53,hz16000:56,preamp:33},"Large hall":{hz60:49,hz170:49,hz310:42,hz600:42,hz1000:33,hz3000:24,hz6000:24,hz12000:24,hz14000:33,hz16000:33,preamp:33},Party:{hz60:44,hz170:44,hz310:33,hz600:33,hz1000:33,hz3000:33,hz6000:33,hz12000:33,hz14000:44,hz16000:44,preamp:33},Pop:{hz60:29,hz170:40,hz310:44,hz600:45,hz1000:41,hz3000:30,hz6000:28,hz12000:28,hz14000:29,hz16000:29,preamp:33},Reggae:{hz60:33,hz170:33,hz310:31,hz600:22,hz1000:33,hz3000:43,hz6000:43,hz12000:33,hz14000:33,hz16000:33,preamp:33},Rock:{hz60:45,hz170:40,hz310:23,hz600:19,hz1000:26,hz3000:39,hz6000:47,hz12000:50,hz14000:50,hz16000:50,preamp:33},Soft:{hz60:40,hz170:35,hz310:30,hz600:28,hz1000:30,hz3000:39,hz6000:46,hz12000:48,hz14000:50,hz16000:52,preamp:33},Ska:{hz60:28,hz170:24,hz310:25,hz600:31,hz1000:39,hz3000:42,hz6000:47,hz12000:48,hz14000:50,hz16000:48,preamp:33},"Full Bass":{hz60:48,hz170:48,hz310:48,hz600:42,hz1000:35,hz3000:25,hz6000:18,hz12000:15,hz14000:14,hz16000:14,preamp:33},"Soft Rock":{hz60:39,hz170:39,hz310:36,hz600:31,hz1000:25,hz3000:23,hz6000:26,hz12000:31,hz14000:37,hz16000:47,preamp:33},"Full Treble":{hz60:16,hz170:16,hz310:16,hz600:25,hz1000:37,hz3000:50,hz6000:58,hz12000:58,hz14000:58,hz16000:60,preamp:33},"Full Bass & Treble":{hz60:44,hz170:42,hz310:33,hz600:20,hz1000:24,hz3000:35,hz6000:46,hz12000:50,hz14000:52,hz16000:52,preamp:33},Live:{hz60:24,hz170:33,hz310:39,hz600:41,hz1000:42,hz3000:42,hz6000:39,hz12000:37,hz14000:37,hz16000:36,preamp:33},Techno:{hz60:45,hz170:42,hz310:33,hz600:23,hz1000:24,hz3000:33,hz6000:45,hz12000:48,hz14000:48,hz16000:47,preamp:33}};

const RANGE={"0":33,"1":35,"2":38,"3":40,"4":43,"5":46,"6":48,"7":51,"8":53,"9":56,"10":58,"11":61,"12":64,"-12":2,"-11":5,"-10":7,"-9":10,"-8":12,"-7":15,"-6":17,"-5":20,"-4":23,"-3":25,"-2":28,"-1":30};

var EQUALIZER = {preamp:0,hz60:0,hz170:0,hz310:0,hz600:0,hz1000:0,hz3000:0,hz6000:0,hz12000:0,hz14000:0,hz16000:0};

const SDCARD = navigator.getDeviceStorage('sdcard');

function saveBlobToStorage(blob, name, cb = () => {}) {
  var mime = blob.type.split('/')[1];
  var path = 'ytm';
  if (SDCARD.storageName !== '') {
    path = `/${SDCARD.storageName}/ytm`;
  }
  path = `${path}/${new Date().getTime().toString()}_${name}.${mime}`;
  const addFile = SDCARD.addNamed(blob, path);
  addFile.onsuccess = (evt) => {
    cb(path);
  }
  addFile.onerror = (err) => {
    console.log(err);
    cb(false);
  }
  console.log(path);
}

var LFT_DBL_CLICK_TH = 0;
var LFT_DBL_CLICK_TIMER = undefined;
var RGT_DBL_CLICK_TH = 0;
var RGT_DBL_CLICK_TIMER = undefined;

if (navigator.mozAudioChannelManager) {
  navigator.mozAudioChannelManager.volumeControlChannel = 'content';
}

function convertTime(time) {
  if (isNaN(time)) {
    return '00:00';
  }
  var mins = Math.floor(time / 60);
  if (mins < 10) {
    mins = '0' + String(mins);
  }
  var secs = Math.floor(time % 60);
  if (secs < 10) {
    secs = '0' + String(secs);
  }
  return mins + ':' + secs;
}

function toggleVolume(MINI_PLAYER, $router) {
  if (navigator.mozAudioChannelManager) {
    navigator.volumeManager.requestShow();
    $router.setSoftKeyRightText('');
  } else {
    $router.setSoftKeyRightText((MINI_PLAYER.volume * 100).toFixed(0) + '%');
  }
}

function volumeUp(PLYR, $router, cb = () => {}) {
  if (navigator.mozAudioChannelManager) {
    navigator.volumeManager.requestUp();
  } else {
    if (PLYR.volume < 1) {
      PLYR.volume = parseFloat((PLYR.volume + DEFAULT_VOLUME).toFixed(2));
      cb(PLYR, $router);
      $router.showToast('Volume ' + (PLYR.volume * 100).toFixed(0).toString() + '%');
    }
  }
}

function volumeDown(PLYR, $router, cb = () => {}) {
  if (navigator.mozAudioChannelManager) {
    navigator.volumeManager.requestDown();
  } else {
    if (PLYR.volume > 0) {
      PLYR.volume = parseFloat((PLYR.volume - DEFAULT_VOLUME).toFixed(2));
      cb(PLYR, $router);
      $router.showToast('Volume ' + (PLYR.volume * 100).toFixed(0).toString() + '%');
    }
  }
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

function cacheURL(obj, url) {
  var params = getURLParam('expire', url);
  if (params[0]) {
    // console.log(url);
    localforage.getItem(DB_CACHED_URLS)
    .then((cached) => {
      if (cached == null) {
        cached = {};
      }
      if (cached[obj.id] == null) {
        cached[obj.id] = {};
      }
      cached[obj.id][obj.br] = {
        url: url,
        expire: parseInt(params[0]) * 1000
      }
      localforage.setItem(DB_CACHED_URLS, cached);
    });
  }
}

function getCachedURL(id, br) {
  return new Promise((resolve, reject) => {
    localforage.getItem(DB_CACHED_URLS)
    .then((cached) => {
      if (cached == null) {
        cached = {};
      }
      if (cached[id] == null) {
        return reject("ID not exist");
      }
      if (cached[id][br] == null) {
        return reject("Bitrate not exist");
      }
      const now = new Date();
      const expire = new Date(cached[id][br]['expire']);
      if (now < expire) {
        return resolve(cached[id][br]['url']);
      }
      return reject("Expired link");
    });
  });
}

window.addEventListener("load", function() {

  const dummy = new Kai({
    name: '_dummy_',
    data: {
      title: '_dummy_'
    },
    verticalNavClass: '.dummyNav',
    templateUrl: document.location.origin + '/templates/dummy.html',
    mounted: function() {},
    unmounted: function() {},
    methods: {},
    softKeyText: { left: 'L2', center: 'C2', right: 'R2' },
    softKeyListener: {
      left: function() {},
      center: function() {},
      right: function() {}
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
      }
    }
  });

  var TRACK_NAME = '';
  var TRACKLIST = [];
  var _TRACKLIST = [];

  var MAIN_PLAYER = document.createElement("audio");
  MAIN_PLAYER.volume = 1;

  function initEqualizer() {
    const CONTEXT = new AudioContext('content');

    window['staticSource'] = CONTEXT.createGain();
    window['balance'] = new StereoBalanceNode(CONTEXT);
    window['preamp'] = CONTEXT.createGain();
    var gainNode = CONTEXT.createGain();

    const SOURCE = CONTEXT.createMediaElementSource(MAIN_PLAYER);

    SOURCE.connect(window['staticSource']);
    window['staticSource'].connect(window['preamp']);

    const amps = [
      { type: 'lowshelf', fValue: 60, gValue: 0, head: 'preamp' },
      { type: 'peaking', fValue: 170, gValue: 0 },
      { type: 'peaking', fValue: 310, gValue: 0 },
      { type: 'peaking', fValue: 600, gValue: 0 },
      { type: 'peaking', fValue: 1000, gValue: 0 },
      { type: 'peaking', fValue: 3000, gValue: 0 },
      { type: 'peaking', fValue: 6000, gValue: 0 },
      { type: 'peaking', fValue: 12000, gValue: 0 },
      { type: 'peaking', fValue: 14000, gValue: 0 },
      { type: 'highshelf', fValue: 16000, gValue: 0 }
    ];

    amps.forEach((amp, idx) => {
      const name = `hz${amp.fValue}`;
      window[name] = CONTEXT.createBiquadFilter();
      window[name].type = amp.type;
      window[name].frequency.value = amp.fValue;
      window[name].gain.value = amp.gValue;
      if (idx === 0) {
        window['preamp'].connect(window[name]);
      } else {
        const head = `hz${amps[idx - 1].fValue}`;
        window[head].connect(window[name]);
      }
    });

    window['hz16000'].connect(balance);
    window['balance'].connect(gainNode);
    gainNode.connect(CONTEXT.destination);
  }

  function enableEq() {
    initEqualizer();
    window['staticSource'].disconnect();
    window['staticSource'].connect(window['preamp']);
    localforage.setItem('EQUALIZER_STATUS', true);
    loadCurrentEq();
  }

  function disableEq() {
    if (window['staticSource'])
      window['staticSource'].disconnect();
    if (window['staticSource'])
      window['staticSource'].connect(window['balance']);
    localforage.setItem('EQUALIZER_STATUS', false);
    MAIN_PLAYER.pause();
    const TEMP = document.createElement("audio");
    TEMP.volume = 1;
    //TEMP.onratechange = MAIN_PLAYER.onratechange;
    TEMP.ontimeupdate = MAIN_PLAYER.ontimeupdate;
    TEMP.onpause = MAIN_PLAYER.onpause;
    TEMP.onplay = MAIN_PLAYER.onplay;
    TEMP.onloadeddata = MAIN_PLAYER.onloadeddata;
    TEMP.onerror = MAIN_PLAYER.onerror;
    TEMP.onended = MAIN_PLAYER.onended;
    TEMP.currentTime = MAIN_PLAYER.currentTime;
    const move = state.getState('TRACKLIST_IDX');
    if (TRACKLIST[move]) {
      state.setState('TRACKLIST_IDX', move);
      playVideoByID(move);
    }
    MAIN_PLAYER = TEMP;
  }

  function toggleEqStatus() {
    localforage.getItem('EQUALIZER_STATUS')
    .then((status) => {
      console.log('EQUALIZER_STATUS', status);
      if (status == null || status == true) {
        enableEq();
      } else {
        disableEq();
      }
    });
  }

  function changeEqStatus() {
    localforage.getItem('EQUALIZER_STATUS')
    .then((status) => {
      if (status == null || status == true) {
        status = false;
      } else {
        status = true;
      }
      localforage.setItem('EQUALIZER_STATUS', status)
      .then(() => {
        toggleEqStatus();
        if (router) {
          if (status) {
            router.showToast('Equalizer On');
          } else {
            router.showToast('Equalizer Off');
          }
        }
      });
    });
  }
  window['toggleEqStatus'] = changeEqStatus;

  const toPercent = (min, max, value) => {
    return (value - min) / (max - min);
  }

  const percentToRange = (percent, min, max) => {
    return min + Math.round(percent * (max - min));
  }

  const percentToIndex = (percent, length) => {
    return percentToRange(percent, 0, length - 1);
  }

  const rebound = (oldMin, oldMax, newMin, newMax) => {
    return (oldValue) => {
      return percentToRange(toPercent(oldMin, oldMax, oldValue), newMin, newMax);
    }
  }

  const normalizeEqBand = rebound(1, 64, 0, 100);

  const setEqualizerBand = (filter, value) => {
    var db = 0
    if (filter === 'preamp') {
      db = (value / 100) * 24 - 12;
      window[filter]["gain"].value = Math.pow(10, db / 20);
    } else {
      db = (value / 100) * 24 - 12;
      window[filter]["gain"].value = db;
    }
    return db;
  }

  function loadEq(name) {
    var eql = EQL_PRESENT[name];
    if (eql) {
      for (var v in eql) {
        const i = setEqualizerBand(v, normalizeEqBand(eql[v]));
        EQUALIZER[v] = parseInt(i);
      }
      localforage.setItem('__EQUALIZER__', EQUALIZER);
      localforage.setItem('__CURRENT_EQUALIZER__', name);
    }
  }

  function toggleEq(filter, value) {
    setEqualizerBand(filter, normalizeEqBand(RANGE[value]));
    EQUALIZER[filter] = parseInt(value);
    localforage.setItem('__EQUALIZER__', EQUALIZER);
    localforage.removeItem('__CURRENT_EQUALIZER__');
  }

  function loadCurrentEq() {
    localforage.getItem('__CURRENT_EQUALIZER__')
    .then((cur) => {
      if (cur) {
        loadEq(cur);
      } else {
        localforage.getItem('__EQUALIZER__')
        .then((eql) => {
          if (!eql)
            eql = EQUALIZER;
          EQUALIZER = eql;
          for (var v in eql) {
            toggleEq(v, eql[v]);
          }
        });
      }
    });
  }

  toggleEqStatus();
  loadCurrentEq();

  const state = new KaiState({
    CONFIGURATION: {},
    DATABASE: {},
    PLAYLIST: {},
    TRACKLIST_IDX: 0,
    TRACK_DURATION: 0,
    REPEAT: -1,
    SHUFFLE: false,
  });

  MAIN_PLAYER.onerror = (evt) => {
    console.log('MAIN_PLAYER', evt);
  };

  MAIN_PLAYER.onended = (e) => {
    const REPEAT = state.getState('REPEAT');
    if (REPEAT === 1) {
      MAIN_PLAYER.play();
    } else if (REPEAT === 0) {
      const next = state.getState('TRACKLIST_IDX') + 1;
      if (TRACKLIST[next]) {
        state.setState('TRACKLIST_IDX', next);
        playVideoByID(next);
      } else {
        state.setState('TRACKLIST_IDX', 0);
        playVideoByID(0);
      }
    } else if (REPEAT === -1 && (state.getState('TRACKLIST_IDX') !== (TRACKLIST.length - 1))) {
      const next = state.getState('TRACKLIST_IDX') + 1;
      if (TRACKLIST[next]) {
        state.setState('TRACKLIST_IDX', next);
        playVideoByID(next);
      }
    }
  }

  MAIN_PLAYER.onloadedmetadata = (evt) => {
    state.setState('TRACK_DURATION', evt.target.duration);
  }

  function toggleShuffle($router) {
    const SHUFFLE = !state.getState('SHUFFLE');
    const SHUFFLE_BTN = {};
    if (SHUFFLE) {
      SHUFFLE_BTN.classList = '';
      if ($router)
        $router.showToast('Shuffle On');
    } else {
      SHUFFLE_BTN.classList = 'inactive';
      if ($router)
        $router.showToast('Shuffle Off');
    }
    state.setState('SHUFFLE', SHUFFLE);
    localforage.setItem('SHUFFLE', SHUFFLE);
    shuffling();
    return SHUFFLE_BTN;
  }

  function shuffling() {
    if (TRACKLIST.length <= 1)
      return
    const SHUFFLE = state.getState('SHUFFLE');
    if (SHUFFLE) {
      const v_id = TRACKLIST[state.getState('TRACKLIST_IDX')].id;
      for (var i = 0; i < TRACKLIST.length - 1; i++) {
        var j = i + Math.floor(Math.random() * (TRACKLIST.length - i));
        var temp = TRACKLIST[j];
        TRACKLIST[j] = TRACKLIST[i];
        TRACKLIST[i] = temp;
      }
      const idx = TRACKLIST.findIndex((t) => {
        return t.id === v_id;
      });
      const t = TRACKLIST[0];
      const b =  TRACKLIST[idx];
      TRACKLIST[idx] = t;
      TRACKLIST[0] = b;
      state.setState('TRACKLIST_IDX', 0);
    } else {
      const v_id = TRACKLIST[state.getState('TRACKLIST_IDX')].id;
      TRACKLIST = JSON.parse(JSON.stringify(_TRACKLIST));
      const idx = TRACKLIST.findIndex((t) => {
        return t.id === v_id;
      });
      state.setState('TRACKLIST_IDX', idx);
    }
  }

  function toggleRepeat($router) {
    var REPEAT = state.getState('REPEAT');
    REPEAT++;
    const REPEAT_BTN = {};
    if (REPEAT === 0) {
      REPEAT_BTN.src = '/icons/img/baseline_repeat_white_18dp.png';
      REPEAT_BTN.classList = '';
      if ($router)
        $router.showToast('Repeat On');
    } else if (REPEAT === 1) {
      REPEAT_BTN.src = '/icons/img/baseline_repeat_one_white_18dp.png';
      REPEAT_BTN.classList = '';
      if ($router)
        $router.showToast('Repeat One');
    } else {
      REPEAT = -1;
      REPEAT_BTN.src = '/icons/img/baseline_repeat_white_18dp.png';
      REPEAT_BTN.classList = 'inactive';
      if ($router)
        $router.showToast('Repeat Off');
    }
    state.setState('REPEAT', REPEAT);
    localforage.setItem('REPEAT', REPEAT);
    return REPEAT_BTN;
  }

  localforage.getItem(DB_CONFIGURATION)
  .then((CONFIGURATION) => {
    if (CONFIGURATION == null) {
      CONFIGURATION = {
        mimeType: 'audio', // audio, audio/webm, audio/mp4
      };
    }
    if (CONFIGURATION['mimeType'] == null) {
      CONFIGURATION['mimeType'] = 'audio';
    }
    localforage.setItem(DB_CONFIGURATION, CONFIGURATION)
    state.setState('CONFIGURATION', CONFIGURATION);
  });

  localforage.getItem(DB_NAME)
  .then((DATABASE) => {
    if (DATABASE == null) {
      DATABASE = {};
    }
    state.setState('DATABASE', DATABASE);
  });

  localforage.getItem(DB_PLAYLIST)
  .then((PLAYLIST) => {
    if (PLAYLIST == null) {
      PLAYLIST = {};
    }
    state.setState('PLAYLIST', PLAYLIST);
  });

  localforage.getItem('SHUFFLE')
  .then((SHUFFLE) => {
    if (SHUFFLE == null)
      SHUFFLE = false;
    state.setState('SHUFFLE', SHUFFLE);
    localforage.setItem('SHUFFLE', SHUFFLE);
    localforage.getItem(DB_PLAYING)
    .then((playlist_id) => {
      if (playlist_id == null) {
        playDefaultCollection();
      } else {
        playPlaylistCollection(playlist_id);
      }
    });
  });

  function playDefaultCollection() {
    TRACKLIST = [];
    _TRACKLIST = [];
    localforage.removeItem(DB_PLAYING);
    state.setState('TRACKLIST_IDX', 0);
    TRACK_NAME = 'YT MUSIC';
    localforage.getItem(DB_NAME)
    .then((tracks) => {
      for (var y in tracks) {
        TRACKLIST.push(tracks[y]);
        _TRACKLIST.push(tracks[y]);
      }
      shuffling();
      playVideoByID(state.getState('TRACKLIST_IDX'));
    });
  }

  function playPlaylistCollection(id) {
    localforage.getItem(DB_PLAYLIST)
    .then((PLAYLIST) => {
      if (PLAYLIST == null) {
        PLAYLIST = {};
      }
      if (PLAYLIST[id]) {
        if (PLAYLIST[id].collections.length === 0) {
          return Promise.reject('Empty Playlist');
        }
        return Promise.resolve(PLAYLIST[id]);
      }
      playDefaultCollection();
      return Promise.reject('Playlist not exist');
    })
    .then((PLYLST) => {
      localforage.getItem(DB_NAME)
      .then((DATABASE) => {
        const collections = []
        if (DATABASE == null) {
          router.showToast('Empty Database');
        } else {
          PLYLST.collections.forEach((c) => {
            if (DATABASE[c]) {
              collections.push(DATABASE[c]);
            }
          });
          state.setState('TRACKLIST_IDX', 0);
          TRACK_NAME = PLYLST.name;
          TRACKLIST = collections;
          _TRACKLIST = JSON.parse(JSON.stringify(collections));
          shuffling();
          playVideoByID(state.getState('TRACKLIST_IDX'));
          router.showToast(`PLAYING ${TRACK_NAME}`);
          localforage.setItem(DB_PLAYING, PLYLST.id);
        }
      });
    })
    .catch((e) => {
      router.showToast(e.toString());
    });
  }

  function getAudioStreamURL(id) {
    return getVideoLinks(id)
    .then((links) => {
      if (router && router.loading) {
        router.hideLoading();
      }
      var obj = null;
      var quality = 0;
      const MIME = state.getState('CONFIGURATION')['mimeType'] || 'audio';
      links.forEach((link) => {
        if (link.mimeType.indexOf(MIME) > -1) {
          var br = parseInt(link.bitrate);
          if (br > 999) {
            br = Math.round(br/1000);
          }
          link.br = br;
          if (link.br >= quality) {
            obj = link;
            quality = link.br;
          }
        }
      });
      return Promise.resolve(obj);
    })
    .then((obj) => {
      if (obj.url != null) {
        return Promise.resolve(obj.url);
      } else {
        return getCachedURL(obj.id, obj.br)
        .then((_url) => {
          return Promise.resolve(_url);
        })
        .catch((_err) => {
          return decryptSignatureV2(obj.signatureCipher, obj.player)
          .then((url) => {
            return Promise.resolve(url);
          })
          .catch((err) => {
            return Promise.reject(err);
          })
        });
      }
    })
    .catch((e) => {
      return Promise.reject(e);
    });
  }

  function playVideoByID(idx) {
    if (TRACKLIST[idx] == null) {
      return
    }

    function _fallback() {
      // attempt download
      getAudioStreamURL(TRACKLIST[idx].id)
      .then((url) => {
        // router.hideLoading();
        router.showLoading();
        const down = new XMLHttpRequest({ mozSystem: true });
        down.open('GET', url, true);
        down.responseType = 'blob';
        down.onload = (evt) => {
          saveBlobToStorage(evt.currentTarget.response, `${TRACKLIST[idx].id}_${TRACKLIST[idx]._title || TRACKLIST[idx].title}`, (localPath) => {
            if (localPath === false) {
              router.showToast("Error SAVING");
            } else {
              TRACKLIST[idx].local_path = localPath;
              playVideoByID(idx);
              localforage.getItem(DB_NAME)
              .then((DATABASE) => {
                if (DATABASE == null) {
                  DATABASE = {};
                }
                DATABASE[TRACKLIST[idx].id] = TRACKLIST[idx];
                localforage.setItem(DB_NAME, DATABASE)
                .then(() => {
                  router.showToast('Saved');
                  return localforage.getItem(DB_NAME);
                })
                .then((UPDATED_DATABASE) => {
                  state.setState('DATABASE', UPDATED_DATABASE);
                })
                .catch((err) => {
                  console.log(err);
                  router.showToast(err.toString());
                });
              })
            }
            router.hideLoading();
          });
        }
        down.onprogress = (evt) => {
          if (evt.lengthComputable) {
            var percentComplete = evt.loaded / evt.total * 100;
            router.showToast(`${percentComplete.toFixed(2)}%`);
          }
        }
        down.onerror = (err) => {
          router.hideLoading();
          router.showToast("Error DOWNLOADING");
        }
        down.send();
      })
      .catch((e) => {
        router.hideLoading();
        router.showToast("Error GET");
      });
    }

    if (TRACKLIST[idx].local_path) {
      var request = SDCARD.get(TRACKLIST[idx].local_path);
      request.onsuccess = (file) => {
        MAIN_PLAYER.mozAudioChannelType = 'content';
        MAIN_PLAYER.src = URL.createObjectURL(file.target.result);
        MAIN_PLAYER.play();
      }
      request.onerror = ( error) => {
        _fallback();
        console.warn("Unable to get the file: " + error.toString());
      }
    } else {
      _fallback();
    }
  }

  function playMainAudio(obj) {
    if (obj.url != null) {
      // console.log(obj.url);
      MAIN_PLAYER.mozAudioChannelType = 'content';
      MAIN_PLAYER.src = obj.url;
      MAIN_PLAYER.play();
    } else {
      getCachedURL(obj.id, obj.br)
      .then((_url) => {
        // console.log("From Cached" ,_url);
        MAIN_PLAYER.mozAudioChannelType = 'content';
        MAIN_PLAYER.src = _url;
        MAIN_PLAYER.play();
      })
      .catch((_err) => {
        // console.log(_err);
        if (router && router.loading) {
          router.showLoading();
        }
        decryptSignatureV2(obj.signatureCipher, obj.player)
        .then((url) => {
          cacheURL(obj, url);
          // console.log("From Server" ,url);
          MAIN_PLAYER.mozAudioChannelType = 'content';
          MAIN_PLAYER.src = url;
          MAIN_PLAYER.play();
        })
        .catch((err) => {
          MAIN_PLAYER.pause();
          console.log(err);
        })
        .finally(() => {
          if (router && router.loading) {
            router.hideLoading();
          }
        })
      });
    }
  }

  function playMiniAudio(_this, obj, debug = false) {
    if (debug) {
      //debug start
        _this.$router.showLoading();
      decryptSignatureV2(obj.signatureCipher, obj.player)
      .then((url) => {
        cacheURL(obj, url);
        console.log("From Server" ,url);
        miniPlayer(_this.$router, url, _this.methods.renderSoftKeyLCR);
      })
      .catch((err) => {
        console.log(err);
      })
      .finally(() => {
        _this.$router.hideLoading();
      });
      return
      //debug end
    }
    if (obj.url != null) {
      // console.log(obj.url);
      miniPlayer(_this.$router, obj.url, _this.methods.renderSoftKeyLCR);
    } else {
      _this.$router.showLoading();
      getCachedURL(obj.id, obj.br)
      .then((_url) => {
        _this.$router.hideLoading();
        // console.log("From Cached" ,_url);
        miniPlayer(_this.$router, _url, _this.methods.renderSoftKeyLCR);
      })
      .catch((_err) => {
        console.log(_err);
        decryptSignatureV2(obj.signatureCipher, obj.player)
        .then((url) => {
          cacheURL(obj, url);
          // console.log("From Server" ,url);
          miniPlayer(_this.$router, url, _this.methods.renderSoftKeyLCR);
        })
        .catch((err) => {
          console.log(err);
        })
        .finally(() => {
          _this.$router.hideLoading();
        });
      });
    }
  }

  const equalizer_panel = new Kai({
    name: '_equalizer_panel_',
    data: {
      title: '_equalizer_panel_',
      filters: []
    },
    verticalNavClass: '.equalizerPanelNav',
    templateUrl: document.location.origin + '/templates/equalizer_panel.html',
    mounted: function() {
      this.$router.setHeaderTitle('Equalizer Panel');
      const filters = []
      for (var x in EQUALIZER) {
        filters.push({ name: x, value: EQUALIZER[x] });
      }
      this.setData({ filters: filters });
    },
    unmounted: function() {},
    methods: {},
    softKeyText: { left: 'Reset', center: '', right: '' },
    softKeyListener: {
      left: function() {
        for (var i=0;i<11;i++) {
          this.data.filters[i].value = 0;
          toggleEq(this.data.filters[i].name, this.data.filters[i].value);
        }
        this.render();
      },
      center: function() {},
      right: function() {}
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
      },
      arrowLeft: function() {
        const cur = this.data.filters[this.verticalNavIndex];
        if (!cur ||  cur.value === -12)
          return
        this.data.filters[this.verticalNavIndex].value = cur.value - 1
        this.render();
        toggleEq(cur.name, this.data.filters[this.verticalNavIndex].value);
      },
      arrowRight: function() {
        const cur = this.data.filters[this.verticalNavIndex];
        if (!cur ||  cur.value === 12)
          return
        this.data.filters[this.verticalNavIndex].value = cur.value + 1
        this.render();
        toggleEq(cur.name, this.data.filters[this.verticalNavIndex].value);
      }
    }
  });

  const miniPlayer = function($router, url, cb = () => {}) {

    const MINI_PLAYER = document.createElement("audio");
    MINI_PLAYER.volume = 1;
    MINI_PLAYER.mozAudioChannelType = 'content';

    var PLAY_BTN, DURATION_SLIDER, CURRENT_TIME, DURATION;
    $router.showBottomSheet(
      new Kai({
        name: 'miniPlayer',
        data: {
          title: 'miniPlayer',
        },
        templateUrl: document.location.origin + '/templates/miniPlayer.html',
        softKeyText: { left: 'Exit', center: '', right: '' },
        softKeyListener: {
          left: function() {
            $router.hideBottomSheet();
          },
          center: function() {
            if (MINI_PLAYER.duration > 0 && !MINI_PLAYER.paused) {
              MINI_PLAYER.pause();
            } else {
              MINI_PLAYER.play();
            }
          },
          right: function() {}
        },
        mounted: function() {
          DURATION_SLIDER = document.getElementById('duration_slider');
          CURRENT_TIME = document.getElementById('current_time');
          DURATION = document.getElementById('duration');
          PLAY_BTN = document.getElementById('play_btn');
          MINI_PLAYER.addEventListener('loadedmetadata', this.methods.onloadedmetadata);
          MINI_PLAYER.addEventListener('timeupdate', this.methods.ontimeupdate);
          MINI_PLAYER.addEventListener('pause', this.methods.onpause);
          MINI_PLAYER.addEventListener('play', this.methods.onplay);
          MINI_PLAYER.addEventListener('seeking', this.methods.onseeking);
          MINI_PLAYER.addEventListener('seeked', this.methods.onseeked);
          MINI_PLAYER.addEventListener('ended', this.methods.onended);
          MINI_PLAYER.addEventListener('error', this.methods.onerror);
          console.log('miniPlayer:', url);
          if (!navigator.mozAudioChannelManager) {
            $router.setSoftKeyRightText((MINI_PLAYER.volume * 100).toFixed(0) + '%');
          }
          MAIN_PLAYER.pause();
          MINI_PLAYER.src = url;
          MINI_PLAYER.play();
        },
        unmounted: function() {
          $router.hideLoading();
          MINI_PLAYER.pause();
          MINI_PLAYER.removeEventListener('loadedmetadata', this.methods.onloadedmetadata);
          MINI_PLAYER.removeEventListener('timeupdate', this.methods.ontimeupdate);
          MINI_PLAYER.removeEventListener('pause', this.methods.onpause);
          MINI_PLAYER.removeEventListener('play', this.methods.onplay);
          MINI_PLAYER.removeEventListener('seeking', this.methods.onseeking);
          MINI_PLAYER.removeEventListener('seeked', this.methods.onseeked);
          MINI_PLAYER.removeEventListener('ended', this.methods.onended);
          MINI_PLAYER.removeEventListener('error', this.methods.onerror);
        },
        methods: {
          onloadedmetadata: function(evt) {
            MINI_PLAYER.fastSeek(0);
            var duration = evt.target.duration;
            DURATION.innerHTML = convertTime(evt.target.duration);
            DURATION_SLIDER.setAttribute("max", duration);
          },
          ontimeupdate: function(evt) {
            var currentTime = evt.target.currentTime;
            CURRENT_TIME.innerHTML = convertTime(evt.target.currentTime);
            DURATION_SLIDER.value = currentTime;
          },
          onpause: function() {
            PLAY_BTN.src = '/icons/img/play.png';
          },
          onplay: function() {
            PLAY_BTN.src = '/icons/img/pause.png';
          },
          onseeking: function(evt) {
            $router.showLoading(false);
            CURRENT_TIME.innerHTML = convertTime(evt.target.currentTime);
            DURATION_SLIDER.value = evt.target.currentTime;
          },
          onseeked: function(evt) {
            $router.hideLoading();
          },
          onended: function() {
            PLAY_BTN.src = '/icons/img/play.png';
          },
          onerror: function () {
            MINI_PLAYER.pause();
            PLAY_BTN.src = '/icons/img/play.png';
            $router.showToast('Error');
          },
        },
        dPadNavListener: {
          arrowUp: function() {
            volumeUp(MINI_PLAYER, $router, toggleVolume)
          },
          arrowRight: function() {
            MINI_PLAYER.fastSeek(MINI_PLAYER.currentTime + 10);
          },
          arrowDown: function() {
            volumeDown(MINI_PLAYER, $router, toggleVolume);
          },
          arrowLeft: function() {
            MINI_PLAYER.fastSeek(MINI_PLAYER.currentTime - 10);
          },
        },
        backKeyListener: function(evt) {
          return -1;
        }
      })
    );
  }

  const addOrEditPlaylistDialog = function(_this, name = '', id = null) {
    const playlistDialog = Kai.createDialog((id ? 'Edit' : 'Add') + ' Playlist', `<div><input id="playlist-name" placeholder="Enter playlist name" class="kui-input" type="text" value=""/></div>`, null, '', undefined, '', undefined, '', undefined, undefined, _this.$router);
    playlistDialog.mounted = () => {
      setTimeout(() => {
        setTimeout(() => {
          _this.$router.setSoftKeyText('Cancel' , '', 'Save');
          INPUT.value = name;
        }, 103);
        const INPUT = document.getElementById('playlist-name');
        if (!INPUT) {
          return;
        }
        INPUT.focus();
        INPUT.addEventListener('keydown', (evt) => {
          switch (evt.key) {
            case 'Backspace':
            case 'EndCall':
              if (document.activeElement.value.length === 0) {
                _this.$router.hideBottomSheet();
                setTimeout(() => {
                  _this.methods.renderSoftKeyLCR();
                  INPUT.blur();
                }, 100);
              }
              break
            case 'SoftRight':
              _this.$router.hideBottomSheet();
              setTimeout(() => {
                _this.methods.renderSoftKeyLCR();
                INPUT.blur();
                _this.methods.addOrEditPlaylist(INPUT.value, id);
              }, 100);
              break
            case 'SoftLeft':
              _this.$router.hideBottomSheet();
              setTimeout(() => {
                _this.methods.renderSoftKeyLCR();
                INPUT.blur();
              }, 100);
              break
          }
        });
      });
    }
    playlistDialog.dPadNavListener = {
      arrowUp: function() {
        const INPUT = document.getElementById('playlist-name');
        INPUT.focus();
      },
      arrowDown: function() {
        const INPUT = document.getElementById('playlist-name');
        INPUT.focus();
      }
    }
    _this.$router.showBottomSheet(playlistDialog);
  }

  const playlist = new Kai({
    name: '_playlist_',
    data: {
      title: '_playlist_',
      playlists: [],
    },
    verticalNavClass: '.playlistNav',
    templateUrl: document.location.origin + '/templates/playlist.html',
    mounted: function() {
      this.$router.setHeaderTitle('Playlist');
      this.methods.getPlaylist();
    },
    unmounted: function() {},
    methods: {
      renderSoftKeyLCR: function() {
        if (this.$router.bottomSheet) {
          return
        }
        this.$router.setSoftKeyText('Add', '', '');
        if (this.verticalNavIndex > -1) {
          const selected = this.data.playlists[this.verticalNavIndex];
          if (selected) {
            this.$router.setSoftKeyText('Add', 'PLAY', 'Action');
          }
        }
      },
      getPlaylist: function() {
        var playlists = [];
        const src = this.$state.getState('PLAYLIST');
        for (var y in src) {
          playlists.push(src[y]);
        }
        this.setData({ playlists: playlists });
        this.methods.renderSoftKeyLCR();
      },
      addOrEditPlaylist: function(name = '', id = null) {
        var oldName = '';
        name = name.trim();
        if (name.length === 0) {
          this.$router.showToast('Playlist name is required');
        } else {
          localforage.getItem(DB_PLAYLIST)
          .then((PLAYLIST) => {
            if (PLAYLIST == null) {
              PLAYLIST = {};
            }
            const pid = id || new Date().getTime();
            if (PLAYLIST[pid]) {
              oldName = PLAYLIST[pid].name.toString();
              PLAYLIST[pid].name = name;
            } else {
              const obj = { id: pid, name: name, collections: [] };
              PLAYLIST[pid] = obj;
            }
            localforage.setItem(DB_PLAYLIST, PLAYLIST);
          })
          .then(() => {
            return localforage.getItem(DB_PLAYLIST);
          })
          .then((UPDATED_PLAYLIST) => {
            var msg = `${name} added to Playlist`;
            if (id) {
              msg = `${oldName} updated to ${name}`;
            }
            this.$router.showToast(msg);
            this.$state.setState('PLAYLIST', UPDATED_PLAYLIST);
            this.methods.getPlaylist();
          })
          .catch((err) => {
            console.log(err);
            this.$router.showToast(err.toString());
          });
        }
      }
    },
    softKeyText: { left: 'Add', center: '', right: '' },
    softKeyListener: {
      left: function() {
        addOrEditPlaylistDialog(this, '', null);
      },
      center: function() {
        const _selected = this.data.playlists[this.verticalNavIndex];
        if (_selected) {
          playPlaylistCollection(_selected.id);
        }
      },
      right: function() {
        const _selected = this.data.playlists[this.verticalNavIndex];
        if (_selected) {
          const menus = [
            { text: 'Tracklist' },
            { text: 'Update' },
            { text: 'Delete' },
          ]
          this.$router.showOptionMenu('Action', menus, 'Select', (selected) => {
            if (selected.text === 'Tracklist') {
              const DB = this.$state.getState('DATABASE');
              const PLYLS = this.$state.getState('PLAYLIST');
              const cur = PLYLS[_selected.id];
              if (cur) {
                if (cur.collections.length > 0) {
                  var collections = [];
                  cur.collections.forEach((v) => {
                    DB[v].checked = true;
                    DB[v].text = DB[v].title || DB[v]._title;
                    collections.push(DB[v]);
                  });
                  setTimeout(() => {
                    this.$router.showMultiSelector(_selected.name, collections, 'Select', null, 'Save', (_collections_) => {
                      var _tracklist = [];
                      _collections_.forEach((v) => {
                        if (v.checked) {
                          _tracklist.push(v.id);
                        }
                      });
                      // console.log(_tracklist);
                      PLYLS[_selected.id].collections = _tracklist;
                      localforage.setItem(DB_PLAYLIST, PLYLS)
                      .then(() => {
                        return localforage.getItem(DB_PLAYLIST);
                      })
                      .then((UPDATED_PLAYLIST) => {
                        this.$router.showToast('DONE');
                        this.$state.setState('PLAYLIST', UPDATED_PLAYLIST);
                      })
                      .catch((err) => {
                        this.$router.showToast(err.toString());
                      });
                    }, 'Cancel', null, () => {
                      setTimeout(() => {
                        this.methods.renderSoftKeyLCR();
                      }, 100);
                    }, 0);
                  }, 105);
                } else {
                  this.$router.showToast('Empty Tracklist');
                }
              }
            } else if (selected.text === 'Update') {
              addOrEditPlaylistDialog(this, _selected.name, _selected.id);
            } else if (selected.text === 'Delete'){
              const PLYLS = this.$state.getState('PLAYLIST');
              if (PLYLS[_selected.id]) {
                this.$router.showDialog('Delete', `Are you sure to remove ${_selected.name} ?`, null, 'Yes', () => {
                  delete PLYLS[_selected.id];
                  localforage.setItem(DB_PLAYLIST, PLYLS)
                  .then(() => {
                    return localforage.getItem(DB_PLAYLIST);
                  })
                  .then((UPDATED_PLAYLIST) => {
                    this.$router.showToast(`${_selected.name} deleted`);
                    this.$state.setState('PLAYLIST', UPDATED_PLAYLIST);
                    this.verticalNavIndex = -1;
                    this.methods.getPlaylist();
                  })
                  .catch((err) => {
                    this.$router.showToast(err.toString());
                  });
                }, 'No', () => {}, ' ', null, () => {
                  setTimeout(() => {
                    this.methods.renderSoftKeyLCR();
                  }, 100);
                });
              }
            }
          }, () => {
            setTimeout(() => {
              this.methods.renderSoftKeyLCR();
            }, 100);
          }, 0);
        }
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        if (this.verticalNavIndex <= 0) {
          return
        }
        this.navigateListNav(-1);
        this.methods.renderSoftKeyLCR();
      },
      arrowDown: function() {
        if (this.verticalNavIndex === this.data.playlists.length - 1) {
          return
        }
        this.navigateListNav(1);
        this.methods.renderSoftKeyLCR();
      }
    },
  });

  const saveVideoID = function ($router, video, isUpdate = false) {
    localforage.getItem(DB_NAME)
    .then((DATABASE) => {
      if (DATABASE == null) {
        DATABASE = {};
      }
      if (DATABASE[video.id] && !isUpdate) {
        $router.showToast('Already exist inside DB');
      } else {
        $router.push(
          new Kai({
            name: 'saveVideo',
            data: {
              title: isUpdate ? (video.title || '') : '',
              artist: isUpdate ? (video.artist || '') : '',
              album: isUpdate ? (video.album || '') : '',
              genre: isUpdate ? (video.genre || '') : '',
              year: isUpdate ? (video.year || '') : '',
              track: isUpdate ? (video.track || '') : '',
            },
            verticalNavClass: '.saveVideoNav',
            templateUrl: document.location.origin + '/templates/saveVideo.html',
            mounted: function() {
              this.$router.setHeaderTitle(`Metadata #${video.id}`);
            },
            unmounted: function() {},
            methods: {
              submit: function() {
                var obj = {
                  id: video.id,
                  _title: video._title || video.title,
                  duration: video.duration,
                  title: false,
                  artist: false,
                  album: false,
                  genre: false,
                  year: false,
                  track: false,
                };
                if (document.getElementById('title').value.trim().length > 0) {
                  obj.title = document.getElementById('title').value.trim();
                }
                if (document.getElementById('artist').value.trim().length > 0) {
                  obj.artist = document.getElementById('artist').value.trim();
                }
                if (document.getElementById('album').value.trim().length > 0) {
                  obj.album = document.getElementById('album').value.trim();
                }
                if (document.getElementById('genre').value.trim().length > 0) {
                  obj.genre = document.getElementById('genre').value.trim();
                }
                if (document.getElementById('year').value.trim().length > 0) {
                  try {
                    obj.year = JSON.parse(document.getElementById('year').value.trim());
                  } catch(e){}
                }
                if (document.getElementById('track').value.trim().length > 0) {
                  try {
                    obj.year = JSON.parse(document.getElementById('track').value.trim());
                  } catch(e){}
                }

                function exec(_obj) {
                  DATABASE[video.id] = _obj;
                  localforage.setItem(DB_NAME, DATABASE)
                  .then(() => {
                    $router.showToast('Saved');
                    $router.pop();
                    return localforage.getItem(DB_NAME);
                  })
                  .then((UPDATED_DATABASE) => {
                    state.setState('DATABASE', UPDATED_DATABASE);
                  })
                  .catch((err) => {
                    console.log(err);
                    $router.showToast(err.toString());
                  });
                }

                if (!isUpdate || video.local_path == null) {
                  $router.showLoading();
                  getAudioStreamURL(video.id)
                  .then((url) => {
                    $router.hideLoading();
                    $router.showLoading();
                    const down = new XMLHttpRequest({ mozSystem: true });
                    down.open('GET', url, true);
                    down.responseType = 'blob';
                    down.onload = (evt) => {
                      saveBlobToStorage(evt.currentTarget.response, `${video.id}_${video.title}`, (localPath) => {
                        if (localPath === false) {
                          $router.showToast("Error SAVING");
                        } else {
                          obj.local_path = localPath;
                          exec(obj);
                        }
                        $router.hideLoading();
                      });
                    }
                    down.onprogress = (evt) => {
                      if (evt.lengthComputable) {
                        var percentComplete = evt.loaded / evt.total * 100;
                        $router.showToast(`${percentComplete.toFixed(2)}%`);
                      }
                    }
                    down.onerror = (err) => {
                      $router.hideLoading();
                      $router.showToast("Error DOWNLOADING");
                    }
                    down.send();
                  })
                  .catch((e) => {
                    $router.hideLoading();
                    $router.showToast("Error GET");
                  });
                } else {
                  exec(obj);
                }
              }
            },
            softKeyText: { left: '', center: '', right: '' },
            softKeyListener: {
              left: function() {},
              center: function() {
                const listNav = document.querySelectorAll(this.verticalNavClass);
                if (this.verticalNavIndex > -1) {
                  if (listNav[this.verticalNavIndex]) {
                    listNav[this.verticalNavIndex].click();
                  }
                }
              },
              right: function() {}
            },
            dPadNavListener: {
              arrowUp: function() {
                this.navigateListNav(-1);
              },
              arrowDown: function() {
                this.navigateListNav(1);
              }
            }
          })
        );
      }
    }).catch((err) => {
      console.log(err);
    });
  }

  const search = new Kai({
    name: 'search',
    data: {
      title: 'search',
      results: [],
      key: '',
      nextPageToken: null,
      estimatedResults: ''
    },
    verticalNavClass: '.searchNav',
    templateUrl: document.location.origin + '/templates/search.html',
    mounted: function() {
      this.$router.setHeaderTitle('Search');
      this.methods.renderSoftKeyLCR();
    },
    unmounted: function() {
      
    },
    methods: {
      selected: function(vid) {
        this.$router.showLoading();
        getVideoLinks(vid.id)
        .then((links) => {
          var audio = [];
          links.forEach((link) => {
            if (link.mimeType.indexOf('audio') > -1) {
              var br = parseInt(link.bitrate);
              if (br > 999) {
                br = Math.round(br/1000);
              }
              link.br = br;
              link.text = link.mimeType + '(' + br.toString() + 'kbps)';
              audio.push(link);
            }
          });
          audio.sort((a, b) => {
            if (a['br'] > b['br'])
              return 1;
            else if (a['br'] < b['br'])
              return -1;
            return 0;
          });
          // console.log(audio);
          if (audio.length > 0) {
            this.methods.showPlayOption(audio);
          }
        })
        .catch((err) => {
          // console.log(err);
        })
        .finally(() => {
          this.$router.hideLoading();
        });
      },
      showPlayOption: function(formats) {
        this.$router.showOptionMenu('Select Format', formats, 'Select', (selected) => {
          playMiniAudio(this, selected);
          // console.log(selected);
        }, () => {
          setTimeout(() => {
            this.methods.renderSoftKeyLCR();
          }, 100);
        }, 0);
      },
      search: function(q = '') {
        this.$router.showLoading();
        searchVideo(q)
        .then((data) => {
          this.verticalNavIndex = -1;
          var videos = [];
          data.results.forEach((t) => {
            if (t.video) {
              t.video.isVideo = true;
              videos.push(t.video);
            }
          });
          this.setData({
            results: [],
            key: data.key,
            estimatedResults: data.estimatedResults,
            nextPageToken: data.nextPageToken || null,
          });
          this.methods.processResult(videos);
        })
        .catch((err) => {
          console.log(err.toString());
        })
        .finally(() => {
          this.$router.hideLoading();
        });
      },
      nextPage: function() {
        this.$router.showLoading();
        searchVideo("", this.data.key, this.data.nextPageToken)
        .then((data) => {
          var videos = [];
          data.results.forEach((t) => {
            if (t.video) {
              t.video.isVideo = true;
              videos.push(t.video);
            }
          });
          this.setData({
            key: data.key,
            estimatedResults: data.estimatedResults,
            nextPageToken: data.nextPageToken || null,
          });
          this.methods.processResult(videos);
        })
        .catch((err) => {
          console.log(err.toString());
        })
        .finally(() => {
          this.$router.hideLoading();
        });
      },
      processResult: function(videos) {
        const last = this.data.results[this.data.results.length - 1];
        if (last && !last.isVideo) {
          this.data.results.pop();
        }
        const merged = [...this.data.results, ...videos];
        if (this.data.nextPageToken) {
          merged.push({ isVideo: false });
        }
        this.setData({ results: merged });
        this.methods.renderSoftKeyLCR();
      },
      renderSoftKeyLCR: function() {
        if (this.$router.bottomSheet) {
          return
        }
        this.$router.setSoftKeyCenterText('');
        this.$router.setSoftKeyRightText('');
        if (this.verticalNavIndex > -1) {
          const selected = this.data.results[this.verticalNavIndex];
          if (selected) {
            if (selected.isVideo) {
              this.$router.setSoftKeyCenterText('PLAY');
              this.$router.setSoftKeyRightText('Save');
            } else {
              this.$router.setSoftKeyCenterText('SELECT');
            }
          }
        }
      }
    },
    softKeyText: { left: 'Search', center: '', right: '' },
    softKeyListener: {
      left: function() {
        const searchDialog = Kai.createDialog('Search', '<div><input id="search-input" placeholder="Enter your keyword" class="kui-input" type="text" /></div>', null, '', undefined, '', undefined, '', undefined, undefined, this.$router);
        searchDialog.mounted = () => {
          setTimeout(() => {
            setTimeout(() => {
              this.$router.setSoftKeyText('Cancel' , '', 'Go');
            }, 103);
            const SEARCH_INPUT = document.getElementById('search-input');
            if (!SEARCH_INPUT) {
              return;
            }
            SEARCH_INPUT.focus();
            SEARCH_INPUT.addEventListener('keydown', (evt) => {
              switch (evt.key) {
                case 'Backspace':
                case 'EndCall':
                  if (document.activeElement.value.length === 0) {
                    this.$router.hideBottomSheet();
                    setTimeout(() => {
                      this.methods.renderSoftKeyLCR();
                      SEARCH_INPUT.blur();
                    }, 100);
                  }
                  break
                case 'SoftRight':
                  this.$router.hideBottomSheet();
                  setTimeout(() => {
                    this.methods.renderSoftKeyLCR();
                    SEARCH_INPUT.blur();
                    this.methods.search(SEARCH_INPUT.value);
                  }, 100);
                  break
                case 'SoftLeft':
                  this.$router.hideBottomSheet();
                  setTimeout(() => {
                    this.methods.renderSoftKeyLCR();
                    SEARCH_INPUT.blur();
                  }, 100);
                  break
              }
            });
          });
        }
        searchDialog.dPadNavListener = {
          arrowUp: function() {
            const SEARCH_INPUT = document.getElementById('search-input');
            SEARCH_INPUT.focus();
          },
          arrowDown: function() {
            const SEARCH_INPUT = document.getElementById('search-input');
            SEARCH_INPUT.focus();
          }
        }
        this.$router.showBottomSheet(searchDialog);
      },
      center: function() {
        const selected = this.data.results[this.verticalNavIndex];
        if (selected) {
          if (selected.isVideo)
            this.methods.selected(selected);
          else
            this.methods.nextPage();
        }
      },
      right: function() {
        const selected = this.data.results[this.verticalNavIndex];
        if (selected) {
          if (selected.isVideo)
            saveVideoID(this.$router, selected);
        }
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        if (this.verticalNavIndex <= 0) {
          return
        }
        this.navigateListNav(-1);
        this.methods.renderSoftKeyLCR();
      },
      arrowDown: function() {
        if (this.verticalNavIndex === this.data.results.length - 1) {
          return
        }
        this.navigateListNav(1);
        this.methods.renderSoftKeyLCR();
      }
    },
    backKeyListener: function() {
      return false;
    }
  });

  const database = new Kai({
    name: 'database',
    data: {
      title: 'database',
      bulk_results: [],
      results: [],
      perPage: 9,
      nextPage: null
    },
    verticalNavClass: '.searchNav',
    templateUrl: document.location.origin + '/templates/search.html',
    mounted: function() {
      this.$router.setHeaderTitle('Local Database');
      if (this.data.results.length === 0) {
        this.methods.resetSearch();
      }
      this.methods.renderSoftKeyLCR();
    },
    unmounted: function() {},
    methods: {
      selected: function(vid) {
        this.$router.showLoading();
        getVideoLinks(vid.id)
        .then((links) => {
          var audio = [];
          links.forEach((link) => {
            if (link.mimeType.indexOf('audio') > -1) {
              var br = parseInt(link.bitrate);
              if (br > 999) {
                br = Math.round(br/1000);
              }
              link.br = br;
              link.text = link.mimeType + '(' + br.toString() + 'kbps)';
              audio.push(link);
            }
          });
          audio.sort((a, b) => {
            if (a['br'] > b['br'])
              return 1;
            else if (a['br'] < b['br'])
              return -1;
            return 0;
          });
          // console.log(audio);
          if (audio.length > 0) {
            this.methods.showPlayOption(audio);
          }
        })
        .catch((err) => {
          console.log(err);
        })
        .finally(() => {
          this.$router.hideLoading();
        });
      },
      showPlayOption: function(formats) {
        this.$router.showOptionMenu('Select Format', formats, 'Select', (selected) => {
          playMiniAudio(this, selected);
          // console.log(selected);
        }, () => {
          setTimeout(() => {
            this.methods.renderSoftKeyLCR();
          }, 100);
        }, 0);
      },
      presentInPlaylist: function(video) {
        var presents = []
        const src = this.$state.getState('PLAYLIST');
        for (var y in src) {
          var checked = false;
          if (src[y].collections.indexOf(video.id) > -1) {
            checked = true;
          }
          presents.push({ "text": src[y].name, "id": src[y].id, "checked": checked });
        }
        if (presents.length === 0) {
          this.$router.showToast("Empty Playlist");
        } else {
          this.$router.showMultiSelector('Playlist', presents, 'Select', null, 'Save', (_presents_) => {
            _presents_.forEach((p) => {
              const idx = src[p.id].collections.indexOf(video.id);
              if (p.checked) {
                if (idx === -1){
                  src[p.id].collections.push(video.id);
                }
              } else {
                if (idx > -1){
                  src[p.id].collections.splice(idx, 1);
                }
              }
            });
            localforage.setItem(DB_PLAYLIST, src)
            .then(() => {
              return localforage.getItem(DB_PLAYLIST);
            })
            .then((UPDATED_PLAYLIST) => {
              this.$router.showToast('DONE');
              this.$state.setState('PLAYLIST', UPDATED_PLAYLIST);
            })
            .catch((err) => {
              this.$router.showToast(err.toString());
            });
          }, 'Cancel', null, () => {
            setTimeout(() => {
              this.methods.renderSoftKeyLCR();
            }, 100);
          }, 0);
        }
      },
      deleteVideo: function(video) {
        var affected = [];
        const DB = this.$state.getState('DATABASE');
        const PLYLS = this.$state.getState('PLAYLIST');
        if (DB[video.id]) {
          this.$router.showDialog('Delete', `Are you sure to remove ${video._title} ?`, null, 'Yes', () => {
            for (var y in PLYLS) {
              const idx = PLYLS[y].collections.indexOf(video.id);
              if (idx > -1){
                PLYLS[y].collections.splice(idx, 1);
                affected.push(PLYLS[y].name);
              }
            }
            if (affected.length > 0) {
              localforage.setItem(DB_PLAYLIST, PLYLS)
              .then(() => {
                return localforage.getItem(DB_PLAYLIST);
              })
              .then((UPDATED_PLAYLIST) => {
                this.$state.setState('PLAYLIST', UPDATED_PLAYLIST);
              })
              .catch((err) => {
                console.log(err);
              });
            }
            delete DB[video.id];
            localforage.setItem(DB_NAME, DB)
            .then(() => {
              return localforage.getItem(DB_NAME);
            })
            .then((UPDATED_DATABASE) => {
              this.$router.showToast('Deleted');
              this.$state.setState('DATABASE', UPDATED_DATABASE);
              this.methods.resetSearch();
            })
            .catch((err) => {
              console.log(err);
              this.$router.showToast(err.toString());
            });
          }, 'No', () => {}, ' ', null, () => {
            setTimeout(() => {
              this.methods.renderSoftKeyLCR();
            }, 100);
          });
        }
      },
      resetSearch: function() {
        this.verticalNavIndex = -1;
        const src = this.$state.getState('DATABASE');
        const bulk_results = [];
        for (var x in src) {
          src[x].isVideo = true
          bulk_results.push(src[x]);
        }
        this.data.results = [];
        this.data.bulk_results = bulk_results;
        this.methods.processResult(0);
      },
      search: function(keyword = '') {
        keyword = keyword.trim();
        if (keyword.length === 0) {
          this.methods.resetSearch();
        } else {
          const src = this.$state.getState('DATABASE');
          const bulk_results = [];
          for (var x in src) {
            src[x].isVideo = true;
            if (src[x]._title.toLowerCase().indexOf(keyword.toLowerCase()) > -1) {
              bulk_results.push(src[x]);
            } else {
              const fields = ['title', 'artist', 'album', 'genre', 'year'];
              for (var v in fields) {
                if (src[x][fields[v]] && src[x][fields[v]].toString().toLowerCase().indexOf(keyword.toLowerCase()) > -1) {
                  bulk_results.push(src[x]);
                  break
                }
              }
            }
          }
          this.verticalNavIndex = -1;
          this.data.results = [];
          this.data.bulk_results = bulk_results;
          console.log(this.data.bulk_results);
          this.methods.processResult(0);
        }
      },
      processResult: function(page = 0) {
        const last = this.data.results[this.data.results.length - 1];
        if (last && !last.isVideo) {
          this.data.results.pop();
        }
        var totalPages = Math.floor(this.data.bulk_results.length / this.data.perPage);
        if ((this.data.bulk_results.length % this.data.perPage) > 0) {
          totalPages++;
        }
        var next = null;
        var start = page * this.data.perPage;
        var end = start + this.data.perPage;
        if (page < (totalPages - 1)) {
          next = page + 1;
        }
        this.data.nextPage = next;
        const merged = [...this.data.results, ...this.data.bulk_results.slice(start, end)];
        if (this.data.nextPage) {
          merged.push({ isVideo: false });
        }
        this.setData({ results: merged });
        this.methods.renderSoftKeyLCR();
      },
      renderSoftKeyLCR: function() {
        if (this.$router.bottomSheet) {
          return
        }
        this.$router.setSoftKeyText('Search', '', '');
        if (this.verticalNavIndex > -1) {
          const selected = this.data.results[this.verticalNavIndex];
          if (selected) {
            if (selected.isVideo) {
              this.$router.setSoftKeyText('Search', 'PLAY', 'Action');
            } else {
              this.$router.setSoftKeyText('Search', 'SELECT', '');
            }
          }
        }
      }
    },
    softKeyText: { left: 'Search', center: '', right: '' },
    softKeyListener: {
      left: function() {
        const searchDialog = Kai.createDialog('Search', '<div><input id="local-search-input" placeholder="Enter your keyword" class="kui-input" type="text" /></div>', null, '', undefined, '', undefined, '', undefined, undefined, this.$router);
        searchDialog.mounted = () => {
          setTimeout(() => {
            setTimeout(() => {
              this.$router.setSoftKeyText('Cancel' , '', 'Go');
            }, 103);
            const SEARCH_INPUT = document.getElementById('local-search-input');
            if (!SEARCH_INPUT) {
              return;
            }
            SEARCH_INPUT.focus();
            SEARCH_INPUT.addEventListener('keydown', (evt) => {
              switch (evt.key) {
                case 'Backspace':
                case 'EndCall':
                  if (document.activeElement.value.length === 0) {
                    this.$router.hideBottomSheet();
                    setTimeout(() => {
                      this.methods.renderSoftKeyLCR();
                      SEARCH_INPUT.blur();
                    }, 100);
                  }
                  break
                case 'SoftRight':
                  this.$router.hideBottomSheet();
                  setTimeout(() => {
                    this.methods.renderSoftKeyLCR();
                    SEARCH_INPUT.blur();
                    this.methods.search(SEARCH_INPUT.value);
                  }, 100);
                  break
                case 'SoftLeft':
                  this.$router.hideBottomSheet();
                  setTimeout(() => {
                    this.methods.renderSoftKeyLCR();
                    SEARCH_INPUT.blur();
                  }, 100);
                  break
              }
            });
          });
        }
        searchDialog.dPadNavListener = {
          arrowUp: function() {
            const SEARCH_INPUT = document.getElementById('local-search-input');
            SEARCH_INPUT.focus();
          },
          arrowDown: function() {
            const SEARCH_INPUT = document.getElementById('local-search-input');
            SEARCH_INPUT.focus();
          }
        }
        this.$router.showBottomSheet(searchDialog);
      },
      center: function() {
        const selected = this.data.results[this.verticalNavIndex];
        if (selected) {
          if (selected.isVideo)
            this.methods.selected(selected);
          else {
            if (this.data.nextPage != null)
            this.methods.processResult(this.data.nextPage);
          }
        }
      },
      right: function() {
        const _selected = this.data.results[this.verticalNavIndex];
        if (_selected) {
          if (_selected.isVideo) {
            const menus = [
              { text: 'Play All' },
              { text: 'Add/Remove from Playlist' },
              { text: 'Update Metadata' },
              { text: 'Delete' },
            ]
            this.$router.showOptionMenu('Menu', menus, 'Select', (selected) => {
              if (selected.text === 'Update Metadata') {
                saveVideoID(this.$router, _selected, true);
              } else if (selected.text === 'Add/Remove from Playlist') {
                this.methods.presentInPlaylist(_selected);
              } else if (selected.text === 'Delete') {
                this.methods.deleteVideo(_selected);
              } else if (selected.text === 'Play All') {
                playDefaultCollection();
              }
            }, () => {
              setTimeout(() => {
                this.methods.renderSoftKeyLCR();
              }, 100);
            }, 0);
          }
        }
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        if (this.verticalNavIndex <= 0) {
          return
        }
        this.navigateListNav(-1);
        this.methods.renderSoftKeyLCR();
      },
      arrowDown: function() {
        if (this.verticalNavIndex === this.data.results.length - 1) {
          return
        }
        this.navigateListNav(1);
        this.methods.renderSoftKeyLCR();
      }
    },
    backKeyListener: function() {
      this.data.title = 'database';
      this.data.bulk_results = [];
      this.data.results = [];
      this.data.perPage = 9;
      this.data.nextPage = null;
    },
  });

  const home = new Kai({
    name: 'home',
    data: {
      title: 'UNKNOWN',
      artist: 'UNKNOWN',
      album: 'UNKNOWN',
      genre: 'UNKNOWN',
      album_art: '/icons/img/baseline_person_white_36dp.png',
      play_icon: '/icons/img/baseline_play_circle_filled_white_36dp.png',
      tx_tl: '0/0',
      duration: '00:00',
      current_time: '00:00',
      slider_value: 0,
      slider_max: 0,
      repeat_class: 'inactive',
      repeat_icon: '/icons/img/baseline_repeat_white_18dp.png',
      shuffle_class: 'inactive',
    },
    templateUrl: document.location.origin + '/templates/home.html',
    mounted: function() {
      this.$router.setHeaderTitle('YT Music');
      MAIN_PLAYER.ontimeupdate = this.methods.ontimeupdate;
      MAIN_PLAYER.onpause = this.methods.onpause;
      MAIN_PLAYER.onplay = this.methods.onplay;

      this.$state.addStateListener('TRACKLIST_IDX', this.methods.listenTracklistIdx);
      this.methods.listenTracklistIdx(this.$state.getState('TRACKLIST_IDX'));

      this.$state.addStateListener('TRACK_DURATION', this.methods.listenTrackDuration);
      this.methods.listenTrackDuration(this.$state.getState('TRACK_DURATION'));

      this.methods.togglePlayIcon();

      document.addEventListener('keydown', this.methods.skipEvent);

      localforage.getItem('REPEAT')
      .then((val) => {
        if (val != null) {
          var REPEAT = val - 1;
          this.$state.setState('REPEAT', REPEAT);
          var style = toggleRepeat();
          this.setData({ repeat_class: style.classList, repeat_icon: style.src });
        }
      });

      const SHUFFLE = this.$state.getState('SHUFFLE');
      if (SHUFFLE)
        this.setData({ shuffle_class: '' });
      else
        this.setData({ shuffle_class: 'inactive' });

    },
    unmounted: function() {
      this.$state.removeStateListener('TRACKLIST_IDX', this.methods.listenTracklistIdx);
      this.$state.removeStateListener('TRACK_DURATION', this.methods.listenTrackDuration);
      document.removeEventListener('keydown', this.methods.skipEvent);
      MAIN_PLAYER.ontimeupdate = null;
      MAIN_PLAYER.onpause = null;
      MAIN_PLAYER.onplay = null;
    },
    methods: {
      skipEvent: function (evt) {
        switch (evt.key) {
          case '1':
            var threshold = new Date().getTime() - LFT_DBL_CLICK_TH;
            if (threshold > 0 && threshold <= 300) {
              clearTimeout(LFT_DBL_CLICK_TIMER);
              LFT_DBL_CLICK_TH = 0;
              MAIN_PLAYER.pause();
              MAIN_PLAYER.currentTime -= 10;
              MAIN_PLAYER.play();
            } else {
              LFT_DBL_CLICK_TH = new Date().getTime();
              LFT_DBL_CLICK_TIMER = setTimeout(() => {
                if (LFT_DBL_CLICK_TH !== 0) {
                  LFT_DBL_CLICK_TH = 0;
                }
              }, 500);
            }
            break;
          case '3':
            var threshold = new Date().getTime() - RGT_DBL_CLICK_TH;
            if (threshold > 0 && threshold <= 300) {
              clearTimeout(RGT_DBL_CLICK_TIMER);
              RGT_DBL_CLICK_TH = 0;
              MAIN_PLAYER.pause();
              MAIN_PLAYER.currentTime += 10;
              MAIN_PLAYER.play();
            } else {
              RGT_DBL_CLICK_TH = new Date().getTime();
              RGT_DBL_CLICK_TIMER = setTimeout(() => {
                if (RGT_DBL_CLICK_TH !== 0) {
                  RGT_DBL_CLICK_TH = 0;
                }
              }, 500);
            }
            break;
          case '*':
            var style = toggleRepeat(this.$router);
            this.setData({ repeat_class: style.classList, repeat_icon: style.src });
            break;
          case '#':
            var style = toggleShuffle(this.$router);
            this.setData({ shuffle_class: style.classList });
            break;
        }
      },
      togglePlayIcon: function() {
        if (MAIN_PLAYER.duration > 0 && !MAIN_PLAYER.paused) {
          this.setData({ play_icon: '/icons/img/baseline_pause_circle_filled_white_36dp.png' });
        } else {
          this.setData({ play_icon: '/icons/img/baseline_play_circle_filled_white_36dp.png' });
        }
      },
      onpause: function() {
        this.setData({ play_icon: '/icons/img/baseline_play_circle_filled_white_36dp.png' });
      },
      onplay: function() {
        this.setData({ play_icon: '/icons/img/baseline_pause_circle_filled_white_36dp.png' });
      },
      listenTracklistIdx: function(val) {
        const T = TRACKLIST[val];
        if (T) {
          this.setData({
            title: T.title || T._title,
            artist: T.artist || 'UNKNOWN',
            album: T.album || 'UNKNOWN',
            genre: T.genre || 'UNKNOWN',
            album_art: `https://i.ytimg.com/vi/${T.id}/hqdefault.jpg`,
            tx_tl: `${(val + 1).toString()}/${TRACKLIST.length.toString()}`
          });
        }
      },
      listenTrackDuration: function(val) {
        this.setData({ duration: convertTime(val), slider_max: val });
      },
      ontimeupdate: function(evt) {
        const DURATION_SLIDER = document.getElementById('home_duration_slider');
        const CURRENT_TIME = document.getElementById('home_current_time');
        const currentTime = evt.target.currentTime;
        this.data.current_time = convertTime(currentTime);
        CURRENT_TIME.innerHTML = this.data.current_time;
        this.data.slider_value = currentTime;
        DURATION_SLIDER.value = currentTime;
      }
    },
    softKeyText: { left: 'Tracklist', center: '', right: 'Menu' },
    softKeyListener: {
      left: function() {
        var tracklist = []
        TRACKLIST.forEach((t, i) => {
          t.text = `${i+1} - ${t.title || t._title}`;
          t.idx = i;
          tracklist.push(t);
        });
        this.$router.showOptionMenu(TRACK_NAME, tracklist, 'Select', (selected) => {
          if (TRACKLIST[selected.idx]) {
            this.$state.setState('TRACKLIST_IDX', selected.idx);
            playVideoByID(selected.idx);
          }
        }, () => {}, this.$state.getState('TRACKLIST_IDX'));
      },
      center: function() {
        if (MAIN_PLAYER.duration > 0 && !MAIN_PLAYER.paused) {
          MAIN_PLAYER.pause();
        } else {
          MAIN_PLAYER.play();
        }
      },
      right: function() {
        localforage.getItem('EQUALIZER_STATUS')
        .then((eq_status) => {
          const menus = [
            { text: 'Search' },
            { text: 'Local Database' },
            { text: 'Playlist' },
            { text: 'Preferred Mime' },
          ]
          if (eq_status) {
            menus.push({ text: 'Built-in Equalizer' }, { text: 'Equalizer Panel' }, { text: 'Disable Equalizer' });
          } else {
            menus.push({ text: 'Enable Equalizer' });
          }
          menus.push({ text: 'Clear Caches' }, { text: 'Exit' });
          this.$router.showOptionMenu('Menu', menus, 'Select', (selected) => {
            if (selected.text === 'Search') {
              this.$router.push('search');
            } else if (selected.text == 'Disable Equalizer' || selected.text == 'Enable Equalizer') {
              changeEqStatus();
            } else if (selected.text === 'Local Database') {
              this.$router.push('database');
            } else if (selected.text === 'Playlist') {
              this.$router.push('playlist');
            } else if (selected.text === 'Preferred Mime') {
              const mime = this.$state.getState('CONFIGURATION')['mimeType'];
              const opts = [
                { "text": "audio", "checked": mime === "audio" },
                { "text": "audio/webm", "checked": mime === "audio/webm" },
                { "text": "audio/mp4", "checked": mime === "audio/mp4" }
              ];
              const idx = opts.findIndex((opt) => {
                return opt.text === mime;
              });
              this.$router.showSingleSelector('Preferred Mime', opts, 'Select', (selected) => {
                const conf = this.$state.getState('CONFIGURATION');
                conf['mimeType'] = selected.text;
                localforage.setItem(DB_CONFIGURATION, conf)
                .then(() => {
                  return localforage.getItem(DB_CONFIGURATION);
                })
                .then((CONFIGURATION) => {
                  this.$state.setState('CONFIGURATION', CONFIGURATION);
                });
              }, 'Cancel', null, undefined, idx);
            } else if (selected.text === 'Built-in Equalizer') {
              localforage.getItem('__CURRENT_EQUALIZER__')
              .then((cur) => {
                const opts = [];
                for (var x in EQL_PRESENT) {
                  opts.push({ "text": x, "checked": x === cur });
                }
                const idx = opts.findIndex((opt) => {
                  return opt.text === cur;
                });
                this.$router.showSingleSelector('Built-in Equalizer', opts, 'Select', (selected) => {
                  loadEq(selected.text)
                }, 'Cancel', null, undefined, idx);
              });
            } else if (selected.text === 'Equalizer Panel') {
              this.$router.push('equalizer_panel');
            } else if (selected.text === 'Clear Caches') {
              localforage.setItem(DB_CACHED_URLS, null)
              .then(() => {
                this.$router.showToast('DONE');
              });
            } else if (selected.text === 'Exit') {
              window.close();
            } else {
              // console.log(selected.text);
            }
          }, () => {
            setTimeout(() => {}, 100);
          }, 0);
        });
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        volumeUp(MAIN_PLAYER, this.$router);
      },
      arrowRight: function() {
        const move = this.$state.getState('TRACKLIST_IDX') + 1;
        if (TRACKLIST[move]) {
          this.$state.setState('TRACKLIST_IDX', move);
          playVideoByID(move);
        }
      },
      arrowDown: function() {
        volumeDown(MAIN_PLAYER, this.$router);
      },
      arrowLeft: function() {
        const move = this.$state.getState('TRACKLIST_IDX') - 1;
        if (TRACKLIST[move]) {
          this.$state.setState('TRACKLIST_IDX', move);
          playVideoByID(move);
        }
      },
    },
    backKeyListener: function() {
      return false;
    }
  });

  const router = new KaiRouter({
    title: 'KaiKit',
    routes: {
      'index': {
        name: 'home',
        component: home
      },
      'search': {
        name: 'search',
        component: search
      },
      'database': {
        name: 'database',
        component: database
      },
      'playlist': {
        name: 'playlist',
        component: playlist
      },
      'equalizer_panel': {
        name: 'equalizer_panel',
        component: equalizer_panel
      },
    }
  });

  const app = new Kai({
    name: '_APP_',
    data: {},
    templateUrl: document.location.origin + '/templates/template.html',
    mounted: function() {},
    unmounted: function() {},
    router,
    state
  });

  try {
    app.mount('app');
  } catch(err) {
    console.log(err);
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
  .then(function(swReg) {
    console.error('Service Worker Registered');
  })
  .catch(function(error) {
    console.error('Service Worker Error', error);
  });
}
