localforage.setDriver(localforage.INDEXEDDB);

const CACHED_DECRYPTOR = {};
const OLD_PLAYLIST = 'YT_PLAYLIST';
const OLD_PLAYING = 'YT_PLAYING';

const DEFAULT_VOLUME = 0.02;
const SDCARD = navigator.getDeviceStorage('sdcard');

// DB START 

const DB_NAME = 'YT_MUSIC';

const DB_AUDIO_CURSOR = 'COLLECTIONS';
const DB_AUDIO = 'YT_AUDIO'; // DB_AUDIO_CURSOR { id: { ...metadata } }
const T_AUDIO = localforage.createInstance({
  name: DB_NAME,
  storeName: DB_AUDIO
});

const DB_PLAYLIST = 'YT_PLAYLIST'; // { id: {name, playlistURL, collections: []} }
const T_PLAYLIST = localforage.createInstance({
  name: DB_NAME,
  storeName: DB_PLAYLIST
});

const DB_CACHED_URL = 'YT_CACHED_URL'; // { id: URL }
const T_CACHED_URL = localforage.createInstance({
  name: DB_NAME,
  storeName: DB_CACHED_URL
});

const DB_PLAYING = 'YT_PLAYING'; // localStorage string

const DB_CONFIGURATION = 'YT_CONFIGURATION';
const T_CONFIGURATION = localforage.createInstance({
  name: DB_NAME,
  storeName: DB_CONFIGURATION
});

// DB END

var MAIN_DURATION_SLIDER;
var MAIN_CURRENT_TIME;
var MAIN_DURATION;

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

function putCachedURL(obj, url) {
  var params = getURLParam('expire', url);
  var expire = params[0];
  if (expire == null) {
    const segments = url.split('/');
    var idx = segments.indexOf('expire');
    if (idx > -1)
      idx++;
    if (isNaN(segments[idx]) === false)
      expire = parseInt(segments[idx]);
  }
  if (expire) {
    T_CACHED_URL.getItem(obj.id)
    .then((cached) => {
      if (cached == null)
        cached = {};
      cached[obj.bitrate] = {
        url: url,
        expire: parseInt(expire) * 1000
      };
      return T_CACHED_URL.setItem(obj.id, cached);
    })
    .then((saved) => {
      console.log('CACHED:', obj.id, saved);
    })
    .catch((err) => {
      console.log(err);
    })
  }
}

function getCachedURL(id, bitrate = null) {
  return new Promise((resolve, reject) => {
    T_CACHED_URL.getItem(id)
    .then((cached) => {
      if (cached == null) {
        reject("ID not exist");
        return;
      }
      if (bitrate != null && cached[bitrate] == null) {
        reject("Bitrate not exist");
        return;
      }
      if (bitrate === null) {
        const keys = Object.keys(cached);
        bitrate = parseInt(keys[keys.length - 1]);
      }
      if (new Date() < new Date(cached[bitrate]['expire'])) {
        console.log('FOUND:', id, bitrate);
        resolve(cached[bitrate]['url']);
        return;
      }
      reject("Expired link");
    })
    .catch((err) => {
      reject(err);
    });
  });
}

