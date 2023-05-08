localforage.setDriver(localforage.INDEXEDDB);

var BOOT = false;
var SLEEP_TIMER = null;
var WAKE_LOCK = null;
var QR_READER = null;
const CACHED_DECRYPTOR = {};
const DEFAULT_VOLUME = 0.02;

const DB_NAME = 'YT_MUSIC';
const DB_AUDIO = 'YT_AUDIO'; // { id: { ...metadata } }
const DB_PLAYLIST = 'YT_PLAYLIST'; // { id: {name, sync, collections: []} }
const DB_CACHED_URL = 'YT_CACHED_URL'; // { id: URL }
const DB_PLAYING = 'YT_PLAYING'; //
const DB_CONFIGURATION = 'YT_CONFIGURATION';

const T_AUDIO = localforage.createInstance({
  name: DB_NAME,
  storeName: DB_AUDIO
});

const T_PLAYLIST = localforage.createInstance({
  name: DB_NAME,
  storeName: DB_PLAYLIST
});

const T_CACHED_URL = localforage.createInstance({
  name: DB_NAME,
  storeName: DB_CACHED_URL
});

const T_CONFIGURATION = localforage.createInstance({
  name: DB_NAME,
  storeName: DB_CONFIGURATION
});

var MAIN_DURATION_ELAPSED;
var MAIN_DURATION_SLIDER;
var MAIN_CURRENT_TIME;
var MAIN_DURATION;
var MAIN_THUMB;
var MAIN_TITLE;
var MAIN_PLAY_BTN;
var MAIN_BUFFERING;
var MAIN_BUFFERED;

var LFT_DBL_CLICK_TH = 0;
var LFT_DBL_CLICK_TIMER = undefined;
var RGT_DBL_CLICK_TH = 0;
var RGT_DBL_CLICK_TIMER = undefined;

