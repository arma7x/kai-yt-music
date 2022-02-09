const Kai = (function() {

  function Kai(options) {
    this.init(options);
  }

  Kai.prototype.init = function(options) {

    this.id;
    this.name = 'Kai';
    this.data = {};
    this.template = '';
    this.templateUrl;
    this.templateCompiled;
    this.methods = {};
    this.isMounted = false;
    this.$router;
    this.$state;
    this.scrollThreshold = 0;
    this.verticalNavClass = '.kai-list-nav';
    this.verticalNavIndex = -1;
    this.horizontalNavClass = '.kai-tab-nav';
    this.horizontalNavIndex = -1;
    this.components = [];
    this.disableKeyListener = false;
    this.softKeyText = { left: '', center: '', right: '' };
    this.softKeyListener = {
      left: () => {},
      center: () => {},
      right: () => {}
    };
    this.softKeyInputFocusText = { left: '', center: '', right: '' };
    this.softKeyInputFocusListener = {
      left: () => {},
      center: () => {},
      right: () => {}
    };
    this.backKeyListener = function(evt) {};
    this.dPadNavListener = {
      arrowUp: () => {
        const DOM = document.getElementById(this.id);
        DOM.scrollTop -= 20;
        this.scrollThreshold = DOM.scrollTop;
      },
      arrowRight: () => {
        const DOM = document.getElementById(this.id);
        DOM.scrollLeft = +20;
      },
      arrowDown: () => {
        const DOM = document.getElementById(this.id);
        DOM.scrollTop += 20;
        this.scrollThreshold = DOM.scrollTop;
      },
      arrowLeft: () => {
        const DOM = document.getElementById(this.id);
        DOM.scrollLeft = -20;
      },
    };
    this._router;
    this._state;
    this._options;
    this._data;

    this._Kai = function (options) {
      this._options = options;
      this._data = JSON.stringify(typeof options.data === 'object' ? options.data : {});
      const allow = ['id','name', 'data', 'template' , 'templateUrl', 'methods', 'mounted', 'unmounted', 'router', 'state', 'softKeyInputFocusText', 'softKeyInputFocusListener', 'softKeyText', 'softKeyListener', 'dPadNavListener', 'verticalNavClass', 'verticalNavIndex', 'horizontalNavClass', 'horizontalNavIndex', 'components', 'backKeyListener', 'disableKeyListener'];
      for (var i in options) {
        if (allow.indexOf(i) !== -1) {
          if (i === 'methods') {
            for (f in options[i]) {
              if (typeof options[i][f] === 'function') {
                this[i][f] = options[i][f].bind(this);
              }
            }
          } else if (i === 'softKeyInputFocusListener') {
            for (f in options[i]) {
              if (typeof options[i][f] === 'function') {
                this[i][f] = options[i][f].bind(this);
              }
            }
          }  else if (i === 'softKeyListener') {
            for (f in options[i]) {
              if (typeof options[i][f] === 'function') {
                this[i][f] = options[i][f].bind(this);
              }
            }
          } else if (i === 'dPadNavListener') {
            for (f in options[i]) {
              if (typeof options[i][f] === 'function') {
                this[i][f] = options[i][f].bind(this);
              }
            }
          } else if (i === 'backKeyListener' && typeof options[i] === 'function') {
            this[i] = options[i].bind(this);
          } else if (i === 'router' && options[i] instanceof KaiRouter) {
            this._router = options[i];
            this.$router = this._router;
          } else if (i === 'state' && options[i] instanceof KaiState) {
            this._state = options[i];
            this.$state = this._state;
            if (options['router'] && options['router'] instanceof KaiRouter) {
              for (var path in options['router'].routes) {
                const obj = options['router'].routes[path];
                if (obj.component && obj.component instanceof Kai) {
                  obj.component.$state = this.$state;
                }
              }
            }
          } else if (i === 'data') {
            this[i] = JSON.parse(JSON.stringify(typeof options[i] === 'object' ? options[i] : {}));
          } else {
            this[i] = options[i];
          }
        }
      }
    }
    this._Kai(options);
  }

  Kai.prototype.mounted = function() {}

  Kai.prototype.unmounted = function() {}

  Kai.prototype.mount = function(id) {

    if (id) {
      this.id = id;
    }

    const DOM = document.getElementById(this.id);
    if (!DOM) {
      return;
    }

    if (DOM.__kaikit__ != undefined && DOM.__kaikit__ instanceof Kai && this.id !== '__kai_router__' && this.id !== '__kai_tab__') {
      DOM.__kaikit__.unmount();
      DOM.removeEventListener('click', this.handleClick);
    }
    DOM.__kaikit__ = this;
    DOM.addEventListener('click', this.handleClick);
    this.addKeydownListener();

    if (this.isMounted) {
      this.exec();
      this.mounted();
      return;
    }
    if (!this.templateUrl) {
      this.exec();
      this.mounted();
    } else {
      const xhttp = new XMLHttpRequest({ mozSystem: true });
      xhttp.onreadystatechange = (evt) => {
        if (evt.target.readyState == 4 && evt.target.status == 200) {
          this.template = xhttp.responseText;
          this.exec();
          this.mounted();
        }
      };
      xhttp.open('GET', this.templateUrl, true);
      xhttp.send();
    }
  }

  Kai.prototype.unmount = function() {
    this.isMounted = false;
    this.components.forEach((v) => {
      if (v instanceof Kai) {
        v.unmount();
      }
    });
    this.removeKeydownListener();
    this.unmounted();
  }

  Kai.prototype.exec = function() {
    this.render();
    if (this._router) {
      this._router.run();
    }
  }

  Kai.prototype.render = function(trace) {
    const DOM = document.getElementById(this.id);
    if (!DOM) {
      return;
    }

    if (window.Mustache) {
      const data = JSON.parse(JSON.stringify(this.data));
      data['__stringify__'] = function () {
        if (typeof this === 'object') {
          return JSON.stringify(this);
        }
        return this;
      }
      if (this.$state) {
        data.$state = JSON.parse(JSON.stringify(this.$state.getState()));
      }
      const render = window.Mustache.render(this.template, data);
      DOM.innerHTML = render;
    } else {
      const render = this.template;
      DOM.innerHTML = render;
    }
    this.isMounted = true;

    var tabIndex = document.getElementById('__kai_router__') ? document.getElementById('__kai_router__').querySelectorAll("[tabIndex").length : document.querySelectorAll("[tabIndex").length;
    const LIS = document.querySelectorAll(this.verticalNavClass);
    for (var LI in LIS) {
      if (LIS[LI].setAttribute) {
        LIS[LI].setAttribute("tabIndex", tabIndex);
        tabIndex += 1;
      }
    }

    this.components.forEach((v) => {
      if (v instanceof Kai) {
        if (this.$router) {
          v.$router = this.$router;
        }
        if (this.$state) {
          v.$state = this.$state;
        }
        v.mount();
      }
    });

    const listNav = document.querySelectorAll(this.verticalNavClass);
    if (listNav.length > 0 && this.id !== '__kai_header__' && this.id !==  '__kai_soft_key__') {
      if (this.verticalNavIndex === -1) {
        this.verticalNavIndex = 0;
      }
      const cur = listNav[this.verticalNavIndex];
      cur.focus();
      cur.classList.add('focus');
      this.verticalNavIndex = this.verticalNavIndex - 1;
      this.scrollThreshold = this.navigateListNav(1);
    }

    const tabNav = document.querySelectorAll(this.horizontalNavClass);
    if (tabNav.length > 0 && this.id !== '__kai_header__' && this.id !==  '__kai_soft_key__') {
      if (this.horizontalNavIndex === -1) {
        this.horizontalNavIndex = 0;
      }
      const cur = tabNav[this.horizontalNavIndex];
      cur.focus();
      cur.classList.add('focus');
      cur.parentElement.scrollLeft = cur.offsetLeft - cur.offsetWidth;
    }
    this.templateCompiled = DOM.innerHTML;
    for(var i=0;i<DOM.getElementsByTagName('input').length;i++) {
      DOM.getElementsByTagName('input')[i].addEventListener('focus', (evt) => {
        if (this.$router)
          this.$router.onInputFocus();
      });
      DOM.getElementsByTagName('input')[i].addEventListener('blur', (evt) => {
        if (this.$router)
          this.$router.onInputBlur();
      });
    }
    for(var i=0;i<DOM.getElementsByTagName('textarea').length;i++) {
      DOM.getElementsByTagName('textarea')[i].addEventListener('focus', (evt) => {
        if (this.$router)
          this.$router.onInputFocus();
      });
      DOM.getElementsByTagName('textarea')[i].addEventListener('blur', (evt) => {
        if (this.$router)
          this.$router.onInputBlur();
      });
    }
    if ((['INPUT', 'TEXTAREA'].indexOf(document.activeElement.tagName) > -1) && this.$router) {
      this.$router.onInputFocus();
    }
  }

  Kai.prototype.setData = function(data) {
    this.data = Object.assign(JSON.parse(JSON.stringify(this.data)), data);
    this.exec();
  }

  Kai.prototype.addKeydownListener = function() {
    if (this.disableKeyListener) {
      return;
    }
    if (this._router) {
      document.addEventListener('keydown', this.handleRouterKeydown.bind(this));
    } else if (['__kai_router__', '__kai_header__', '__kai_soft_key__', '__kai_bottom_sheet__', '__kai_tab__', '__kai_toast__'].indexOf(this.id) === -1) {
      document.addEventListener('keydown', this.handleLocalKeydown.bind(this), true);
    }
  }

  Kai.prototype.removeKeydownListener = function() {
    if (this.disableKeyListener) {
      return;
    }
    if (this._router) {
      document.addEventListener('keydown', function(evt) {evt.stopPropagation();}, true);
    } else if (['__kai_router__', '__kai_header__', '__kai_soft_key__', '__kai_bottom_sheet__', '__kai_tab__', '__kai_toast__'].indexOf(this.id) === -1) {
      document.addEventListener('keydown', function(evt) {evt.stopPropagation();}, true);
    }
  }

  Kai.prototype.handleRouterKeydown = function(evt) {
    this._router.handleKeydown(evt, this._router);
  }

  Kai.prototype.handleLocalKeydown = function(evt) {
    switch(evt.key) {
      case 'Backspace':
      case 'EndCall':
        if (['INPUT', 'TEXTAREA'].indexOf(document.activeElement.tagName) > -1) {
          if (document.activeElement.value.length === 0) {
            document.activeElement.blur();
          }
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (typeof this.backKeyListener === 'function') {
          const isStop = this.backKeyListener();
          if (isStop === true) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
        break
      case 'SoftLeft':
        if (['INPUT', 'TEXTAREA'].indexOf(document.activeElement.tagName) > -1) {
          if (typeof this.softKeyInputFocusListener.left === 'function') {
            this.softKeyInputFocusListener.left();
          }
          return;
        }
        if (typeof this.softKeyListener.left === 'function') {
          this.softKeyListener.left();
        }
        break
      case 'SoftRight':
        if (['INPUT', 'TEXTAREA'].indexOf(document.activeElement.tagName) > -1) {
          if (typeof this.softKeyInputFocusListener.right === 'function') {
            this.softKeyInputFocusListener.right();
          }
          return;
        }
        if (typeof this.softKeyListener.right === 'function') {
          this.softKeyListener.right();
        }
        break
      case 'Enter':
        if (['INPUT', 'TEXTAREA'].indexOf(document.activeElement.tagName) > -1) {
          if (typeof this.softKeyInputFocusListener.center === 'function') {
            this.softKeyInputFocusListener.center();
          }
          return;
        }
        if (typeof this.softKeyListener.center === 'function') {
          this.softKeyListener.center();
        }
        break
      case 'ArrowUp':
        if (['INPUT', 'TEXTAREA'].indexOf(document.activeElement.tagName) > -1) {
          document.activeElement.blur();
        }
        if (typeof this.dPadNavListener.arrowUp === 'function') {
          this.dPadNavListener.arrowUp();
        }
        break
      case 'ArrowRight':
        if (['INPUT', 'TEXTAREA'].indexOf(document.activeElement.tagName) > -1) {
          return;
        }
        if (typeof this.dPadNavListener.arrowRight === 'function') {
          this.dPadNavListener.arrowRight();
        }
        break
      case 'ArrowDown':
        if (['INPUT', 'TEXTAREA'].indexOf(document.activeElement.tagName) > -1) {
          document.activeElement.blur();
        }
        if (typeof this.dPadNavListener.arrowDown === 'function') {
          this.dPadNavListener.arrowDown();
        }
        break
      case 'ArrowLeft':
        if (['INPUT', 'TEXTAREA'].indexOf(document.activeElement.tagName) > -1) {
          return;
        }
        if (typeof this.dPadNavListener.arrowLeft === 'function') {
          this.dPadNavListener.arrowLeft();
        }
        break
    }
  }

  Kai.prototype.handleClick = function(evt) {

    function getkaikit(target) {
      if (target.__kaikit__) {
        return target.__kaikit__;
      } else if (!target.parentElement) {
        return null;
      } else if (target.parentElement) {
        return getkaikit(target.parentElement);
      } else {
        return null;
      }
    }
    var _this = getkaikit(evt.target);

    function dataType(n, scope) {
      if (!isNaN(parseFloat(n)) && isFinite(n)) {
        return parseFloat(n);
      } else if (scope[n]) {
        return scope[n];
      } else {
        try {
          return JSON.parse(n);
        } catch(e) {
          if ((n.charAt(0) === "'" && n.charAt(n.length - 1) === "'") || (n.charAt(0) === '"' && n.charAt(n.length - 1) === '"')) {
            const n2 = n.split('');
            n2.splice(0,1);
            n2.pop();
            n = n2.join('');
          }
          return n;
        }
      }
    }

    evt.stopImmediatePropagation();
    var extractFuncRegex = /\b[^()]+\((.*)\)$/;
    const target = evt.target.attributes.getNamedItem('@click');
    if (evt.target.attributes.length > 0 && target) {
      if (target.value !== '') { // nodeValue
        const params = target.value.split(';'); // nodeValue
        params.forEach(function(v) {
          var fName = v.substring(0, v.indexOf('('));
          var fParams = v.substring((v.indexOf('(') +1), v.indexOf(')'));
          if (_this.methods[fName]) {
            _this.methods[fName].apply(null, [dataType(fParams, _this)]);
          }
        });
      }
    }
  }

  Kai.prototype.clone = function(data) {
    const options = {};
    for(var x in this._options) {
      options[x] = this._options[x];
    }
    if (typeof data === 'object') {
      options.data = JSON.parse(JSON.stringify(data));
    } else {
      options.data = JSON.parse(this._data);
    }
    options.id = undefined;
    options.components = [];
    options.scrollThreshold = 0;
    options.verticalNavIndex = -1;
    options.horizontalNavIndex = -1;
    const a = new Kai(options);
    return a;
  }

  Kai.prototype.reset = function(data) {
    if (typeof data === 'object') {
      this.data = JSON.parse(JSON.stringify(data));
    } else {
      this.data = JSON.parse(this._data);
    }
    return this;
  }

  Kai.prototype.navigateListNav = function(next) {
    return this.nav(next, 'verticalNavIndex', 'verticalNavClass');
  }

  Kai.prototype.navigateTabNav = function(next) {
    return this.nav(next, 'horizontalNavIndex', 'horizontalNavClass');
  }

  Kai.prototype.nav = function(next, navIndex, navClass) {
    const currentIndex = this[navIndex];
    const nav = document.querySelectorAll(this[navClass]);
    if (nav.length === 0) {
      return;
    }
    var move = currentIndex + next;
    var targetElement = nav[move];
    if (targetElement !== undefined) {
      targetElement.focus();
      this[navIndex] = move;
    } else {
      if (move < 0) {
        move = nav.length - 1;
      } else if (move >= nav.length) {
        move = 0;
      }
      targetElement = nav[move];
      targetElement.focus();
      this[navIndex] = move;
    }
    targetElement.classList.add('focus');
    if (currentIndex > -1 && nav.length > 1) {
      nav[currentIndex].classList.remove('focus');
    }
    if (navClass === 'horizontalNavClass') {
      if (!isElementInViewport(targetElement, 0, 0)) {
        return targetElement.parentElement.scrollLeft = targetElement.offsetLeft;
      }
      return targetElement.parentElement.scrollLeft = targetElement.offsetLeft - targetElement.offsetWidth;
    } else if (navClass === 'verticalNavClass') {
      const container = document.getElementById(this.id);
      const parent = window.getComputedStyle(container);
      const marginBottom = window.innerHeight - container.offsetTop - container.offsetHeight;
      if (targetElement.offsetTop > targetElement.parentElement.clientHeight) {
        if ((targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA')) {
          const LI = getParent(targetElement);
          if (LI && !isElementInViewport(LI, parseFloat(parent.marginTop), parseFloat(parent.marginBottom))) {
            var fill = parseFloat(LI.parentElement.clientHeight) - ((parseFloat(LI.offsetTop) - parseFloat(parent.marginTop)) + parseFloat(LI.offsetHeight));
            fill = fill < 0 ? -(fill) : fill;
            pad = fill;
            return LI.parentElement.scrollTop = pad;
          }
        } else if (!isElementInViewport(targetElement, parseFloat(container.offsetTop), parseFloat(marginBottom))) {
          var fill = parseFloat(targetElement.parentElement.clientHeight) - ((parseFloat(targetElement.offsetTop) - parseFloat(container.offsetTop)) + parseFloat(targetElement.offsetHeight));
          fill = fill < 0 ? -(fill) : fill;
          pad = fill;
          return targetElement.parentElement.scrollTop = pad;
        }
        return targetElement.parentElement.scrollTop;
      } else {
        var pad = 0;
        if ((targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA')) {
          return targetElement.parentElement.parentElement.scrollTop = 0;
        } else if (!isElementInViewport(targetElement, parseFloat(parent.marginTop), parseFloat(parent.marginBottom))) {
          var fill = parseFloat(targetElement.parentElement.clientHeight) - ((parseFloat(targetElement.offsetTop) - parseFloat(parent.marginTop)) + parseFloat(targetElement.offsetHeight));
          fill = fill < 0 ? -(fill) : fill;
          pad = fill;
        }
        return targetElement.parentElement.scrollTop = 0 + pad;
      }
    }
  }

  function getParent(targetElement) {
    if (targetElement.parentElement == null)
      return null
    if (targetElement.parentElement.tagName != 'LI')
      return getParent(targetElement.parentElement);
    return targetElement.parentElement;
  }

  function isElementInViewport(el, marginTop = 0, marginBottom = 0) {
    var rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 + marginTop &&
        rect.left >= 0 &&
        rect.bottom <= ((window.innerHeight || document.documentElement.clientHeight) - marginBottom) && /* or $(window).height() */
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
    );
  }

  return Kai;

})()
