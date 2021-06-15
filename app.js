localforage.setDriver(localforage.LOCALSTORAGE);

const DB_NAME = 'YT_MUSIC';
const DB_PLAYLIST = 'YT_PLAYLIST';
const DB_CACHED_URLS = 'YT_CACHED_URLS';
const DB_PLAYING = 'YT_PLAYING';
const DB_CONFIGURATION = 'YT_CONFIGURATION';
const DEFAULT_VOLUME = 0.02;

const SDCARD = navigator.getDeviceStorage('sdcard');

function saveDownload(blob, name, cb = () => {}) {
  var mime = blob.type.split('/')[1];
  var path = 'ytm';
  if (SDCARD.storageName !== '') {
    path = `/${SDCARD.storageName}/ytm`;
  }
  path = `${path}/${name}.${mime}`;
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

  const MAIN_PLAYER = document.createElement("audio");
  MAIN_PLAYER.volume = 1;
  var TRACK_NAME = '';
  var TRACKLIST = [];

  const state = new KaiState({
    CONFIGURATION: {},
    DATABASE: {},
    PLAYLIST: {},
    TRACKLIST_IDX: 0,
    TRACK_DURATION: 0,
  });

  MAIN_PLAYER.onerror = (evt) => {
    console.log('MAIN_PLAYER', evt);
  };

  MAIN_PLAYER.onended = (e) => {
    const next = state.getState('TRACKLIST_IDX') + 1;
    if (TRACKLIST[next]) {
      state.setState('TRACKLIST_IDX', next);
      getURL(next);
    }
  }

  MAIN_PLAYER.onloadedmetadata = (evt) => {
    state.setState('TRACK_DURATION', evt.target.duration);
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

  localforage.getItem(DB_PLAYING)
  .then((playlist_id) => {
    if (playlist_id == null) {
      playDefaultCollection();
    } else {
      playPlaylistCollection(playlist_id);
    }
  });

  function playDefaultCollection() {
    TRACKLIST = [];
    localforage.removeItem(DB_PLAYING);
    state.setState('TRACKLIST_IDX', 0);
    TRACK_NAME = 'YT MUSIC';
    localforage.getItem(DB_NAME)
    .then((tracks) => {
      for (var y in tracks) {
        TRACKLIST.push(tracks[y]);
      }
      getURL(state.getState('TRACKLIST_IDX'));
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
          getURL(state.getState('TRACKLIST_IDX'));
          router.showToast(`PLAYING ${TRACK_NAME}`);
          localforage.setItem(DB_PLAYING, PLYLST.id);
        }
      });
    })
    .catch((e) => {
      router.showToast(e.toString());
    });
  }

  function downloadAudio(id) {
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
          return decryptSignature(obj.signatureCipher, obj.player)
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

  function getURL(idx) {
    if (TRACKLIST[idx] == null) {
      return
    }
    if (TRACKLIST[idx].local_path) {
      var request = SDCARD.get(TRACKLIST[idx].local_path);
      request.onsuccess = (file) => {
        MAIN_PLAYER.mozAudioChannelType = 'content';
        MAIN_PLAYER.src = URL.createObjectURL(file.target.result);
        MAIN_PLAYER.play();
      }
      request.onerror = ( error) => {
        console.warn("Unable to get the file: " + error.toString());
      }
    } else {
      if (router && router.loading) {
        router.showLoading();
      }
      getVideoLinks(TRACKLIST[idx].id)
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
        // console.log(MIME, obj);
        if (obj) {
          playMainAudio(obj);
        }
      })
      .catch((e) => {
        if (router && router.loading) {
          router.hideLoading();
        }
        console.log(e);
      });
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
        decryptSignature(obj.signatureCipher, obj.player)
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

  function playMiniAudio(_this, obj) {
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
        decryptSignature(obj.signatureCipher, obj.player)
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

  const miniPlayer = function($router, url, cb = () => {}) {

    const MINI_PLAYER = document.createElement("audio");
    MINI_PLAYER.volume = 1;
    MINI_PLAYER.mozAudioChannelType = 'content';
    MINI_PLAYER.src = url;

    MINI_PLAYER.onerror = (evt) => {
      console.log('MINI_PLAYER', evt);
    };

    const miniPlayerDialog = Kai.createDialog('Mini Player', `
      <div>
        <div>
          <input id="duration_slider" style="width:100%" value="0" type="range" min="0" max="100" disabled/>
        </div>
        <div class="kui-row-center">
          <div id="current_time">00:00</div>
          <div id="duration">00:00</div>
        </div>
        <div>
          <input id="__focus__" class="kui-input" value="TODO" type="text" style="color: transparent; text-shadow: 0px 0px 0px rgb(33, 150, 243); height: 0px; position: absolute; left: 0px;z-index:-9;"/>
        </div>
      </div>`,
    null, '', undefined, '', undefined, '', undefined, undefined, $router);
    miniPlayerDialog.mounted = () => {
      setTimeout(() => {
        $router.setSoftKeyText('Exit' , '', '');
        if (!navigator.mozAudioChannelManager) {
          $router.setSoftKeyRightText((MINI_PLAYER.volume * 100).toFixed(0) + '%');
        }
        const DURATION_SLIDER = document.getElementById('duration_slider');
        const CURRENT_TIME = document.getElementById('current_time');
        const DURATION = document.getElementById('duration');
        const FOCUS = document.getElementById('__focus__');
        if (!FOCUS) {
          return;
        }
        FOCUS.focus();
        FOCUS.addEventListener('keydown', (evt) => {
          switch (evt.key) {
            case 'Backspace':
            case 'EndCall':
              MINI_PLAYER.pause();
              $router.hideBottomSheet();
              setTimeout(() => {
                cb();
                FOCUS.blur();
              }, 100);
              break
            case 'SoftRight':
              break
            case 'SoftLeft':
              MINI_PLAYER.pause();
              $router.hideBottomSheet();
              setTimeout(() => {
                cb();
                FOCUS.blur();
              }, 100);
              break
            case 'Enter':
              if (MINI_PLAYER.duration > 0 && !MINI_PLAYER.paused) {
                MINI_PLAYER.pause();
              } else {
                MINI_PLAYER.play();
              }
              break
            case 'ArrowLeft':
              var threshold = new Date().getTime() - LFT_DBL_CLICK_TH;
              if (threshold > 0 && threshold <= 300) {
                clearTimeout(LFT_DBL_CLICK_TIMER);
                LFT_DBL_CLICK_TH = 0;
                MINI_PLAYER.pause();
                MINI_PLAYER.currentTime -= 10;
                MINI_PLAYER.play();
              } else {
                LFT_DBL_CLICK_TH = new Date().getTime();
                LFT_DBL_CLICK_TIMER = setTimeout(() => {
                  if (LFT_DBL_CLICK_TH !== 0) {
                    LFT_DBL_CLICK_TH = 0;
                  }
                }, 500);
              }
              break
            case 'ArrowRight':
              var threshold = new Date().getTime() - RGT_DBL_CLICK_TH;
              if (threshold > 0 && threshold <= 300) {
                clearTimeout(RGT_DBL_CLICK_TIMER);
                RGT_DBL_CLICK_TH = 0;
                MINI_PLAYER.pause();
                MINI_PLAYER.currentTime += 10;
                MINI_PLAYER.play();
              } else {
                RGT_DBL_CLICK_TH = new Date().getTime();
                RGT_DBL_CLICK_TIMER = setTimeout(() => {
                  if (RGT_DBL_CLICK_TH !== 0) {
                    RGT_DBL_CLICK_TH = 0;
                  }
                }, 500);
              }
              break
          }
        });

        MINI_PLAYER.onloadedmetadata = (evt) => {
          duration = evt.target.duration;
          DURATION.innerHTML = convertTime(evt.target.duration);
          DURATION_SLIDER.setAttribute("max", duration);
        }

        MINI_PLAYER.ontimeupdate = (evt) => {
          var currentTime = evt.target.currentTime;
          CURRENT_TIME.innerHTML = convertTime(evt.target.currentTime);
          DURATION_SLIDER.value = currentTime;
        }

        MINI_PLAYER.onpause = () => {
          $router.setSoftKeyCenterText('PLAY');
          // console.log('PLAY');
        }

        MINI_PLAYER.onplay = () => {
          $router.setSoftKeyCenterText('PAUSE');
          // console.log('PAUSE');
        }

        MAIN_PLAYER.pause();
        MINI_PLAYER.play();

      }, 101);
    }
    miniPlayerDialog.dPadNavListener = {
      arrowUp: function() {
        volumeUp(MINI_PLAYER, $router, toggleVolume)
        const FOCUS = document.getElementById('__focus__');
        FOCUS.focus();
      },
      arrowDown: function() {
        volumeDown(MINI_PLAYER, $router, toggleVolume);
        const FOCUS = document.getElementById('__focus__');
        FOCUS.focus();
      }
    }
    miniPlayerDialog.backKeyListener = function() {
      return false;
    }
    $router.showBottomSheet(miniPlayerDialog);
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
                  downloadAudio(video.id)
                  .then((url) => {
                    $router.hideLoading();
                    $router.showLoading();
                    const down = new XMLHttpRequest({ mozSystem: true });
                    down.open('GET', url, true);
                    down.responseType = 'blob';
                    down.onload = (evt) => {
                      saveDownload(evt.currentTarget.response, `${video.id}_${video.title}`, (localPath) => {
                        if (localPath === false) {
                          $router.showToast("Error SAVE");
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
                      $router.showToast("Error DOWNLOAD");
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
              this.$router.setSoftKeyRightText('Save ID');
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
          this.methods.processResult(0);
        }
      },
      processResult: function(page = 0) {
        if (this.data.bulk_results.length == 0)
          return
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

      document.activeElement.addEventListener('keydown', this.methods.skipEvent);
    },
    unmounted: function() {
      this.$state.removeStateListener('TRACKLIST_IDX', this.methods.listenTracklistIdx);
      this.$state.removeStateListener('TRACK_DURATION', this.methods.listenTrackDuration);
      document.activeElement.removeEventListener('keydown', this.methods.skipEvent);
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
            getURL(selected.idx);
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
          // { text: 'Artist' },
          // { text: 'Album' },
          // { text: 'Genre' },
          { text: 'About' },
          { text: 'Exit' }
        ]
        this.$router.showOptionMenu('Menu', menus, 'Select', (selected) => {
          if (selected.text === 'Search') {
            this.$router.push('search');
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
          } else if (selected.text === 'Exit') {
            window.close();
          } else {
            // console.log(selected.text);
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
          getURL(move);
        }
      },
      arrowDown: function() {
        volumeDown(MAIN_PLAYER, this.$router);
      },
      arrowLeft: function() {
        const move = this.$state.getState('TRACKLIST_IDX') - 1;
        if (TRACKLIST[move]) {
          this.$state.setState('TRACKLIST_IDX', move);
          getURL(move);
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
