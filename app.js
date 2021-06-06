const DB_NAME = 'YT_MUSIC';

if (navigator.mozAudioChannelManager) {
  navigator.mozAudioChannelManager.volumeControlChannel = 'content';
}

const PLAYER = document.createElement("audio");
PLAYER.volume = 1;

window.addEventListener("load", function() {

  localforage.setDriver(localforage.LOCALSTORAGE);

  const state = new KaiState({
    DATABASE: {}
  });

  localforage.getItem(DB_NAME)
  .then((DATABASE) => {
    if (DATABASE == null) {
      DATABASE = {};
    }
    state.setState('DATABASE', DATABASE);
    console.log(state.getState('DATABASE'));
  });

  const saveVideoID = function ($router, video, isUpdate = false) {
    localforage.getItem(DB_NAME)
    .then((DATABASE) => {
      if (DATABASE == null) {
        DATABASE = {};
      }
      if (DATABASE[video.id]) {
        $router.showToast('Already exist inside DB');
      } else {
        $router.push(
          new Kai({
            name: 'saveForm',
            data: {
              title: '',
              artist: '',
              album: '',
              genre: '',
              year: '',
              track: '',
            },
            verticalNavClass: '.saveFormNav',
            templateUrl: document.location.origin + '/templates/saveForm.html',
            mounted: function() {
              this.$router.setHeaderTitle(`Metadata #${video.id}`);
            },
            unmounted: function() {},
            methods: {
              submit: function() {
                var obj = {
                  id: video.id,
                  _title: video.title,
                  album_art: video.thumbnail_src,
                  title: 'UNKNOWN',
                  artist: 'UNKNOWN',
                  album: 'UNKNOWN',
                  genre: 'UNKNOWN',
                  year: 0,
                  track: 0,
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
        }, () => {}, 0);
      },
      playAudio: function(obj) {
        if (obj.url != null) {
          console.log(obj.url);
          PLAYER.mozAudioChannelType = 'content';
          PLAYER.src = obj.url;
          PLAYER.play();
          this.methods.miniPlayer();
        } else {
          this.$router.showLoading();
          decryptSignature(obj.signatureCipher, obj.player)
          .then((url) => {
            console.log(url);
            PLAYER.mozAudioChannelType = 'content';
            PLAYER.src = url;
            PLAYER.play();
            this.methods.miniPlayer();
          })
          .catch((err) => {
            console.log(err);
          })
          .finally(() => {
            this.$router.hideLoading();
          });
        }
      },
      miniPlayer: function() {
        const miniPlayerDialog = Kai.createDialog('Mini Player', '<div>TODO<div><input id="miniplayer" class="kui-input" value="TODO" type="text" style="color: transparent; text-shadow: 0px 0px 0px rgb(33, 150, 243); height: 0px; position: absolute; left: 0px;z-index:-9;"/></div></div>', null, '', undefined, '', undefined, '', undefined, undefined, this.$router);
        miniPlayerDialog.mounted = () => {
          setTimeout(() => {
            setTimeout(() => {
              this.$router.setSoftKeyText('Exit' , 'PLAY', 'Pause');
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
                  this.$router.hideBottomSheet();
                  setTimeout(() => {
                    this.methods.renderSoftKeyCR();
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
                  this.$router.hideBottomSheet();
                  setTimeout(() => {
                    this.methods.renderSoftKeyCR();
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
        this.$router.showBottomSheet(miniPlayerDialog);
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
        const urlDialog = Kai.createDialog('Search', '<div><input id="search-input" placeholder="Enter your keyword" class="kui-input" type="text" /></div>', null, '', undefined, '', undefined, '', undefined, undefined, this.$router);
        urlDialog.mounted = () => {
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
        urlDialog.dPadNavListener = {
          arrowUp: function() {
            const SEARCH_INPUT = document.getElementById('search-input');
            SEARCH_INPUT.focus();
          },
          arrowDown: function() {
            const SEARCH_INPUT = document.getElementById('search-input');
            SEARCH_INPUT.focus();
          }
        }
        this.$router.showBottomSheet(urlDialog);
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
          { text: 'Database' },
          { text: 'Search' },
          { text: 'Playlist' },
          { text: 'Artist' },
          { text: 'Album' },
          { text: 'Genre' },
          { text: 'About' },
          { text: 'Exit' }
        ]
        this.$router.showOptionMenu('Menu', menus, 'Select', (selected) => {
          if (selected.text === 'Exit') {
            window.close();
          } else if (selected.text === 'Search') {
            this.$router.push('search');
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
      'index' : {
        name: 'home',
        component: home
      },
      'search' : {
        name: 'search',
        component: search
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