window.addEventListener("load", () => {

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
  var TRACKLIST_ORDER = [];

  const state = new KaiState({
    CONFIGURATION: {},
    DATABASE: {},
    PLAYLIST: {},
    TRACKLIST_IDX: 0,
    TRACK_DURATION: 0,
    REPEAT: -1,
    SHUFFLE: false,
  });

  var MAIN_PLAYER = document.createElement("audio");
  MAIN_PLAYER.volume = 1;
  MAIN_PLAYER.mozAudioChannelType = 'content';

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
        playMainAudio(next);
      } else {
        state.setState('TRACKLIST_IDX', 0);
        playMainAudio(0);
      }
    } else if (REPEAT === -1 && (state.getState('TRACKLIST_IDX') !== (TRACKLIST.length - 1))) {
      const next = state.getState('TRACKLIST_IDX') + 1;
      if (TRACKLIST[next]) {
        state.setState('TRACKLIST_IDX', next);
        playMainAudio(next);
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
      TRACKLIST = JSON.parse(JSON.stringify(TRACKLIST_ORDER));
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

  function init(from = null) {
    console.log('INIT APP:', from);
    localforage.getItem('SHUFFLE')
    .then((SHUFFLE) => {
      if (SHUFFLE == null)
        SHUFFLE = false;
      state.setState('SHUFFLE', SHUFFLE);
      localforage.setItem('SHUFFLE', SHUFFLE);
      localforage.getItem(OLD_PLAYING)
      .then((playlist_id) => {
        if (playlist_id == null) {
          playDefaultPlaylist();
        } else {
          playPlaylistById(playlist_id);
        }
      });
    });
  }

  T_CONFIGURATION.keys()
  .then((keys) => {
    keys.forEach((key) => {
      T_CONFIGURATION.getItem(key)
      .then((value) => {
        const list = state.getState('CONFIGURATION');
        list[key] = value;
        state.setState('CONFIGURATION', list);
        console.log(state.getState('CONFIGURATION'));
      });
    });
  }).catch((err) => {
    console.log(err);
  });

//console.log(state.getState('DATABASE'));
  T_AUDIO.keys()
  .then((keys) => {
    var success = 0;
    var fail = 0;
    var done = keys.length;
    if (done === 0)
      init('Empty');
    keys.forEach((key) => {
      T_AUDIO.getItem(key)
      .then((value) => {
        const list = state.getState('DATABASE');
        list[key] = value;
        state.setState('DATABASE', list);
        success++;
        done--;
        if (done <= 0)
          init(`${success}, ${fail}`);
      })
      .catch((err) => {
        fail++;
        done--;
        if (done <= 0)
          init(`${success}, ${fail}`);
      });
    });
  })
  .catch((err) => {
    console.log(err);
    init(err.toString());
  });

  localforage.getItem(OLD_PLAYLIST)
  .then((PLAYLIST) => {
    if (PLAYLIST == null) {
      PLAYLIST = {};
    }
    state.setState('PLAYLIST', PLAYLIST);
  });

  function playDefaultPlaylist() {
    TRACKLIST = [];
    TRACKLIST_ORDER = [];
    localforage.removeItem(OLD_PLAYING);
    state.setState('TRACKLIST_IDX', 0);
    TRACK_NAME = 'YT MUSIC';

    const launch = () => {
      var tracks = state.getState('DATABASE');
      for (var y in tracks) {
        TRACKLIST.push(tracks[y]);
        TRACKLIST_ORDER.push(tracks[y]);
      }
      shuffling();
      playMainAudio(state.getState('TRACKLIST_IDX'));
    }

    T_AUDIO.keys()
    .then((keys) => {
      var done = keys.length;
      keys.forEach((key) => {
        T_AUDIO.getItem(key)
        .then((value) => {
          const list = state.getState('DATABASE');
          list[key] = value;
          state.setState('DATABASE', list);
          done--;
          if (done <= 0)
            launch();
        })
        .catch((err) => {
          done--;
          if (done <= 0)
            launch();
        });
      });
    });
  }

  function playPlaylistById(id) {
    localforage.getItem(OLD_PLAYLIST)
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
      playDefaultPlaylist();
      return Promise.reject('Playlist not exist');
    })
    .then((PLYLST) => {
      T_AUDIO.getItem(DB_AUDIO_CURSOR)
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
          TRACKLIST_ORDER = JSON.parse(JSON.stringify(collections));
          shuffling();
          playMainAudio(state.getState('TRACKLIST_IDX'));
          router.showToast(`PLAYING ${TRACK_NAME}`);
          localforage.setItem(OLD_PLAYING, PLYLST.id);
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
          var bitrate = parseInt(link.bitrate);
          if (bitrate > 999) {
            bitrate = Math.round(bitrate/1000);
          }
          link.bitrate = bitrate;
          if (link.bitrate >= quality) {
            obj = link;
            quality = link.bitrate;
          }
        }
      });
      return Promise.resolve(obj);
    })
    .then((obj) => {
      if (obj.url != null) {
        return Promise.resolve(obj.url);
      } else {
        return getCachedURL(obj.id, obj.bitrate)
        .then((_url) => {
          return Promise.resolve(_url);
        })
        .catch((_err) => {
          return decryptSignatureV2(obj.signatureCipher, obj.player)
          .then((url) => {
            putCachedURL(obj, url);
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

  function downloadAudio($router, audio) {
    $router.showLoading();
    getAudioStreamURL(audio.id)
    .then((url) => {
      $router.hideLoading();
      $router.showLoading();
      const down = new XMLHttpRequest({ mozSystem: true });
      down.open('GET', url, true);
      down.responseType = 'blob';
      down.onload = (evt) => {
        saveBlobToStorage(evt.currentTarget.response, `${audio.id}_${audio.title}`, (localPath) => {
          if (localPath === false) {
            $router.showToast("Error SAVING");
          } else {
            obj.local_stream = localPath;
            // obj
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
  }

  function playMainAudio(idx) {
    if (TRACKLIST[idx] == null) {
      return
    }

    if (false) { // TRACKLIST[idx].local_stream
      var request = SDCARD.get(TRACKLIST[idx].local_stream);
      request.onsuccess = (file) => {
        MAIN_PLAYER.mozAudioChannelType = 'content';
        MAIN_PLAYER.src = URL.createObjectURL(file.target.result);
        MAIN_PLAYER.play();
      }
      request.onerror = (error) => {
        console.warn("Unable to get the file: " + error.toString());
      }
    } else {
      getCachedURL(TRACKLIST[idx].id)
      .then((url) => {
        console.log(url);
        MAIN_PLAYER.mozAudioChannelType = 'content';
        MAIN_PLAYER.src = url;
        MAIN_PLAYER.play();
      })
      .catch((err) => {
        console.log(err);
        getAudioStreamURL(TRACKLIST[idx].id)
        .then((url) => {
          console.log(url);
          MAIN_PLAYER.mozAudioChannelType = 'content';
          MAIN_PLAYER.src = url;
          MAIN_PLAYER.play();
        })
        .catch((err) => {
          console.log(err);
        });
      });
    }
  }

  function playMiniAudio($router, obj) {
    if (obj.url != null) {
      miniPlayer($router, obj.url);
    } else {
      $router.showLoading();
      getCachedURL(obj.id, obj.bitrate)
      .then((_url) => {
        $router.hideLoading();
        miniPlayer($router, _url);
      })
      .catch((_err) => {
        console.log(_err);
        decryptSignatureV2(obj.signatureCipher, obj.player)
        .then((url) => {
          putCachedURL(obj, url);
          miniPlayer($router, url);
        })
        .catch((err) => {
          console.log(err);
        })
        .finally(() => {
          $router.hideLoading();
        });
      });
    }
  }

  const miniPlayer = function($router, url) {

    var PLAY_BTN, DURATION_SLIDER, CURRENT_TIME, DURATION;
    const MINI_PLAYER = document.createElement("audio");
    MINI_PLAYER.volume = 1;
    MINI_PLAYER.mozAudioChannelType = 'content';

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

  const playlistEditor = function(scope, name = '', id = null) {
    const playlistDialog = Kai.createDialog((id ? 'Edit' : 'Add') + ' Playlist', `<div><input id="playlist-name" placeholder="Enter playlist name" class="kui-input" type="text" value=""/></div>`, null, '', undefined, '', undefined, '', undefined, undefined, scope.$router);
    playlistDialog.mounted = () => {
      setTimeout(() => {
        setTimeout(() => {
          scope.$router.setSoftKeyText('Cancel' , '', 'Save');
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
                scope.$router.hideBottomSheet();
                setTimeout(() => {
                  scope.methods.renderSoftKeyLCR();
                  INPUT.blur();
                }, 100);
              }
              break
            case 'SoftRight':
              scope.$router.hideBottomSheet();
              setTimeout(() => {
                scope.methods.renderSoftKeyLCR();
                INPUT.blur();
                scope.methods.playlistEditor(INPUT.value, id);
              }, 100);
              break
            case 'SoftLeft':
              scope.$router.hideBottomSheet();
              setTimeout(() => {
                scope.methods.renderSoftKeyLCR();
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
    scope.$router.showBottomSheet(playlistDialog);
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
      playlistEditor: function(name = '', id = null) { // TODO
        var oldName = '';
        name = name.trim();
        if (name.length === 0) {
          this.$router.showToast('Playlist name is required');
        } else {
          localforage.getItem(OLD_PLAYLIST)
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
            localforage.setItem(OLD_PLAYLIST, PLAYLIST);
          })
          .then(() => {
            return localforage.getItem(OLD_PLAYLIST);
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
        playlistEditor(this, '', null);
      },
      center: function() {
        const _selected = this.data.playlists[this.verticalNavIndex];
        if (_selected) {
          playPlaylistById(_selected.id);
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
                    DB[v].text = DB[v].title || DB[v].audio_title;
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
                      localforage.setItem(OLD_PLAYLIST, PLYLS)
                      .then(() => {
                        return localforage.getItem(OLD_PLAYLIST);
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
              playlistEditor(this, _selected.name, _selected.id);
            } else if (selected.text === 'Delete'){
              const PLYLS = this.$state.getState('PLAYLIST');
              if (PLYLS[_selected.id]) {
                this.$router.showDialog('Delete', `Are you sure to remove ${_selected.name} ?`, null, 'Yes', () => {
                  delete PLYLS[_selected.id];
                  localforage.setItem(OLD_PLAYLIST, PLYLS)
                  .then(() => {
                    return localforage.getItem(OLD_PLAYLIST);
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

  const audioMetadataEditor = function ($router, audio, isUpdate = false) {
    T_AUDIO.getItem(audio.id)
    .then((METADATA) => {
      if (METADATA != null && !isUpdate) {
       $router.showToast('Already exist inside DB');
      } else {
        $router.push(
          new Kai({
            name: 'audioEditor',
            data: {
              title: isUpdate ? (audio.title || '') : '',
              artist: isUpdate ? (audio.artist || '') : '',
              album: isUpdate ? (audio.album || '') : '',
              genre: isUpdate ? (audio.genre || '') : '',
              year: isUpdate ? (audio.year || '') : '',
              track: isUpdate ? (audio.track || '') : '',
            },
            verticalNavClass: '.audioEditorNav',
            templateUrl: document.location.origin + '/templates/audioEditor.html',
            mounted: function() {
              this.$router.setHeaderTitle(`Metadata #${audio.id}`);
            },
            unmounted: function() {},
            methods: {
              submit: function() {
                const metadata = {
                  id: audio.id,
                  audio_title: audio.audio_title || audio.title,
                  duration: audio.duration,
                  title: false,
                  artist: false,
                  album: false,
                  genre: false,
                  year: false,
                  track: false,
                  local_stream: audio.local_stream || false,
                };
                if (document.getElementById('title').value.trim().length > 0) {
                  metadata.title = document.getElementById('title').value.trim();
                }
                if (document.getElementById('artist').value.trim().length > 0) {
                  metadata.artist = document.getElementById('artist').value.trim();
                }
                if (document.getElementById('album').value.trim().length > 0) {
                  metadata.album = document.getElementById('album').value.trim();
                }
                if (document.getElementById('genre').value.trim().length > 0) {
                  metadata.genre = document.getElementById('genre').value.trim();
                }
                if (document.getElementById('year').value.trim().length > 0) {
                  try {
                    metadata.year = JSON.parse(document.getElementById('year').value.trim());
                  } catch(e){}
                }
                if (document.getElementById('track').value.trim().length > 0) {
                  try {
                    metadata.year = JSON.parse(document.getElementById('track').value.trim());
                  } catch(e){}
                }

                T_AUDIO.setItem(audio.id, metadata)
                .then((saved) => {
                  $router.showToast('Saved');
                  const list = state.getState('DATABASE');
                  list[audio.id] = metadata;
                  state.setState('DATABASE', list);
                  console.log(state.getState('DATABASE'));
                  $router.pop();
                })
                .catch((err) => {
                  console.log(err);
                  $router.showToast(err.toString());
                });
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
              var bitrate = parseInt(link.bitrate);
              if (bitrate > 999) {
                bitrate = Math.round(bitrate/1000);
              }
              link.bitrate = bitrate;
              link.text = link.mimeType + '(' + bitrate.toString() + 'kbps)';
              audio.push(link);
            }
          });
          audio.sort((a, b) => {
            if (a['bitrate'] > b['bitrate'])
              return 1;
            else if (a['bitrate'] < b['bitrate'])
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
          playMiniAudio(this.$router, selected);
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
              t.video.isAudio = true;
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
              t.video.isAudio = true;
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
        if (last && !last.isAudio) {
          this.data.results.pop();
        }
        const merged = [...this.data.results, ...videos];
        if (this.data.nextPageToken) {
          merged.push({ isAudio: false });
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
            if (selected.isAudio) {
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
          if (selected.isAudio)
            this.methods.selected(selected);
          else
            this.methods.nextPage();
        }
      },
      right: function() {
        const selected = this.data.results[this.verticalNavIndex];
        if (selected) {
          if (selected.isAudio)
            audioMetadataEditor(this.$router, selected);
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
              var bitrate = parseInt(link.bitrate);
              if (bitrate > 999) {
                bitrate = Math.round(bitrate/1000);
              }
              link.bitrate = bitrate;
              link.text = link.mimeType + '(' + bitrate.toString() + 'kbps)';
              audio.push(link);
            }
          });
          audio.sort((a, b) => {
            if (a['bitrate'] > b['bitrate'])
              return 1;
            else if (a['bitrate'] < b['bitrate'])
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
          playMiniAudio(this.$router, selected);
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
            localforage.setItem(OLD_PLAYLIST, src)
            .then(() => {
              return localforage.getItem(OLD_PLAYLIST);
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
      deleteAudio: function(video) {
        var affected = [];
        const DB = this.$state.getState('DATABASE');
        const PLYLS = this.$state.getState('PLAYLIST');
        if (DB[video.id]) {
          this.$router.showDialog('Delete', `Are you sure to remove ${video.audio_title} ?`, null, 'Yes', () => {
            for (var y in PLYLS) {
              const idx = PLYLS[y].collections.indexOf(video.id);
              if (idx > -1){
                PLYLS[y].collections.splice(idx, 1);
                affected.push(PLYLS[y].name);
              }
            }
            if (affected.length > 0) {
              localforage.setItem(OLD_PLAYLIST, PLYLS)
              .then(() => {
                return localforage.getItem(OLD_PLAYLIST);
              })
              .then((UPDATED_PLAYLIST) => {
                this.$state.setState('PLAYLIST', UPDATED_PLAYLIST);
              })
              .catch((err) => {
                console.log(err);
              });
            }
            T_AUDIO.removeItem(video.id)
            .then(() => {
              delete DB[video.id];
              this.$router.showToast('Deleted');
              this.$state.setState('DATABASE', DB);
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
          src[x].isAudio = true
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
            src[x].isAudio = true;
            if (src[x].audio_title.toLowerCase().indexOf(keyword.toLowerCase()) > -1) {
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
        if (last && !last.isAudio) {
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
          merged.push({ isAudio: false });
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
            if (selected.isAudio) {
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
          if (selected.isAudio)
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
          if (_selected.isAudio) {
            const menus = [
              { text: 'Play All' },
              { text: 'Add/Remove from Playlist' },
              { text: 'Update Metadata' },
              { text: 'Delete' },
            ]
            this.$router.showOptionMenu('Menu', menus, 'Select', (selected) => {
              if (selected.text === 'Update Metadata') {
                audioMetadataEditor(this.$router, _selected, true);
              } else if (selected.text === 'Add/Remove from Playlist') {
                this.methods.presentInPlaylist(_selected);
              } else if (selected.text === 'Delete') {
                this.methods.deleteAudio(_selected);
              } else if (selected.text === 'Play All') {
                playDefaultPlaylist();
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
            title: T.title || T.audio_title,
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
          t.text = `${i+1} - ${t.title || t.audio_title}`;
          t.idx = i;
          tracklist.push(t);
        });
        this.$router.showOptionMenu(TRACK_NAME, tracklist, 'Select', (selected) => {
          if (TRACKLIST[selected.idx]) {
            this.$state.setState('TRACKLIST_IDX', selected.idx);
            playMainAudio(selected.idx);
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
        const menus = [
          { text: 'Search' },
          { text: 'Local Database' },
          { text: 'Playlist' },
          { text: 'Preferred Mime' },
          { text: 'Clear Caches' },
          { text: 'Exit' }
        ]
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
              T_CONFIGURATION.setItem('mimeType', selected.text)
              .then((value) => {
                this.$state.setState('mimeType', value);
              });
            }, 'Cancel', null, undefined, idx);
          } else if (selected.text === 'Clear Caches') {
            T_CACHED_URL.clear()
            .finally(() => {
              this.$router.showToast('DONE');
            });
          } else if (selected.text === 'Exit') {
            window.close();
          }
        }, () => {
          setTimeout(() => {}, 100);
        }, 0);
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
          playMainAudio(move);
        }
      },
      arrowDown: function() {
        volumeDown(MAIN_PLAYER, this.$router);
      },
      arrowLeft: function() {
        const move = this.$state.getState('TRACKLIST_IDX') - 1;
        if (TRACKLIST[move]) {
          this.$state.setState('TRACKLIST_IDX', move);
          playMainAudio(move);
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
      }
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
