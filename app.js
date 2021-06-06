const DB_NAME = 'YT_MUSIC';
const DB_PLAYLIST = 'YT_PLAYLIST';

if (navigator.mozAudioChannelManager) {
  navigator.mozAudioChannelManager.volumeControlChannel = 'content';
}

const PLAYER = document.createElement("audio");
PLAYER.volume = 1;

window.addEventListener("load", function() {

  localforage.setDriver(localforage.LOCALSTORAGE);

  const state = new KaiState({
    DATABASE: {},
    PLAYLIST: {}
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

  const miniPlayer = function($router, cb = () => {}) {
    const miniPlayerDialog = Kai.createDialog('Mini Player', `
      <div>
        <div>
          <input id="miniplayer" class="kui-input" value="TODO" type="text" style="color: transparent; text-shadow: 0px 0px 0px rgb(33, 150, 243); height: 0px; position: absolute; left: 0px;z-index:-9;"/>
        </div>
      </div>`,
    null, '', undefined, '', undefined, '', undefined, undefined, $router);
    miniPlayerDialog.mounted = () => {
      setTimeout(() => {
        setTimeout(() => {
          $router.setSoftKeyText('Exit' , 'PLAY', 'Pause');
        }, 101);
        const MINI_PLAYER = document.getElementById('miniplayer');
        if (!MINI_PLAYER) {
          return;
        }
        MINI_PLAYER.focus();
        MINI_PLAYER.addEventListener('keydown', (evt) => {
          switch (evt.key) {
            case 'Backspace':
            case 'EndCall':
              console.log('EXIT');
              PLAYER.pause();
              $router.hideBottomSheet();
              setTimeout(() => {
                cb();
                MINI_PLAYER.blur();
              }, 100);
              break
            case 'SoftRight':
              console.log('PAUSE');
              PLAYER.pause();
              break
            case 'SoftLeft':
              console.log('EXIT 2');
              PLAYER.pause();
              $router.hideBottomSheet();
              setTimeout(() => {
                cb();
                MINI_PLAYER.blur();
              }, 100);
              break
            case 'Enter':
              console.log('PLAY');
              PLAYER.play();
              break
          }
        });
      });
    }
    miniPlayerDialog.dPadNavListener = {
      arrowUp: function() {
        const MINI_PLAYER = document.getElementById('miniplayer');
        MINI_PLAYER.focus();
      },
      arrowDown: function() {
        const MINI_PLAYER = document.getElementById('miniplayer');
        MINI_PLAYER.focus();
      }
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
              oldName = PLAYLIST[pid].name;
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
            state.setState('PLAYLIST', UPDATED_PLAYLIST);
            this.methods.getPlaylist();
          })
          .catch((e) => {
            this.$router.showToast(e.toString());
          });
        }
      }
    },
    softKeyText: { left: 'Add', center: '', right: '' },
    softKeyListener: {
      left: function() {
        addOrEditPlaylistDialog(this, '', null);
      },
      center: function() {},
      right: function() {
        const _selected = this.data.playlists[this.verticalNavIndex];
        if (_selected) {
          const menus = [
            { text: 'Track' },
            { text: 'Update' },
            { text: 'Delete' },
          ]
          this.$router.showOptionMenu('Action', menus, 'Select', (selected) => {
            if (selected.text === 'Update') {
              addOrEditPlaylistDialog(this, _selected.name, _selected.id);
            } else {
              console.log(selected.text);
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
                  album_art: video.thumbnail_src,
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
                DATABASE[video.id] = obj;
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
      this.methods.renderSoftKeyCR();
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
              link.text = link.mimeType + '(' + br.toString() + 'kbps)';
              audio.push(link);
            }
          });
          console.log(audio);
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
          this.methods.playAudio(selected);
        }, () => {
          setTimeout(() => {
            this.methods.renderSoftKeyCR();
          }, 100);
        }, 0);
      },
      playAudio: function(obj) {
        if (obj.url != null) {
          console.log(obj.url);
          PLAYER.mozAudioChannelType = 'content';
          PLAYER.src = obj.url;
          PLAYER.play();
          miniPlayer(this.$router, this.methods.renderSoftKeyCR);
        } else {
          this.$router.showLoading();
          decryptSignature(obj.signatureCipher, obj.player)
          .then((url) => {
            console.log(url);
            PLAYER.mozAudioChannelType = 'content';
            PLAYER.src = url;
            PLAYER.play();
            miniPlayer(this.$router, this.methods.renderSoftKeyCR);
          })
          .catch((err) => {
            console.log(err);
          })
          .finally(() => {
            this.$router.hideLoading();
          });
        }
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
        this.methods.renderSoftKeyCR();
      },
      renderSoftKeyCR: function() {
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
                      this.methods.renderSoftKeyCR();
                      SEARCH_INPUT.blur();
                    }, 100);
                  }
                  break
                case 'SoftRight':
                  this.$router.hideBottomSheet();
                  setTimeout(() => {
                    this.methods.renderSoftKeyCR();
                    SEARCH_INPUT.blur();
                    this.methods.search(SEARCH_INPUT.value);
                  }, 100);
                  break
                case 'SoftLeft':
                  this.$router.hideBottomSheet();
                  setTimeout(() => {
                    this.methods.renderSoftKeyCR();
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
        this.methods.renderSoftKeyCR();
      },
      arrowDown: function() {
        if (this.verticalNavIndex === this.data.results.length - 1) {
          return
        }
        this.navigateListNav(1);
        this.methods.renderSoftKeyCR();
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
      perPage: 10,
      nextPage: null
    },
    verticalNavClass: '.searchNav',
    templateUrl: document.location.origin + '/templates/search.html',
    mounted: function() {
      this.$router.setHeaderTitle('Database');
      this.methods.resetSearch();
    },
    unmounted: function() {
      this.data.title = 'database';
      this.data.bulk_results = [];
      this.data.results = [];
      this.data.perPage = 1;
      this.data.nextPage = null;
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
              link.text = link.mimeType + '(' + br.toString() + 'kbps)';
              audio.push(link);
            }
          });
          console.log(audio);
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
          this.methods.playAudio(selected);
        }, () => {
          setTimeout(() => {
            this.methods.renderSoftKeyLCR();
          }, 100);
        }, 0);
      },
      playAudio: function(obj) {
        if (obj.url != null) {
          console.log(obj.url);
          PLAYER.mozAudioChannelType = 'content';
          PLAYER.src = obj.url;
          PLAYER.play();
          miniPlayer(this.$router, this.methods.renderSoftKeyLCR);
        } else {
          this.$router.showLoading();
          decryptSignature(obj.signatureCipher, obj.player)
          .then((url) => {
            console.log(url);
            PLAYER.mozAudioChannelType = 'content';
            PLAYER.src = url;
            PLAYER.play();
            miniPlayer(this.$router, this.methods.renderSoftKeyLCR);
          })
          .catch((err) => {
            console.log(err);
          })
          .finally(() => {
            this.$router.hideLoading();
          });
        }
      },
      resetSearch: function() {
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
              { text: 'Update' },
              { text: 'Delete' },
              { text: 'Playlist' },
            ]
            this.$router.showOptionMenu('Menu', menus, 'Select', (selected) => {
              if (selected.text === 'Update') {
                saveVideoID(this.$router, _selected, true);
              } else {
                console.log(selected.text);
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
  });

  const home = new Kai({
    name: 'home',
    data: {
      title: 'home',
      results: []
    },
    verticalNavClass: '.homeNav',
    templateUrl: document.location.origin + '/templates/home.html',
    mounted: function() {
      this.$router.setHeaderTitle('YT Music');
    },
    unmounted: function() {
      
    },
    methods: {
      selected: function() {},
    },
    softKeyText: { left: 'Track', center: '', right: 'Menu' },
    softKeyListener: {
      left: function() {
        // TRACK
      },
      center: function() {
        
      },
      right: function() {
        const menus = [
          { text: 'Search' },
          { text: 'Database' },
          { text: 'Playlist' },
          { text: 'Artist' },
          { text: 'Album' },
          { text: 'Genre' },
          { text: 'About' },
          { text: 'Exit' }
        ]
        this.$router.showOptionMenu('Menu', menus, 'Select', (selected) => {
          if (selected.text === 'Search') {
            this.$router.push('search');
          } else if (selected.text === 'Database') {
            this.$router.push('database');
          } else if (selected.text === 'Playlist') {
            this.$router.push('playlist');
          } else if (selected.text === 'Exit') {
            window.close();
          } else {
            console.log(selected.text);
          }
        }, undefined, 0);
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        //this.navigateListNav(-1);
      },
      arrowRight: function() {
        //this.navigateTabNav(-1);
      },
      arrowDown: function() {
        //this.navigateListNav(1);
      },
      arrowLeft: function() {
        //this.navigateTabNav(1);
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
  } catch(e) {
    console.log(e);
  }
});