if (navigator.mozAudioChannelManager) {
  navigator.mozAudioChannelManager.volumeControlChannel = 'content';
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

  const DS = new DataStorage(() => {}, () => {}, false);
  (navigator.b2g ? navigator.b2g.getDeviceStorages('sdcard') : navigator.getDeviceStorages('sdcard'))[0].get('trigger_permission');

  var TRACK_NAME = '';
  var TRACKLIST = [];
  var TRACKLIST_DEFAULT_SORT = [];

  const state = new KaiState({
    MAIN_PLAYER_DURATION: 0,
    CONFIGURATION: {},
    DATABASE: {},
    PLAYLIST: {},
    TRACKLIST_IDX: 0,
    REPEAT: -1,
    SHUFFLE: false,
    AUTOPLAY: JSON.parse(localStorage.getItem('AUTOPLAY')) || false,
    AUTOSLEEP: JSON.parse(localStorage.getItem('AUTOSLEEP')) || false,
  });

  const MAIN_PLAYER = document.createElement("audio");
  MAIN_PLAYER.volume = navigator.mozAudioChannelManager ? 1 : 0.02;
  MAIN_PLAYER.mozAudioChannelType = 'content';

  MAIN_PLAYER.onloadedmetadata = (e) => {
    state.setState('MAIN_PLAYER_DURATION', e.target.duration);
  }

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

  function toggleVolume(PLYR, $router) {
    if (navigator.mozAudioChannelManager) {
      navigator.volumeManager.requestShow();
      $router.setSoftKeyRightText('');
    } else {
      $router.setSoftKeyRightText((PLYR.volume * 100).toFixed(0) + '%');
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
    T_CONFIGURATION.setItem('SHUFFLE', SHUFFLE);
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
      TRACKLIST = JSON.parse(JSON.stringify(TRACKLIST_DEFAULT_SORT));
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
    T_CONFIGURATION.setItem('REPEAT', REPEAT);
    return REPEAT_BTN;
  }

  function init(dbg = null) {
    console.log('INIT:', dbg);
    T_CONFIGURATION.getItem('SHUFFLE')
    .then((SHUFFLE) => {
      if (SHUFFLE == null)
        SHUFFLE = false;
      state.setState('SHUFFLE', SHUFFLE);
      T_CONFIGURATION.setItem('SHUFFLE', SHUFFLE);
      localforage.getItem(DB_PLAYLIST)
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
    const kv = {}
    var done = keys.length;
    keys.forEach((key) => {
      T_CONFIGURATION.getItem(key)
      .then((value) => {
        kv[key] = value;
        done--;
        if (done <= 0 ) {
          state.setState('CONFIGURATION', kv);
          // console.log(state.getState('CONFIGURATION'));
        }
      })
      .catch((err) => {
        console.log(err);
        done--;
        if (done <= 0 ) {
          state.setState('CONFIGURATION', kv);
          console.log(state.getState('CONFIGURATION'));
        }
      });
    });
  }).catch((err) => {
    console.log(err);
  });

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

  T_PLAYLIST.keys()
  .then((keys) => {
    keys.forEach((key) => {
      T_PLAYLIST.getItem(key.toString())
      .then((value) => {
        const list = state.getState('PLAYLIST');
        list[key] = value;
        state.setState('PLAYLIST', list);
      })
    });
  })
  .catch((err) => {
    console.log(err);
  });

  function playDefaultPlaylist() {
    TRACKLIST = [];
    TRACKLIST_DEFAULT_SORT = [];
    localforage.removeItem(DB_PLAYLIST);
    state.setState('TRACKLIST_IDX', 0);
    TRACK_NAME = 'YT MUSIC';
    const tracks = state.getState('DATABASE');
    for (var y in tracks) {
      TRACKLIST.push(tracks[y]);
      TRACKLIST_DEFAULT_SORT.push(tracks[y]);
    }
    shuffling();
    playMainAudio(state.getState('TRACKLIST_IDX'));
  }

  function playPlaylistById(id) {
    T_PLAYLIST.getItem(id.toString())
    .then((result) => {
      if (result == null) {
        playDefaultPlaylist();
        return Promise.reject('Playlist not exist');
      }
      return Promise.resolve(result);
    })
    .then((playlist) => {
      const tracks = state.getState('DATABASE');
      const list = []
      playlist.collections.forEach((c) => {
        if (tracks[c]) {
          list.push(tracks[c]);
        }
      });
      state.setState('TRACKLIST_IDX', 0);
      TRACK_NAME = playlist.name;
      TRACKLIST = list;
      TRACKLIST_DEFAULT_SORT = JSON.parse(JSON.stringify(list));
      shuffling();
      playMainAudio(state.getState('TRACKLIST_IDX'));
      router.showToast(`PLAYING ${TRACK_NAME}`);
      localforage.setItem(DB_PLAYLIST, playlist.id);
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

  const qrReader = function($router, cb = () => {}) {
    $router.showBottomSheet(
      new Kai({
        name: 'qrReader',
        data: {
          title: 'qrReader'
        },
        template: `<div class="kui-flex-wrap" style="overflow:hidden!important;height:264px;"><video id="qr_video" height="320" width="240" autoplay></video></div>`,
        mounted: function() {
          navigator.mediaDevices.getUserMedia({ audio: false, video: true })
          .then((stream) => {
            const video = document.getElementById("qr_video");
            video.srcObject = stream;
            video.onloadedmetadata = (e) => {
              video.play();
              var barcodeCanvas = document.createElement("canvas");
              QR_READER = setInterval(() => {
                barcodeCanvas.width = video.videoWidth;
                barcodeCanvas.height = video.videoHeight;
                var barcodeContext = barcodeCanvas.getContext("2d");
                var imageWidth = Math.max(1, Math.floor(video.videoWidth)),imageHeight = Math.max(1, Math.floor(video.videoHeight));
                barcodeContext.drawImage(video, 0, 0, imageWidth, imageHeight);
                var imageData = barcodeContext.getImageData(0, 0, imageWidth, imageHeight);
                var idd = imageData.data;
                let code = jsQR(idd, imageWidth, imageHeight);
                if (code) {
                  cb(code.data);
                }
              }, 1000);
            };
          }).catch((err) => {
            $router.showToast(err.toString());
          });
        },
        unmounted: function() {
          if (QR_READER) {
            clearInterval(QR_READER);
            QR_READER = null;
          }
          const video = document.getElementById("qr_video");
          const stream = video.srcObject;
          const tracks = stream.getTracks();
          tracks.forEach(function (track) {
            track.stop();
          });
          video.srcObject = null;
        },
      })
    );
  }

  function downloadAudio($router, audio, cb = () => {}) {
    return new Promise((resolve, reject) => {
      $router.showLoading();
      getAudioStreamURL(audio.id)
      .then((url) => {
        // console.log(url);
        var BAR, CUR, MAX;
        var start = 0;
        var loaded = 0;
        var req = new XMLHttpRequest({ mozSystem: true });
        req.open('GET', url, true);
        req.responseType = 'blob';
        $router.showBottomSheet(
          new Kai({
            name: 'downloaderPopup',
            data: {
              title: 'downloaderPopup',
              downloading: false,
            },
            templateUrl: document.location.origin + '/templates/downloaderPopup.html',
            softKeyText: { left: 'Cancel', center: '0KB/S', right: '0%' },
            softKeyListener: {
              left: function() {
                $router.hideBottomSheet();
                req.abort();
              },
              center: function() {},
              right: function() {}
            },
            mounted: function() {
              const lock = navigator.b2g || navigator;
              WAKE_LOCK = lock.requestWakeLock('cpu');
              BAR = document.getElementById('download_bar');
              CUR = document.getElementById('download_cur');
              MAX = document.getElementById('download_max');
              req.onprogress = this.methods.onprogress;
              req.onreadystatechange = this.methods.onreadystatechange;
              req.onerror = this.methods.onerror;
              start = new Date().getTime();
              req.send();
            },
            unmounted: function() {
              if (WAKE_LOCK) {
                WAKE_LOCK.unlock();
                WAKE_LOCK = null;
              }
              resolve(audio);
              setTimeout(cb, 100);
            },
            methods: {
              onprogress: function(evt) {
                if (evt.lengthComputable) {
                  var end = new Date().getTime();
                  var elapsed = end - start;
                  start = end;
                  var percentComplete = evt.loaded / evt.total * 100;
                  const frag = evt.loaded - loaded;
                  loaded = evt.loaded;
                  const speed = (frag / elapsed) * 1000;
                  BAR.style.width = `${percentComplete.toFixed(2)}%`;
                  CUR.innerHTML = `${readableFileSize(evt.loaded, true, 2)}`;
                  $router.setSoftKeyCenterText(`${readableFileSize(Math.round(speed), true)}/s`);
                  $router.setSoftKeyRightText(BAR.style.width);
                  MAX.innerHTML = `${readableFileSize(evt.total, true, 2)}`;
                }
              },
              onreadystatechange: function(evt) {
                if (evt.currentTarget.readyState === 4) {
                  if (evt.currentTarget.response != null && evt.currentTarget.status >= 200 && evt.currentTarget.status <= 399) {
                    var ext = 'mp3';
                    if (MIME[evt.currentTarget.response.type] != null) {
                      ext = MIME[evt.currentTarget.response.type];
                    }
                    var localPath = ['ytm', 'cache'];
                    if (DS.deviceStorage.storageName != '') {
                      localPath = [DS.deviceStorage.storageName, ...localPath];
                    }
                    DS.addFile(localPath, `${audio.id}.${ext}`, evt.currentTarget.response)
                    .then((file) => {
                      audio['local_stream'] = file.name;
                      $router.setSoftKeyCenterText('SUCCESS');
                      $router.setSoftKeyLeftText('Close');
                      if (WAKE_LOCK) {
                        WAKE_LOCK.unlock();
                        WAKE_LOCK = null;
                      }
                    })
                    .catch((err) => {
                      console.log(err);
                      $router.setSoftKeyCenterText('FAIL');
                      $router.setSoftKeyLeftText('Exit');
                    });
                  }
                }
              },
              onerror: function(err) {
                console.log(err);
                $router.setSoftKeyCenterText('FAIL');
                $router.setSoftKeyRightText('Exit');
                $router.showToast('Network Error');
              }
            },
            backKeyListener: function(evt) {
              return true;
            }
          })
        );
      })
      .catch((e) => {
        $router.showToast("Stream Unavailable");
      })
      .finally(() => {
        $router.hideLoading();
      });
    });
  }

  function playMainAudioFallback(audio) {
    getCachedURL(audio.id)
    .then((url) => {
      MAIN_PLAYER.mozAudioChannelType = 'content';
      MAIN_PLAYER.src = url;
      if (state.getState('AUTOPLAY') && BOOT == false)
        MAIN_PLAYER.play();
      else if (BOOT)
        MAIN_PLAYER.play();
      BOOT = true;
    })
    .catch((err) => {
      getAudioStreamURL(audio.id)
      .then((url) => {
        MAIN_PLAYER.mozAudioChannelType = 'content';
        MAIN_PLAYER.src = url;
        if (state.getState('AUTOPLAY') && BOOT == false)
          MAIN_PLAYER.play();
        else if (BOOT)
          MAIN_PLAYER.play();
        BOOT = true;
      })
      .catch((err) => {
        console.log(err);
      });
    });
  }

  function playMainAudio(idx) {
    if (TRACKLIST[idx] == null) {
      return;
    }
    if (TRACKLIST[idx].local_stream) {
      DS.__getFile__(TRACKLIST[idx].local_stream)
      .then((file) => {
        MAIN_PLAYER.mozAudioChannelType = 'content';
        MAIN_PLAYER.src = window.URL.createObjectURL(file);
        if (state.getState('AUTOPLAY') && BOOT == false)
          MAIN_PLAYER.play();
        else if (BOOT)
          MAIN_PLAYER.play();
        BOOT = true;
      })
      .catch((err) => {
        playMainAudioFallback(TRACKLIST[idx]);
        console.warn("Unable to get the file: " + err.toString());
      });
    } else {
      playMainAudioFallback(TRACKLIST[idx]);
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

    var PLAY_BTN, DURATION_SLIDER, CURRENT_TIME, DURATION, DURATION_ELAPSED, BUFFERED;
    const MINI_PLAYER = document.createElement("audio");
    MINI_PLAYER.volume = navigator.mozAudioChannelManager ? 1 : 0.02;
    MINI_PLAYER.mozAudioChannelType = 'content';

    $router.showBottomSheet(
      new Kai({
        name: 'miniPlayer',
        data: {
          title: 'miniPlayer',
          duration: 0,
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

          DURATION_ELAPSED = document.getElementById('duration_elapsed');
          DURATION_SLIDER = document.getElementById('duration_slider');
          CURRENT_TIME = document.getElementById('current_time');
          DURATION = document.getElementById('duration');
          PLAY_BTN = document.getElementById('play_btn');
          BUFFERED = document.getElementById('duration_buffered');
          MINI_PLAYER.addEventListener('loadedmetadata', this.methods.onloadedmetadata);
          MINI_PLAYER.addEventListener('timeupdate', this.methods.ontimeupdate);
          MINI_PLAYER.addEventListener('pause', this.methods.onpause);
          MINI_PLAYER.addEventListener('play', this.methods.onplay);
          MINI_PLAYER.addEventListener('seeking', this.methods.onseeking);
          MINI_PLAYER.addEventListener('seeked', this.methods.onseeked);
          MINI_PLAYER.addEventListener('ratechange', this.methods.onratechange);
          MINI_PLAYER.addEventListener('ended', this.methods.onended);
          MINI_PLAYER.addEventListener('error', this.methods.onerror);
          document.addEventListener('keydown', this.methods.onKeydown);
          // console.log('miniPlayer:', url);
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
          MINI_PLAYER.removeEventListener('ratechange', this.methods.onratechange);
          MINI_PLAYER.removeEventListener('ended', this.methods.onended);
          MINI_PLAYER.removeEventListener('error', this.methods.onerror);
          document.removeEventListener('keydown', this.methods.onKeydown);
        },
        methods: {
          onloadedmetadata: function(evt) {
            MINI_PLAYER.fastSeek(0);
            this.data.duration = evt.target.duration;
            DURATION.innerHTML = convertTime(evt.target.duration);
          },
          ontimeupdate: function(evt) {
            const duration = this.data.duration || 1;
            const value = ((evt.target.currentTime / duration) * 100).toFixed(2);
            var currentTime = evt.target.currentTime;
            CURRENT_TIME.innerHTML = convertTime(evt.target.currentTime);
            DURATION_SLIDER.style.marginLeft = `${value}%`;
            DURATION_ELAPSED.style.width = `${value}%`;
            if (MINI_PLAYER.buffered.length > 0) {
              const value = (MINI_PLAYER.buffered.end(MINI_PLAYER.buffered.length - 1) / duration) * 100;
              BUFFERED.style.width = `${(value+5).toFixed(2)}%`;
            }
          },
          onpause: function() {
            PLAY_BTN.src = '/icons/img/play.png';
          },
          onplay: function() {
            PLAY_BTN.src = '/icons/img/pause.png';
          },
          onseeking: function(evt) {
            $router.showLoading(false);
            const duration = this.data.duration || 1;
            const value = ((evt.target.currentTime / duration) * 100).toFixed(2);
            CURRENT_TIME.innerHTML = convertTime(evt.target.currentTime);
            DURATION_SLIDER.style.marginLeft = `${value}%`;
          },
          onseeked: function(evt) {
            $router.hideLoading();
          },
          onratechange: function() {
            $router.setSoftKeyCenterText(`${MINI_PLAYER.playbackRate}x`);
          },
          onended: function() {
            PLAY_BTN.src = '/icons/img/play.png';
          },
          onerror: function (evt) {
            MINI_PLAYER.pause();
            console.log(evt);
            PLAY_BTN.src = '/icons/img/play.png';
            if (evt.target.error.code === 4) {
              $router.showToast('Please clear caches');
            } else {
              $router.showToast('Error');
            }
          },
          onKeydown: function (evt) {
            switch (evt.key) {
              case '2':
                if (MINI_PLAYER.playbackRate >= 4)
                  return
                MINI_PLAYER.playbackRate += 0.25;
                break;
              case '5':
                MINI_PLAYER.playbackRate = 1;
                break;
              case '8':
                if (MINI_PLAYER.playbackRate <= 0.5)
                  return
                MINI_PLAYER.playbackRate -= 0.25;
                break;
            }
          }
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

  const keypadshorcuts = new Kai({
    name: 'keypadshorcuts',
    data: {
      title: 'keypadshorcuts'
    },
    templateUrl: document.location.origin + '/templates/keypadshorcuts.html',
    mounted: function() {
      this.$router.setHeaderTitle('Keypad Shorcuts');
    },
    unmounted: function() {},
    methods: {},
    softKeyText: { left: '', center: '', right: '' },
    softKeyListener: {
      left: function() {},
      center: function() {},
      right: function() {}
    }
  });

  const settings = new Kai({
    name: 'settings',
    data: {
      title: 'settings',
      autoplay: false,
      autosleep: false,
    },
    verticalNavClass: '.settingNav',
    templateUrl: document.location.origin + '/templates/settings.html',
    mounted: function() {
      this.$router.setHeaderTitle('Settings');
      this.methods.listenState(this.$state.getState());
      this.$state.addGlobalListener(this.methods.listenState);
      this.methods.renderSoftKeyText();
    },
    unmounted: function() {
      this.$state.removeGlobalListener(this.methods.listenState);
    },
    methods: {
      listenState: function(data) {
        const obj = {};
        if (data['AUTOSLEEP'] != null) {
          obj['autosleep'] = JSON.parse(data['AUTOSLEEP']);
        }
        if (data['AUTOPLAY'] != null) {
          obj['autoplay'] = JSON.parse(data['AUTOPLAY']);
        }
        this.setData(obj);
      },
      changeAutoSleep: function() {
        const choices = [
          { 'text': 'Off', value: false },
          { 'text': '1 Minutes(TEST)', value: 1 },
          { 'text': '10 Minutes', value: 10 },
          { 'text': '20 Minutes', value: 20 },
          { 'text': '30 Minutes', value: 30 },
          { 'text': '40 Minutes', value: 40 },
          { 'text': '50 Minutes', value: 50 },
          { 'text': '60 Minutes', value: 60 },
        ]
        const idx = choices.findIndex((opt) => {
          return opt.value === this.data.autosleep;
        });
        this.$router.showOptionMenu('Sleep Timer', choices, 'SELECT', (selected) => {
          const value = JSON.parse(selected.value);
          localStorage.setItem('AUTOSLEEP', value);
          this.$state.setState('AUTOSLEEP', JSON.parse(localStorage.getItem('AUTOSLEEP')));
        }, this.methods.renderSoftKeyText, idx);
      },
      changeAutoPlay: function() {
        const value = !this.data.autoplay;
        localStorage.setItem('AUTOPLAY', value);
        this.$state.setState('AUTOPLAY', JSON.parse(localStorage.getItem('AUTOPLAY')));
      },
      renderSoftKeyText: function() {
        setTimeout(() => {
          if (this.verticalNavIndex == 2) {
            this.$router.setSoftKeyText('Clear', 'SET', 'Show');
          } else if (this.verticalNavIndex == 3) {
            this.$router.setSoftKeyText('Clear', 'SET', 'Show');
          } else {
            this.$router.setSoftKeyText('', 'SELECT', '');
          }
        }, 100);
      }
    },
    softKeyText: { left: '', center: 'SELECT', right: '' },
    softKeyListener: {
      left: function() {},
      center: function() {
        const listNav = document.querySelectorAll(this.verticalNavClass);
        if (this.verticalNavIndex > -1) {
          listNav[this.verticalNavIndex].click();
        }
      },
      right: function() {}
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
        this.methods.renderSoftKeyText();
      },
      arrowDown: function() {
        this.navigateListNav(1);
        this.methods.renderSoftKeyText();
      }
    }
  });

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
      playlistEditor: function(name = '', id = new Date().getTime()) {
        var isUpdate = false;
        var oldName = '';
        name = name.toString().trim();
        if (name.length === 0) {
          this.$router.showToast('Playlist name is required');
        } else {
          T_PLAYLIST.getItem(id.toString())
          .then((playlist) => {
            if (playlist == null) {
              playlist = { id: id, name: name, sync: false, collections: [] };
            } else {
              isUpdate = true;
              oldName = playlist.name;
              playlist.name = name;
            }
            return T_PLAYLIST.setItem(id.toString(), playlist);
          })
          .then((saved) => {
            var msg = `${name} added to Playlist`;
            if (isUpdate) {
              msg = `${oldName} updated to ${name}`;
            }
            this.$router.showToast(msg);
            const PLAYLIST = state.getState('PLAYLIST');
            PLAYLIST[saved.id] = saved;
            state.setState('PLAYLIST', PLAYLIST);
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
        playlistEditor(this, '', new Date().getTime());
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
          var menus = [
            { text: 'Tracklist' },
            { text: 'Rename' },
            { text: 'Delete' },
          ]
          if (_selected.sync) {
            menus = [{ text: 'Sync' }, ...menus];
          }
          this.$router.showOptionMenu('Action', menus, 'Select', (selected) => {
            if (selected.text === 'Tracklist') {
              const DB = this.$state.getState('DATABASE');
              const PLAYLIST = this.$state.getState('PLAYLIST');
              const cur = PLAYLIST[_selected.id];
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
                      PLAYLIST[_selected.id].collections = _tracklist;
                      T_PLAYLIST.setItem(_selected.id.toString(), PLAYLIST[_selected.id])
                      .then((saved) => {
                        this.$router.showToast('DONE');
                        this.$state.setState('PLAYLIST', PLAYLIST);
                        this.methods.getPlaylist();
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
            } else if (selected.text === 'Rename') {
              playlistEditor(this, _selected.name, _selected.id);
            } else if (selected.text === 'Delete'){
              const PLAYLIST = this.$state.getState('PLAYLIST');
              if (PLAYLIST[_selected.id]) {
                this.$router.showDialog('Delete', `Are you sure to remove ${_selected.name} ?`, null, 'Yes', () => {
                  delete PLAYLIST[_selected.id];
                  T_PLAYLIST.removeItem(_selected.id.toString())
                  .then(() => {
                    this.$router.showToast(`${_selected.name} deleted`);
                    this.$state.setState('PLAYLIST', PLAYLIST);
                    this.verticalNavIndex -= 1;
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
            } else if (selected.text === 'Sync') {
              // exclude current collections
              console.log('SYNC', _selected.collections);
              const playlistId = _selected.sync;
              const DB = this.$state.getState('DATABASE');
              const PLAYLIST = this.$state.getState('PLAYLIST');
              if (PLAYLIST[playlistId] == null) {
                this.$router.showToast(`Playlist ID not exist`);
                return;
              }
              this.$router.showLoading();
              getPlaylistVideos(playlistId)
              .then((result) => {
                setTimeout(() => {
                  result = result.filter((v) => {
                    if (_selected.collections.indexOf(v.id) === -1) {
                      v.checked = true;
                      v.text = v.title;
                      return true;
                    }
                    return false;
                  });
                  if (result.length === 0) {
                    this.$router.showToast('Up-to-date');
                    return;
                  }
                  this.$router.showMultiSelector(`Sync Playlist(${result.length})`, result, 'Select', null, 'Save', (list) => {
                    const playlist = _selected;
                    const audio = {};
                    list.forEach((i) => {
                      if (i.checked && DB[i.id] == null) {
                        playlist.collections.push(i.id);
                        audio[i.id] = {
                          id: i.id,
                          audio_title: i.title,
                          duration: false,
                          title: false,
                          artist: false,
                          album: false,
                          genre: false,
                          year: false,
                          track: false,
                          local_stream: false,
                        }
                      } else if (i.checked && DB[i.id]) {
                        playlist.collections.push(i.id);
                      }
                    });
                    if (playlist.collections.length === 0) {
                      this.$router.showToast('No track selected');
                      return;
                    }
                    var success = 0;
                    var done = Object.keys(audio).length;
                    if (done === 0) {
                      T_PLAYLIST.setItem(playlistId.toString(), playlist)
                      .then((savedPlaylist) => {
                        PLAYLIST[playlistId] = savedPlaylist;
                        this.$state.setState('PLAYLIST', PLAYLIST);
                        console.log('1 PLAYLIST SUCCESS:', playlistId, success);
                        this.$router.showToast('SYNC Success');
                        this.methods.getPlaylist();
                      });
                      return;
                    }
                    for (var x in audio) {
                      T_AUDIO.setItem(x, audio[x])
                      .then((savedAudio) => {
                        success++;
                        done--;
                        if (done === 0) {
                          if (success === Object.keys(audio).length) {
                            T_PLAYLIST.setItem(playlistId.toString(), playlist)
                            .then((savedPlaylist) => {
                              PLAYLIST[playlistId] = savedPlaylist;
                              Object.assign(DB, audio);
                              this.$state.setState('PLAYLIST', PLAYLIST);
                              this.$state.setState('DATABASE', DB);
                              console.log('2 PLAYLIST SUCCESS:', playlistId, success);
                              this.$router.showToast('SYNC Success');
                              this.methods.getPlaylist();
                            });
                          } else {
                            console.log('1 PLAYLIST FAIL:', playlistId, success);
                          }
                        }
                      })
                      .catch((err) => {
                        console.log(err);
                        done--;
                        if (done === 0) {
                          console.log('2 PLAYLIST FAIL:', playlistId, success);
                        }
                      });
                    }
                  }, 'Cancel', null, () => {}, 0);
                }, 100);
              })
              .catch((err) => {
                console.log(err);
                if (typeof err === 'string') {
                  this.$router.showToast(err);
                } else {
                  this.$router.showToast('Network Error');
                }
              })
              .finally(() => {
                this.$router.hideLoading();
              });
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
                  $router.pop();
                  setTimeout(() => {
                    state.setState('DATABASE', list);
                  }, 103);
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
      empty: true,
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
          var audios = [];
          data.results.forEach((t) => {
            if (t.video) {
              t.video.isAudio = true;
              audios.push(t.video);
            }
          });
          this.setData({
            results: [],
            key: data.key,
            estimatedResults: data.estimatedResults,
            nextPageToken: data.nextPageToken || null,
          });
          this.methods.processResult(audios);
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
          var audios = [];
          data.results.forEach((t) => {
            if (t.video) {
              t.video.isAudio = true;
              audios.push(t.video);
            }
          });
          this.setData({
            key: data.key,
            estimatedResults: data.estimatedResults,
            nextPageToken: data.nextPageToken || null,
          });
          this.methods.processResult(audios);
        })
        .catch((err) => {
          console.log(err.toString());
        })
        .finally(() => {
          this.$router.hideLoading();
        });
      },
      processResult: function(audios) {
        const last = this.data.results[this.data.results.length - 1];
        if (last && !last.isAudio) {
          this.data.results.pop();
        }
        const merged = [...this.data.results, ...audios];
        if (this.data.nextPageToken) {
          merged.push({ isAudio: false });
        }
        this.setData({ results: merged, empty: merged.length === 0 });
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
      empty: true,
      perPage: 50,
      nextPage: null
    },
    verticalNavClass: '.searchNav',
    templateUrl: document.location.origin + '/templates/search.html',
    mounted: function() {
      this.$state.addStateListener('DATABASE', this.methods.dbStateListener);
      this.$router.setHeaderTitle('Local Audio Database');
      if (this.data.results.length === 0) {
        this.methods.resetSearch();
      }
      this.methods.renderSoftKeyLCR();
    },
    unmounted: function() {
      this.$state.removeStateListener('DATABASE', this.methods.dbStateListener);
    },
    methods: {
      dbStateListener: function(db) {
        this.$router.showLoading();
        const temp = this.data.results;
        const item = temp[this.verticalNavIndex];
        Object.assign(item, db[item.id]);
        temp[this.verticalNavIndex] = item;
        this.setData({ results: temp, empty: temp.length === 0 });
        this.$router.hideLoading();
      },
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
        }, () => {
          setTimeout(() => {
            this.methods.renderSoftKeyLCR();
          }, 100);
        }, 0);
      },
      presentInPlaylist: function(audio) {
        var _playlist = []
        const PLAYLIST = this.$state.getState('PLAYLIST');
        for (var y in PLAYLIST) {
          var checked = false;
          if (PLAYLIST[y].collections.indexOf(audio.id) > -1) {
            checked = true;
          }
          _playlist.push({ "text": PLAYLIST[y].name, "id": PLAYLIST[y].id, "checked": checked });
        }
        if (_playlist.length === 0) {
          this.$router.showToast("Empty Playlist");
        } else {
          this.$router.showMultiSelector('Playlist', _playlist, 'Select', null, 'Save', (cursor) => {
            cursor.forEach((p) => {
              const idx = PLAYLIST[p.id].collections.indexOf(audio.id);
              if (p.checked) {
                if (idx === -1){
                  PLAYLIST[p.id].collections.push(audio.id);
                }
              } else {
                if (idx > -1){
                  PLAYLIST[p.id].collections.splice(idx, 1);
                }
              }
            });
            var done = Object.keys(PLAYLIST).length;
            for (var key in PLAYLIST) {
              T_PLAYLIST.setItem(key, PLAYLIST[key])
              .finally(() => {
                done--;
                if (done === 0) {
                  this.$state.setState('PLAYLIST', PLAYLIST);
                  this.$router.showToast('DONE');
                }
              });
            }
          }, 'Cancel', null, () => {
            setTimeout(() => {
              this.methods.renderSoftKeyLCR();
            }, 100);
          }, 0);
        }
      },
      deleteAudio: function(audio) {
        var playlists = [];
        const DB = this.$state.getState('DATABASE');
        const PLAYLIST = this.$state.getState('PLAYLIST');
        if (DB[audio.id]) {
          this.$router.showDialog('Delete', `Are you sure to remove ${audio.audio_title} ?`, null, 'Yes', () => {
            for (var y in PLAYLIST) {
              const idx = PLAYLIST[y].collections.indexOf(audio.id);
              if (idx > -1){
                PLAYLIST[y].collections.splice(idx, 1);
                playlists.push(PLAYLIST[y]);
              }
            }
            if (playlists.length > 0) {
              playlists.forEach((cursor) => {
                T_PLAYLIST.setItem(cursor.id.toString(), cursor);
              });
              this.$state.setState('PLAYLIST', PLAYLIST);
            }
            T_AUDIO.removeItem(audio.id)
            .then(() => {
              delete DB[audio.id];
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
        this.methods.nextPage(0);
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
          this.methods.nextPage(0);
        }
      },
      nextPage: function(page = 0) {
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
        this.setData({ results: merged, empty: merged.length === 0 });
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
            this.methods.nextPage(this.data.nextPage);
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
              { text: _selected.local_stream ? 'Remove Audio' : 'Download Audio' },
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
              } else if (selected.text === 'Download Audio') {
                downloadAudio(this.$router, JSON.parse(JSON.stringify(_selected)), this.methods.renderSoftKeyLCR)
                .then((downloaded) => {
                  delete downloaded['isAudio'];
                  if (downloaded['local_stream']) {
                    T_AUDIO.getItem(downloaded['id'].toString())
                    .then((cur) => {
                      if (cur != null) {
                        cur[['local_stream']] = downloaded['local_stream'];
                        return T_AUDIO.setItem(downloaded['id'].toString(), cur);
                      }
                      return Promise.reject('Audio ID not exist');
                    })
                    .then((saved) => {
                      const DB = this.$state.getState('DATABASE');
                      DB[saved.id] = saved;
                      this.$state.setState('DATABASE', DB);
                    })
                    .catch((err) => {
                      console.log(err);
                    });
                  }
                })
                .finally(() => {
                  setTimeout(() => {
                    this.methods.renderSoftKeyLCR();
                  }, 100);
                })
              } else if (selected.text === 'Remove Audio') {
                const path = _selected['local_stream'].split('/');
                if (path[0] == '') {
                  path.splice(0, 1);
                }
                const name = path.pop();
                DS.deleteFile(path, name, true)
                .then(() => {
                  T_AUDIO.getItem(_selected['id'].toString())
                  .then((cur) => {
                    if (cur != null) {
                      cur[['local_stream']] = false;
                      return T_AUDIO.setItem(_selected['id'].toString(), cur);
                    }
                    return Promise.reject('Audio ID not exist');
                  })
                  .then((saved) => {
                    const DB = this.$state.getState('DATABASE');
                    DB[saved.id] = saved;
                    this.$state.setState('DATABASE', DB);
                  })
                  .catch((err) => {
                    console.log(err);
                  });
                })
                .catch((err) => {
                  console.log(err);
                });
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
      title: 'YT Music'
    },
    templateUrl: document.location.origin + '/templates/home.html',
    mounted: function() {
      this.$router.setHeaderTitle('YT Music');

      MAIN_DURATION_ELAPSED = document.getElementById('main_duration_elapsed');
      MAIN_DURATION_SLIDER = document.getElementById('main_duration_slider');
      MAIN_CURRENT_TIME = document.getElementById('main_current_time');
      MAIN_DURATION = document.getElementById('main_duration');
      MAIN_THUMB = document.getElementById('main_thumb');
      MAIN_TITLE = document.getElementById('main_title');
      MAIN_PLAY_BTN = document.getElementById('main_play_btn');
      MAIN_BUFFERING = document.getElementById('thumb_buffering');
      MAIN_BUFFERED = document.getElementById('main_duration_buffered');
      MAIN_CURRENT_TIME.innerHTML = convertTime(MAIN_PLAYER.currentTime);

      MAIN_PLAYER.addEventListener('loadedmetadata', this.methods.onloadedmetadata);
      MAIN_PLAYER.addEventListener('timeupdate', this.methods.ontimeupdate);
      MAIN_PLAYER.addEventListener('pause', this.methods.onpause);
      MAIN_PLAYER.addEventListener('play', this.methods.onplay);
      MAIN_PLAYER.addEventListener('seeking', this.methods.onseeking);
      MAIN_PLAYER.addEventListener('seeked', this.methods.onseeked);
      MAIN_PLAYER.addEventListener('ratechange', this.methods.onratechange);
      MAIN_PLAYER.addEventListener('ended', this.methods.onended);
      MAIN_PLAYER.addEventListener('error', this.methods.onerror);
      document.addEventListener('keydown', this.methods.onKeydown);

      MAIN_DURATION.innerHTML = convertTime(this.$state.getState('MAIN_PLAYER_DURATION'));

      this.$state.addStateListener('TRACKLIST_IDX', this.methods.listenTrackChange);
      this.methods.listenTrackChange(this.$state.getState('TRACKLIST_IDX'));

      T_CONFIGURATION.getItem('REPEAT')
      .then((val) => {
        if (val != null) {
          var REPEAT = val - 1;
          this.$state.setState('REPEAT', REPEAT);
          var style = toggleRepeat();
          const r = document.getElementById('main_repeat');
          r.className = style.classList;
          r.src = style.src;
        }
      });

      T_CONFIGURATION.getItem('SHUFFLE')
      .then((val) => {
        const s = document.getElementById('main_shuffle');
        if (val != null && val) {
          s.className = '';
        } else {
          s.className = 'inactive';
        }
      });

      if (TRACKLIST.length === 0)
        MAIN_BUFFERING.style.visibility = 'hidden';

      this.methods.togglePlayIcon();
    },
    unmounted: function() {
      this.$state.removeStateListener('TRACKLIST_IDX', this.methods.listenTrackChange);
      MAIN_PLAYER.removeEventListener('loadedmetadata', this.methods.onloadedmetadata);
      MAIN_PLAYER.removeEventListener('timeupdate', this.methods.ontimeupdate);
      MAIN_PLAYER.removeEventListener('pause', this.methods.onpause);
      MAIN_PLAYER.removeEventListener('play', this.methods.onplay);
      MAIN_PLAYER.removeEventListener('seeking', this.methods.onseeking);
      MAIN_PLAYER.removeEventListener('seeked', this.methods.onseeked);
      MAIN_PLAYER.removeEventListener('ratechange', this.methods.onratechange);
      MAIN_PLAYER.removeEventListener('ended', this.methods.onended);
      MAIN_PLAYER.removeEventListener('error', this.methods.onerror);
      document.removeEventListener('keydown', this.methods.onKeydown);
    },
    methods: {
      togglePlayIcon: function() {
        if (MAIN_PLAYER.duration > 0 && !MAIN_PLAYER.paused) {
          MAIN_PLAY_BTN.src = '/icons/img/baseline_pause_circle_filled_white_36dp.png';
        } else {
          MAIN_PLAY_BTN.src = '/icons/img/baseline_play_circle_filled_white_36dp.png';
        }
      },
      onloadedmetadata: function(evt) {
        MAIN_BUFFERING.style.visibility = 'hidden';
        MAIN_DURATION.innerHTML = convertTime(evt.target.duration);
      },
      ontimeupdate: function(evt) {
        const duration = this.$state.getState('MAIN_PLAYER_DURATION') || 1;
        const value = ((evt.target.currentTime / duration) * 100).toFixed(2);
        MAIN_CURRENT_TIME.innerHTML = convertTime(evt.target.currentTime);
        MAIN_DURATION_SLIDER.style.marginLeft = `${value}%`;
        MAIN_DURATION_ELAPSED.style.width = `${value}%`;
        MAIN_PLAY_BTN.src = '/icons/img/baseline_pause_circle_filled_white_36dp.png';
        if (MAIN_PLAYER.buffered.length > 0) {
          const value = (MAIN_PLAYER.buffered.end(MAIN_PLAYER.buffered.length - 1) / duration) * 100;
          MAIN_BUFFERED.style.width = `${(value+5).toFixed(2)}%`;
        }
        // console.log('ontimeupdate', evt.target.duration); // weird behaviour ¯\_(ツ)_/¯
      },
      onpause: function() {
        MAIN_PLAY_BTN.src = '/icons/img/baseline_play_circle_filled_white_36dp.png';
      },
      onplay: function() {
        MAIN_PLAY_BTN.src = '/icons/img/baseline_pause_circle_filled_white_36dp.png';
      },
      onseeking: function(evt) {
        MAIN_BUFFERING.style.visibility = 'visible';
        const duration = this.$state.getState('MAIN_PLAYER_DURATION') || 1;
        const value = ((evt.target.currentTime / duration) * 100).toFixed(2);
        MAIN_CURRENT_TIME.innerHTML = convertTime(evt.target.currentTime);
        MAIN_DURATION_SLIDER.style.marginLeft = `${value}%`;
      },
      onseeked: function(evt) {
        MAIN_BUFFERING.style.visibility = 'hidden';
      },
      onratechange: function() {
        if (this.$router.stack.bottomSheet === false)
          this.$router.setSoftKeyCenterText(`${MAIN_PLAYER.playbackRate}x`);
      },
      onended: function() {
        MAIN_PLAY_BTN.src = '/icons/img/baseline_play_circle_filled_white_36dp.png';
      },
      onerror: function (evt) {
        if (evt.target.error.code === 4) {
          const idx = this.$state.getState('TRACKLIST_IDX');
          if (TRACKLIST[idx]) {
            T_CACHED_URL.removeItem(TRACKLIST[idx].id)
            .finally(() => {
              playMainAudio(idx);
            });
          }
        }
        MAIN_PLAYER.pause();
        MAIN_PLAY_BTN.src = '/icons/play.png';
        this.$router.showToast('Error & Retry');
      },
      listenTrackChange: function(val) {
        const T = TRACKLIST[val];
        if (T) {
          MAIN_BUFFERING.style.visibility = 'hidden';
          MAIN_TITLE.innerHTML = T.title || T.audio_title;
          MAIN_THUMB.style.backgroundImage = `url('https://i.ytimg.com/vi/${T.id}/2.jpg')`;
          document.getElementById('main_artist').innerHTML = T.artist || 'UNKNOWN';
          document.getElementById('main_album').innerHTML = T.album || 'UNKNOWN';
          document.getElementById('main_genre').innerHTML = T.genre || 'UNKNOWN';
          document.getElementById('main_list').innerHTML = `${(val + 1).toString()}/${TRACKLIST.length.toString()}`;
        }
      },
      onKeydown: function (evt) {
        switch (evt.key) {
          case '1':
            var threshold = new Date().getTime() - LFT_DBL_CLICK_TH;
            if (threshold > 0 && threshold <= 300) {
              clearTimeout(LFT_DBL_CLICK_TIMER);
              LFT_DBL_CLICK_TH = 0;
              MAIN_PLAYER.fastSeek(MAIN_PLAYER.currentTime - 10);
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
              MAIN_PLAYER.fastSeek(MAIN_PLAYER.currentTime + 10);
            } else {
              RGT_DBL_CLICK_TH = new Date().getTime();
              RGT_DBL_CLICK_TIMER = setTimeout(() => {
                if (RGT_DBL_CLICK_TH !== 0) {
                  RGT_DBL_CLICK_TH = 0;
                }
              }, 500);
            }
            break;
          case '2':
            if (MAIN_PLAYER.playbackRate >= 4)
              return
            MAIN_PLAYER.playbackRate += 0.25;
            break;
          case '5':
            MAIN_PLAYER.playbackRate = 1;
            break;
          case '8':
            if (MAIN_PLAYER.playbackRate <= 0.5)
              return
            MAIN_PLAYER.playbackRate -= 0.25;
            break;
          case '*':
            var style = toggleRepeat(this.$router);
            const r = document.getElementById('main_repeat');
            r.className = style.classList;
            r.src = style.src;
            break;
          case '#':
            var style = toggleShuffle(this.$router);
            const s = document.getElementById('main_shuffle');
            s.className = style.classList;
            break;
        }
      },
      importPlaylist: function (playlistId) {
        this.$router.hideBottomSheet();
        // const playlistId = 'PLLsua0MU5Y8LkBQmQWsjYPiLraLx7MXzl';
        const DB = this.$state.getState('DATABASE');
        const PLAYLIST = this.$state.getState('PLAYLIST');
        if (PLAYLIST[playlistId] != null) {
          this.$router.showToast(`Please sync ${PLAYLIST[playlistId].name}`);
          return;
        }
        this.$router.showLoading();
        getPlaylistVideos(playlistId)
        .then((result) => {
          setTimeout(() => {
            result.forEach((v) => {
              v.checked = true;
              v.text = v.title;
            });
            this.$router.showMultiSelector(`Import Playlist(${result.length})`, result, 'Select', null, 'Save', (list) => {
              const playlist = { id: playlistId, name: playlistId, sync: playlistId, collections: [] };
              const audio = {};
              list.forEach((i) => {
                if (i.checked && DB[i.id] == null) {
                  playlist.collections.push(i.id);
                  audio[i.id] = {
                    id: i.id,
                    audio_title: i.title,
                    duration: false,
                    title: false,
                    artist: false,
                    album: false,
                    genre: false,
                    year: false,
                    track: false,
                    local_stream: false,
                  }
                } else if (i.checked && DB[i.id]) {
                  playlist.collections.push(i.id);
                }
              });
              if (playlist.collections.length === 0) {
                this.$router.showToast('No track selected');
                return;
              }
              var success = 0;
              var done = Object.keys(audio).length;
              if (done === 0) {
                T_PLAYLIST.setItem(playlistId.toString(), playlist)
                .then((savedPlaylist) => {
                  PLAYLIST[playlistId] = savedPlaylist;
                  this.$state.setState('PLAYLIST', PLAYLIST);
                  console.log('1 PLAYLIST SUCCESS:', playlistId, success);
                  this.$router.showToast('IMPORT Success');
                });
                return;
              }
              for (var x in audio) {
                T_AUDIO.setItem(x, audio[x])
                .then((savedAudio) => {
                  success++;
                  done--;
                  if (done === 0) {
                    if (success === Object.keys(audio).length) {
                      T_PLAYLIST.setItem(playlistId.toString(), playlist)
                      .then((savedPlaylist) => {
                        PLAYLIST[playlistId] = savedPlaylist;
                        Object.assign(DB, audio);
                        this.$state.setState('PLAYLIST', PLAYLIST);
                        this.$state.setState('DATABASE', DB);
                        console.log('2 PLAYLIST SUCCESS:', playlistId, success);
                        this.$router.showToast('IMPORT Success');
                      });
                    } else {
                      console.log('1 PLAYLIST FAIL:', playlistId, success);
                    }
                  }
                })
                .catch((err) => {
                  console.log(err);
                  done--;
                  if (done === 0) {
                    console.log('2 PLAYLIST FAIL:', playlistId, success);
                  }
                });
              }
            }, 'Cancel', null, () => {}, 0);
          }, 100);
        })
        .catch((err) => {
          console.log(err);
          if (typeof err === 'string') {
            this.$router.showToast(err);
          } else {
            this.$router.showToast('Network Error');
          }
        })
        .finally(() => {
          this.$router.hideLoading();
        });
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
        if (tracklist.length === 0)
          return;
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
          { text: 'Local Audio Database' },
          { text: 'Playlist' },
          { text: 'Import Youtube Playlist ID' },
          { text: 'Preferred Mime' },
          { text: 'Clear Caches' },
          { text: 'Keypad Shorcuts' },
          { text: 'Settings' },
          { text: 'Exit' }
        ]
        this.$router.showOptionMenu('Menu', menus, 'Select', (selected) => {
          if (selected.text === 'Search') {
            this.$router.push('search');
          } else if (selected.text == 'Disable Equalizer' || selected.text == 'Enable Equalizer') {
            changeEqStatus();
          } else if (selected.text === 'Local Audio Database') {
            this.$router.push('database');
          } else if (selected.text === 'Playlist') {
            this.$router.push('playlist');
          } else if (selected.text === 'Preferred Mime') {
            const CONFIG = this.$state.getState('CONFIGURATION');
            const match = CONFIG['mimeType'];
            const opts = [
              { "text": "audio", "checked": match === "audio" },
              { "text": "audio/webm", "checked": match === "audio/webm" },
              { "text": "audio/mp4", "checked": match === "audio/mp4" }
            ];
            const idx = opts.findIndex((opt) => {
              return opt.text === match;
            });
            this.$router.showSingleSelector('Preferred Mime', opts, 'Select', (selected) => {
              T_CONFIGURATION.setItem('mimeType', selected.text)
              .then((value) => {
                CONFIG['mimeType'] = value;
                this.$state.setState('CONFIGURATION', CONFIG);
              });
            }, 'Cancel', null, undefined, idx);
          } else if (selected.text === 'Clear Caches') {
            T_CACHED_URL.clear()
            .finally(() => {
              this.$router.showToast('DONE');
            });
          } else if (selected.text === 'Settings') {
            this.$router.push('settings');
          } else if (selected.text === 'Import Youtube Playlist ID') {
            if (navigator.mediaDevices) {
              navigator.mediaDevices.getUserMedia({ audio: false, video: true })
              .then(() => {
                qrReader(this.$router, (playlistId) => {
                  if (playlistId !== null) {
                    this.methods.importPlaylist(playlistId);
                  }
                });
              })
              .catch((err) => {
                console.log(err);
                this.$router.showToast('Please grant the permission for camera/video');
              });
            } else {
              this.$router.showToast('No mediaDevices');
            }
          } else if (selected.text === 'Keypad Shorcuts') {
            this.$router.push('keypadshorcuts');
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
      },
      'settings': {
        name: 'settings',
        component: settings
      },
      'keypadshorcuts': {
        name: 'keypadshorcuts',
        component: keypadshorcuts
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

  document.addEventListener('visibilitychange', (evt) => {
    if (document.visibilityState === 'visible') {
      if (SLEEP_TIMER != null) {
        clearTimeout(SLEEP_TIMER);
        SLEEP_TIMER = null;
      }
    } else {
      if (state.getState('AUTOSLEEP') !== false && typeof state.getState('AUTOSLEEP') === 'number' && WAKE_LOCK == null) {
        SLEEP_TIMER = setTimeout(() => {
          window.close();
        }, state.getState('AUTOSLEEP') * 60 * 1000);
      }
    }
  });
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
