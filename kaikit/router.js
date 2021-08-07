const KaiRouter = (function() {

  function KaiRouter(options) {
    this.init(options);
  }

  KaiRouter.prototype.init = function(options) {

    this._404 = new Kai({name: '404', template: '<div class="kai-404">404</div>'});
    this.title = '';
    this.routes = {};
    this.stack = [];
    this.loading;
    this.header;
    this.softwareKey;
    this.toast;
    this.bottomSheet = false;

    this._KaiRouter = function (options) {
      const allow = ['routes', 'title'];
      for (var i in options) {
        if (allow.indexOf(i) !== -1) {
          if (i === 'routes') {
            if (typeof options[i] === 'object') {
              for (var path in options[i]) {
                const obj = options[i][path];
                if (obj.component && obj.component instanceof Kai) {
                  obj.component.$router = this;
                  this.routes[path] = obj;
                }
              }
            }
          } else {
            this[i] = options[i];
          }
        }
      }
    }
    this._KaiRouter(options);
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

  function createPageURLParam(paths) {
    const cols = [];
    paths.forEach(function(v) {
      cols.push('page[]=' + v);
    });
    if (cols.length > 0) {
      return  '?' + cols.join('&');
    }
    return '';
  }

  KaiRouter.prototype.run = function() {
    this.mountLoading();
    this.mountHeader();
    this.mountSoftKey();
    this.mountToast();
    this.calcRouterHeight();
    const paths = getURLParam('page[]');
    if (paths.length === 0) {
      paths.push('index');
    }
    var pathname = window.location.pathname.replace(/\/$/, '');
    if (pathname.length === 0) {
      pathname = '/index.html';
    }
    window.history.pushState("/", "", pathname + createPageURLParam(paths));
    paths.forEach((path, k) => {
      if (k === (paths.length - 1)) {
        if (this.routes[path]) {
          const component = this.routes[path].component;
          if (component.isMounted === false) {
            this.stack.push(component);
          }
          this.setSoftKeyText(component.softKeyText.left, component.softKeyText.center, component.softKeyText.right);
          component.mount('__kai_router__');
        } else {
          this._404.mount('__kai_router__');
          this._404.$router = this;
          this.setSoftKeyText(this._404.softKeyText.left, this._404.softKeyText.center, this._404.softKeyText.right);
          this.stack.push(this._404);
        }
      } else {
        if (this.routes[path]) {
          const reset = this.routes[path].component.reset();
          this.stack.push(reset);
        } else {
          this._404.mount('__kai_router__');
          this._404.$router = this;
          this.setSoftKeyText(this._404.softKeyText.left, this._404.softKeyText.center, this._404.softKeyText.right);
          this.stack.push(this._404);
        }
        if (paths.length === this.stack.length) {
          return;
        }
      }
    });
  }

  KaiRouter.prototype.push = function(path) {
    if (this.bottomSheet) {
      this.hideBottomSheet();
    }
    const DOM = document.getElementById('__kai_router__');
    DOM.scrollTop = 0;
    var name = path;
    if (this.stack.length > 0) {
      this.stack[this.stack.length - 1].unmount();
    }
    var component;
    if (typeof path === 'string' && this.routes[path]) {
      component = this.routes[path].component.reset();
    } else if (path instanceof Kai) {
      component = path.reset();
      component.$router = this;
      name = component.name;
    } else {
      component = this._404.reset();
      component.$router = this;
    }
    component.scrollThreshold = 0;
    component.verticalNavIndex = -1;
    component.horizontalNavIndex = -1;
    this.setSoftKeyText(component.softKeyText.left, component.softKeyText.center, component.softKeyText.right);
    component.mount('__kai_router__');
    this.stack.push(component);
    const paths = getURLParam('page[]');
    paths.push(name);
    var pathname = window.location.pathname.replace(/\/$/, '');
    if (pathname.length === 0) {
      pathname = '/index.html';
    }
    window.history.pushState("/", "", pathname + createPageURLParam(paths));
  }

  KaiRouter.prototype.pop = function() {
    if (this.bottomSheet) {
      return;
    }
    const paths = getURLParam('page[]');
    var pathname = window.location.pathname.replace(/\/$/, '');
    if (pathname.length === 0) {
      pathname = '/index.html';
    }
    if ((paths.length > 0 && this.stack.length > 0) && (paths.length === this.stack.length)) {
      var r = false;
      if ((this.stack.length - 1) > 0) {
        paths.pop();
        this.stack.pop();
        const DOM = document.getElementById('__kai_router__');
        if (DOM) {
          if (DOM.__kaikit__ != undefined && DOM.__kaikit__ instanceof Kai && DOM.__kaikit__.id === '__kai_router__') {
            DOM.__kaikit__.unmount();
            DOM.removeEventListener('click', DOM.__kaikit__.handleClick);
          }
        }
        const component = this.stack[this.stack.length - 1];
        this.setSoftKeyText(component.softKeyText.left, component.softKeyText.center, component.softKeyText.right);
        component.mount('__kai_router__');
        DOM.scrollTop = this.stack[this.stack.length - 1].scrollThreshold;
        r = true;
      }
      window.history.pushState("/", "", pathname + createPageURLParam(paths));
      return r;
    } else {
      return false;
    }
    return false;
  }

  KaiRouter.prototype.onInputFocus = function() {
    const component = this.stack[this.stack.length -1];
    this.setSoftKeyText(component.softKeyInputFocusText.left, component.softKeyInputFocusText.center, component.softKeyInputFocusText.right);
    const SK = document.getElementById('__kai_soft_key__');
    SK.classList.add('kui-software-key-dark');
  }

  KaiRouter.prototype.onInputBlur = function() {
    const component = this.stack[this.stack.length -1];
    this.setSoftKeyText(component.softKeyText.left, component.softKeyText.center, component.softKeyText.right);
    const SK = document.getElementById('__kai_soft_key__');
    SK.classList.remove('kui-software-key-dark');
  }

  KaiRouter.prototype.showBottomSheet = function(component) {
    const body = document.getElementById('__kai_router__');
    body.style.overflowY = 'hidden';
    document.body.style.position = '';
    component.mount('__kai_bottom_sheet__');
    this.setSoftKeyText(component.softKeyText.left, component.softKeyText.center, component.softKeyText.right);
    this.bottomSheet = true;
    this.stack.push(component);
    const DOM = document.getElementById('__kai_bottom_sheet__');
    const SK = document.getElementById('__kai_soft_key__');
    DOM.classList.add('kui-overlay');
    if (SK) {
      DOM.classList.add('kui-overlay-visible');
      SK.classList.add('kui-software-key-dark');
    } else {
      DOM.classList.add('kui-overlay-visible-no-sk');
    }
    if (component.verticalNavIndex > -1) {
      component.verticalNavIndex -= 1;
      component.dPadNavListener.arrowDown();
    }
  }

  KaiRouter.prototype.hideBottomSheet = function() {
    if (!this.bottomSheet) {
      return;
    }
    const body = document.getElementById('__kai_router__');
    body.style.overflowY = '';
    this.bottomSheet = false;
    this.stack.pop();
    const component = this.stack[this.stack.length -1];
    this.setSoftKeyText(component.softKeyText.left, component.softKeyText.center, component.softKeyText.right);
    const DOM = document.getElementById('__kai_bottom_sheet__');
    const SK = document.getElementById('__kai_soft_key__');
    if (DOM) {
      if (DOM.__kaikit__ != undefined && DOM.__kaikit__ instanceof Kai && DOM.__kaikit__.id === '__kai_bottom_sheet__') {
        DOM.__kaikit__.unmount();
        DOM.removeEventListener('click', DOM.__kaikit__.handleClick);
        DOM.__kaikit__ = null;
      }
    }
    if (SK) {
      DOM.classList.remove('kui-overlay-visible');
      SK.classList.remove('kui-software-key-dark');
    } else {
      DOM.classList.remove('kui-overlay-visible-no-sk');
    }
    setTimeout(() => {
      if (component.verticalNavIndex > -1 && (this.stack[this.stack.length - 1].name === component.name)) {
        component.verticalNavIndex -= 1;
        component.dPadNavListener.arrowDown();
      }
    }, 100);
  }

  KaiRouter.prototype.showDialog = function(title, body, dataCb, positiveText, positiveCb, negativeText, negativeCb, neutralText, neutralCb, closeCb) {
    if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      document.activeElement.blur();
    }
    const dialog = Kai.createDialog(title, body, dataCb, positiveText, positiveCb, negativeText, negativeCb, neutralText, neutralCb, closeCb, this);
    this.showBottomSheet(dialog);
  }

  KaiRouter.prototype.hideDialog = function() {
    this.hideBottomSheet();
  }

  KaiRouter.prototype.showOptionMenu = function(title, options, selectText, selectCb, closeCb, verticalNavIndex = -1) {
    if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      document.activeElement.blur();
    }
    const option_menu = Kai.createOptionMenu(title, options, selectText, selectCb, closeCb, verticalNavIndex, this);
    this.showBottomSheet(option_menu);
  }

  KaiRouter.prototype.hideOptionMenu = function() {
    this.hideBottomSheet();
  }

  KaiRouter.prototype.showSingleSelector = function(title, options, selectText, selectCb, cancelText, cancelCb, closeCb, verticalNavIndex = -1) {
    if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      document.activeElement.blur();
    }
    const single_selector = Kai.createSingleSelector(title, options, selectText, selectCb, cancelText, cancelCb, closeCb, verticalNavIndex, this);
    this.showBottomSheet(single_selector);
  }

  KaiRouter.prototype.hideSingleSelector = function() {
    this.hideBottomSheet();
  }

  KaiRouter.prototype.showMultiSelector = function(title, options, selectText, selectCb, saveText, saveCb, cancelText, cancelCb, closeCb, verticalNavIndex = -1) {
    if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      document.activeElement.blur();
    }
    const multi_selector = Kai.createMultiSelector(title, options, selectText, selectCb, saveText, saveCb, cancelText, cancelCb, closeCb, verticalNavIndex, this);
    this.showBottomSheet(multi_selector);
  }

  KaiRouter.prototype.hideMultiSelector = function() {
    this.hideBottomSheet();
  }

  KaiRouter.prototype.showDatePicker = function(year, month, day = 1, selectCb, closeCb) {
    if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      document.activeElement.blur();
    }
    const date_picker = Kai.createDatePicker(year, month, day, selectCb, closeCb, this);
    this.showBottomSheet(date_picker);
  }

  KaiRouter.prototype.hideDatePicker = function() {
    this.hideBottomSheet();
  }

  KaiRouter.prototype.showTimePicker = function(hour, minute, is12H = true, selectCb, closeCb) {
    if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
      document.activeElement.blur();
    }
    const time_picker = Kai.createTimePicker(hour, minute, is12H, selectCb, closeCb, this);
    this.showBottomSheet(time_picker);
  }

  KaiRouter.prototype.hideTimePicker = function() {
    this.hideBottomSheet();
  }

  KaiRouter.prototype.calcRouterHeight = function() {
    var padding = 0;
    const body = document.getElementById('__kai_router__');
    const header = document.getElementById('__kai_header__');
    if (header) {
      padding += 28;
      body.classList.add('kui-router-m-top');
    }
    const sk = document.getElementById('__kai_soft_key__');
    if (sk) {
      padding += 30;
      body.classList.add('kui-router-m-bottom');
      
    }
    if (padding === 28) {
      body.classList.add('kui-router-h-hdr');
    } else if (padding === 30) {
      body.classList.add('kui-router-h-sk');
    } else if (padding === 58) {
      body.classList.add('kui-router-h-hdr-sk');
    }
  }

  KaiRouter.prototype.mountLoading = function() {
    const EL = document.getElementById('__kai_loading__');
    if (EL) {
      this.loading = Kai.createLoading(EL, this);
      this.loading.mount('__kai_loading__');
    }
  }

  KaiRouter.prototype.mountHeader = function() {
    const EL = document.getElementById('__kai_header__');
    if (EL) {
      this.header = Kai.createHeader(EL, this);
      this.header.mount('__kai_header__');
      this.header.methods.setHeaderTitle(this.title);
    }
  }

  KaiRouter.prototype.setHeaderTitle = function(txt) {
    this.header.methods.setHeaderTitle(txt);
  }

  KaiRouter.prototype.mountSoftKey = function() {
    const EL = document.getElementById('__kai_soft_key__');
    if (EL) {
      this.softwareKey = Kai.createSoftKey(EL, this);
      this.softwareKey.mount('__kai_soft_key__');
      this.softwareKey.methods.setLeftText('');
      this.softwareKey.methods.setCenterText('');
      this.softwareKey.methods.setRightText('');
    }
  }

  KaiRouter.prototype.mountToast = function() {
    const EL = document.getElementById('__kai_toast__');
    if (EL) {
      this.toast = Kai.createToast(EL);
      this.toast.mount('__kai_toast__');
    }
  }

  KaiRouter.prototype.showToast = function(text) {
    this.toast.methods.showToast(text);
  }

  KaiRouter.prototype.showLoading = function(freeze) {
    this.loading.methods.showLoading(freeze);
  }

  KaiRouter.prototype.hideLoading = function() {
    this.loading.methods.hideLoading();
  }

  KaiRouter.prototype.setSoftKeyText = function(l, c, r) {
    this.softwareKey.methods.setText(l, c, r);
  }

  KaiRouter.prototype.setSoftKeyLeftText = function(txt) {
    this.softwareKey.methods.setLeftText(txt);
  }

  KaiRouter.prototype.setSoftKeyCenterText = function(txt) {
    this.softwareKey.methods.setCenterText(txt);
  }

  KaiRouter.prototype.setSoftKeyRightText = function(txt) {
    this.softwareKey.methods.setRightText(txt);
  }

  KaiRouter.prototype.clickLeft = function() {
    if (this.stack[this.stack.length - 1]) {
      if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        if (typeof this.stack[this.stack.length - 1].softKeyInputFocusListener.left === 'function') {
          this.stack[this.stack.length - 1].softKeyInputFocusListener.left();
        }
        return;
      }
      if (typeof this.stack[this.stack.length - 1].softKeyListener.left === 'function') {
        this.stack[this.stack.length - 1].softKeyListener.left();
      }
    }
  }

  KaiRouter.prototype.clickCenter = function() {
    if (this.stack[this.stack.length - 1]) {
      if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        if (typeof this.stack[this.stack.length - 1].softKeyInputFocusListener.center === 'function') {
          this.stack[this.stack.length - 1].softKeyInputFocusListener.center();
        }
        return;
      }
      if (typeof this.stack[this.stack.length - 1].softKeyListener.center === 'function') {
        this.stack[this.stack.length - 1].softKeyListener.center();
      }
    }
  }

  KaiRouter.prototype.clickRight = function() {
    if (this.stack[this.stack.length - 1]) {
      if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        if (typeof this.stack[this.stack.length - 1].softKeyInputFocusListener.right === 'function') {
          this.stack[this.stack.length - 1].softKeyInputFocusListener.right();
        }
        return;
      }
      if (typeof this.stack[this.stack.length - 1].softKeyListener.right === 'function') {
        this.stack[this.stack.length - 1].softKeyListener.right();
      }
    }
  }

  KaiRouter.prototype.arrowUp = function() {
    if (this.stack[this.stack.length - 1]) {
      if (typeof this.stack[this.stack.length - 1].dPadNavListener.arrowUp === 'function') {
        this.stack[this.stack.length - 1].dPadNavListener.arrowUp();
      }
    }
  }

  KaiRouter.prototype.arrowRight = function() {
    if (this.stack[this.stack.length - 1]) {
      if (typeof this.stack[this.stack.length - 1].dPadNavListener.arrowRight === 'function') {
        this.stack[this.stack.length - 1].dPadNavListener.arrowRight();
      }
    }
  }

  KaiRouter.prototype.arrowDown = function() {
    if (this.stack[this.stack.length - 1]) {
      if (typeof this.stack[this.stack.length - 1].dPadNavListener.arrowDown === 'function') {
        this.stack[this.stack.length - 1].dPadNavListener.arrowDown();
      }
    }
  }

  KaiRouter.prototype.arrowLeft = function() {
    if (this.stack[this.stack.length - 1]) {
      if (typeof this.stack[this.stack.length - 1].dPadNavListener.arrowLeft === 'function') {
        this.stack[this.stack.length - 1].dPadNavListener.arrowLeft();
      }
    }
  }

  KaiRouter.prototype.backKey = function() {
    if (this.stack[this.stack.length - 1]) {
      if (typeof this.stack[this.stack.length - 1].backKeyListener === 'function') {
        return this.stack[this.stack.length - 1].backKeyListener();
      }
    }
  }

  KaiRouter.prototype.handleKeydown = function(e, _router) {
    if (this.loading != null) {
      if (this.loading.data.status === true) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    switch(e.key) {
      case 'Backspace':
      case 'EndCall':
        if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
          if (document.activeElement.value.length === 0) {
            document.activeElement.blur();
          }
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (_router) {
          const isStop = _router.backKey();
          if (isStop === true) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (_router.bottomSheet) {
            _router.hideBottomSheet();
            e.preventDefault();
            e.stopPropagation();
          } else {
            if (_router.pop()) {
              e.preventDefault();
              e.stopPropagation();
            }
          }
        }
        break
      case 'SoftLeft':
        if (_router) {
          _router.clickLeft();
        }
        break
      case 'SoftRight':
        if (_router) {
          _router.clickRight();
        }
        break
      case 'Enter':
        if (_router) {
          _router.clickCenter();
        }
        break
      case 'ArrowUp':
        if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
          document.activeElement.blur();
        }
        if (_router) {
          _router.arrowUp();
        }
        break
      case 'ArrowRight':
        if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
          return;
        }
        if (_router) {
          _router.arrowRight();
        }
        break
      case 'ArrowDown':
        if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
          document.activeElement.blur();
        }
        if (_router) {
          _router.arrowDown();
        }
        break
      case 'ArrowLeft':
        if ((document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
          return;
        }
        if (_router) {
          _router.arrowLeft();
        }
        break
    }
  }

  return KaiRouter;

})();
