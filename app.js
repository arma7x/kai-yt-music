if (navigator.mozAudioChannelManager) {
  navigator.mozAudioChannelManager.volumeControlChannel = 'content';
}

const PLAYER = document.createElement("audio");
PLAYER.volume = 1;

window.addEventListener("load", function() {

  const state = new KaiState({});

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
    },
    unmounted: function() {
      
    },
    methods: {
      selected: function(vid) {
        this.$router.showLoading();
        getLinks(vid.id)
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
        const miniPlayerDialog = Kai.createDialog('Mini Player', '<div><input id="miniplayer" class="kui-input" value="TODO" type="text" style="color: transparent; text-shadow: 0px 0px 0px rgb(33, 150, 243); height: 0px; position: absolute; left: 0px;z-index:-9;"/></div>', null, '', undefined, '', undefined, '', undefined, undefined, this.$router);
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
        this.$router.showBottomSheet(miniPlayerDialog);
      },
      search: function(q = '') {
        this.$router.showLoading();
        xhr('GET', `https://youtube-scrape.herokuapp.com/api/search?q=${q}`)
        .then((data) => {
          this.verticalNavIndex = -1;
          var videos = [];
          data.response.results.forEach((t) => {
            if (t.video) {
              t.video.isVideo = true;
              videos.push(t.video);
            }
          });
          this.setData({
            results: [],
            key: data.response.key,
            estimatedResults: data.response.estimatedResults,
            nextPageToken: data.response.nextPageToken || null,
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
        xhr('GET', `https://youtube-scrape.herokuapp.com/api/search?pageToken=${this.data.nextPageToken}&key=${this.data.key}`)
        .then((data) => {
          var videos = [];
          data.response.results.forEach((t) => {
            if (t.video) {
              t.video.isVideo = true;
              videos.push(t.video);
            }
          });
          this.setData({
            key: data.response.key,
            estimatedResults: data.response.estimatedResults,
            nextPageToken: data.response.nextPageToken || null,
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
                      SEARCH_INPUT.blur();
                    }, 100);
                  }
                  break
                case 'SoftRight':
                  this.$router.hideBottomSheet();
                  setTimeout(() => {
                    SEARCH_INPUT.blur();
                    this.methods.search(SEARCH_INPUT.value);
                  }, 100);
                  break
                case 'SoftLeft':
                  this.$router.hideBottomSheet();
                  setTimeout(() => {
                    SEARCH_INPUT.blur();
                  }, 100);
                  break
              }
            });
          });
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
      right: function() {}
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
    softKeyText: { left: 'Menu', center: 'Search', right: 'Exit' },
    softKeyListener: {
      left: function() {},
      center: function() {
        this.$router.push('search');
      },
      right: function() {
        window.close();
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
