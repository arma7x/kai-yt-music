Kai.createComponent = function(options) {
  options.disableKeyListener = true;
  return new Kai(options);
}

Kai.createTabNav = function(name, horizontalNavClass, tabs) {
  return new Kai({
    name: name,
    data: {},
    components: tabs,
    horizontalNavClass: horizontalNavClass,
    template: '<div><ul id="' + horizontalNavClass.replace('.', '') + '" class="kui-tab"></ul><div id="__kai_tab__"></div></div>',
    mounted: function() {
      if (this.$state) {
        this.$state.addGlobalListener(this.methods.globalState);
      }

      const sk = document.getElementById('__kai_soft_key__');

      const tabHeader = document.getElementById(this.horizontalNavClass.replace('.', ''));
      if (tabHeader) {
        this.components.forEach((v, i) => {
          if (v instanceof Kai) {
            if (this.$router) {
              v.$router = this.$router;
            }
            if (this.$state) {
              v.$state = this.$state;
            }
            v.id = '__kai_tab__';
          }
          const li = document.createElement("LI");
          li.innerText = v.name;
          li.setAttribute("class", this.horizontalNavClass.replace('.', ''));
          li.setAttribute("tabIndex", i);
          tabHeader.appendChild(li);
        });

        const tabNav = document.querySelectorAll(this.horizontalNavClass);
        if (tabNav.length > 0 && this.id !== '__kai_header__' && this.id !==  '__kai_soft_key__') {
          if (this.horizontalNavIndex === -1) {
            this.horizontalNavIndex = 0;
          }
          const cur = tabNav[this.horizontalNavIndex];
          cur.focus();
          cur.classList.add('focus');
          cur.parentElement.scrollLeft = cur.offsetLeft - cur.offsetWidth;
          const component = this.components[this.horizontalNavIndex];
          if (component instanceof Kai) {
            component.mount('__kai_tab__');
            this.$router.setSoftKeyText(component.softKeyText.left, component.softKeyText.center, component.softKeyText.right);
          } else {
            const __kai_tab__ = document.getElementById('__kai_tab__');
            __kai_tab__.innerHTML = component;
            __kai_tab__.scrollTop = this.scrollThreshold;
            this.$router.setSoftKeyText(this.softKeyText.left, this.softKeyText.center, this.softKeyText.right);
          }

          const tabBody = document.getElementById('__kai_tab__');
          if (tabBody) {
            var padding = 0;
            const header = document.getElementById('__kai_header__');
            if (header) {
              padding += 28;
            }
            if (sk) {
              padding += 30;
            }
            const tabHeader = document.getElementById(this.horizontalNavClass.replace('.', ''));
            if (tabHeader) {
              padding += 30;
            }
            if (padding === 28) {
              tabBody.classList.add('kui-tab-h-28');
            } else if (padding === 30) {
              tabBody.classList.add('kui-tab-h-30');
            } else if (padding === 60) {
              tabBody.classList.add('kui-tab-h-60');
            } else if (padding === 58) {
              tabBody.classList.add('kui-tab-h-58');
            } else if (padding === 88) {
              tabBody.classList.add('kui-tab-h-88');
            }
          }
        }
      }
    },
    unmounted: function() {
      if (this.$state) {
        this.$state.removeGlobalListener(this.methods.globalState);
      }
      this.components.forEach((v, i) => {
        if (v instanceof Kai) {
          v.id = undefined;
        }
      });
    },
    methods: {
      globalState: function(data) {
        if (this.$router) {
          if (this.$router.stack[this.$router.stack.length - 1]) {
            if (this.$router.stack[this.$router.stack.length - 1].name === this.name) {
              const component = this.components[this.horizontalNavIndex];
              component.render();
            }
          }
        }
        
      }
    },
    backKeyListener: function() {
      if (!this.$router.bottomSheet) {
        this.scrollThreshold = 0;
        this.verticalNavIndex = -1;
        this.horizontalNavIndex = -1;
        this.components.forEach((v, i) => {
          if (v instanceof Kai) {
            v.scrollThreshold = 0;
            v.verticalNavIndex = -1;
            v.horizontalNavIndex = -1;
            v.components = [];
            this.components[i].reset();
          }
        });
      }
    },
    softKeyListener: {
      left: function() {
        const component = this.components[this.horizontalNavIndex];
        if (component instanceof Kai) {
          component.softKeyListener.left();
        }
      },
      center: function() {
        const component = this.components[this.horizontalNavIndex];
        if (component instanceof Kai) {
          component.softKeyListener.center();
        }
      },
      right: function() {
        const component = this.components[this.horizontalNavIndex];
        if (component instanceof Kai) {
          component.softKeyListener.right();
        }
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        const component = this.components[this.horizontalNavIndex];
        if (component instanceof Kai) {
          component.dPadNavListener.arrowUp();
        } else {
          const __kai_tab__ = document.getElementById('__kai_tab__');
          __kai_tab__.scrollTop -= 20;
          this.scrollThreshold = __kai_tab__.scrollTop;
        }
        
      },
      arrowRight: function() {
        this.navigateTabNav(1);
        const __kai_tab__ = document.getElementById('__kai_tab__');
        const component = this.components[this.horizontalNavIndex];
        if (component instanceof Kai) {
          component.mount('__kai_tab__');
          __kai_tab__.scrollTop = component.scrollThreshold;
          this.$router.setSoftKeyText(component.softKeyText.left, component.softKeyText.center, component.softKeyText.right);
        } else {
          __kai_tab__.innerHTML = component;
          __kai_tab__.scrollTop = this.scrollThreshold;
          this.$router.setSoftKeyText(this.softKeyText.left, this.softKeyText.center, this.softKeyText.right);
        }
      },
      arrowDown: function() {
        const component = this.components[this.horizontalNavIndex];
        if (component instanceof Kai) {
          component.dPadNavListener.arrowDown();
        } else {
          const __kai_tab__ = document.getElementById('__kai_tab__');
          __kai_tab__.scrollTop += 20;
          this.scrollThreshold = __kai_tab__.scrollTop;
        }
      },
      arrowLeft: function() {
        this.navigateTabNav(-1);
        const __kai_tab__ = document.getElementById('__kai_tab__');
        const component = this.components[this.horizontalNavIndex];
        if (component instanceof Kai) {
          component.mount('__kai_tab__');
          __kai_tab__.scrollTop = component.scrollThreshold;
          this.$router.setSoftKeyText(component.softKeyText.left, component.softKeyText.center, component.softKeyText.right);
        } else {
          __kai_tab__.innerHTML = component;
          __kai_tab__.scrollTop = this.scrollThreshold;
          this.$router.setSoftKeyText(this.softKeyText.left, this.softKeyText.center, this.softKeyText.right);
        }
      },
    }
  });
}

Kai.createLoading = function(EL, $router) {
  return new Kai({
    name: '_loading_',
    disableKeyListener: true,
    data: {
      status: false
    },
    template: '<div class="slider"><div class="line"></div><div class="break dot1"></div><div class="break dot2"></div><div class="break dot3"></div></div>',
    mounted: function() {
      EL.classList.add('kai-loading');
      this.methods.hideLoading();
    },
    methods: {
      showLoading: function(freeze = true) {
        EL.classList.remove('sr-only');
        this.data.status = freeze;
      },
      hideLoading: function() {
        EL.classList.add('sr-only');
        this.data.status = false;
      }
    }
  });
}

Kai.createHeader = function(EL, $router) {
  return new Kai({
    name: '_header_',
    disableKeyListener: true,
    data: {
      title: ''
    },
    template: '{{ title }}',
    mounted: function() {
      EL.classList.add('kui-header');
    },
    methods: {
      setHeaderTitle: function(txt) {
        this.setData({ title: txt });
      }
    }
  });
}

Kai.createSoftKey = function(EL, $router) {
  return new Kai({
    name: '_software_key_',
    disableKeyListener: true,
    data: {
      left: '',
      center: '',
      right: ''
    },
    template: '<div @click="clickLeft()" class="kui-software-key-left">{{ left }}</div><div @click="clickCenter()" class="kui-software-key-center">{{ center }}</div><div @click="clickRight()" class="kui-software-key-right">{{ right }}</div>',
    mounted: function() {
      EL.classList.add('kui-software-key');
    },
    methods: {
      setText: function(l, c, r) {
        this.setData({ left: l, center: c, right: r });
      },
      setLeftText: function(txt) {
        this.setData({ left: txt });
      },
      clickLeft: function() {
        $router.clickLeft();
      },
      setCenterText: function(txt) {
        this.setData({ center: txt });
      },
      clickCenter: function() {
        $router.clickCenter();
      },
      setRightText: function(txt) {
        this.setData({ right: txt });
      },
      clickRight: function() {
        $router.clickRight();
      },
    }
  });
}

Kai.createToast = function(EL) {
  var TM;

  return new Kai({
    name: '_toast_',
    disableKeyListener: true,
    data: {
      text: ''
    },
    template: '{{ text }}',
    mounted: function() {
      EL.classList.add('kui-toast');
    },
    methods: {
      showToast: function(txt) {
        if (TM) {
          clearTimeout(TM);
        }
        this.setData({ text: txt });
        EL.classList.add('kui-toast-visible');
        TM = setTimeout(function() {
          EL.classList.remove('kui-toast-visible');
        }, 2000);
      }
    }
  });
}

Kai.createDialog = function(title, body, dataCb, positiveText, positiveCb, negativeText, negativeCb, neutralText, neutralCb, closeCb, $router) {
  return new Kai({
    name: 'dialog',
    data: {
      title: title,
      body: body
    },
    template: '<div class="kui-option-menu"><div class="kui-option-title">{{ title }}</div><div class="kui-option-body kai-padding-5">{{{ body }}}</div></div>',
    softKeyText: { left: negativeText || 'Cancel', center: neutralText || '', right: positiveText || 'Yes' },
    softKeyListener: {
      left: function() {
        if ($router) {
          $router.hideDialog();
        }
        if (typeof negativeCb === 'function') {
          negativeCb(dataCb);
        }
      },
      center: function() {
        if ($router) {
          $router.hideDialog();
        }
        if (typeof neutralCb === 'function') {
          neutralCb(dataCb);
        }
      },
      right: function() {
        if ($router) {
          $router.hideDialog();
        }
        if (typeof positiveCb === 'function') {
          positiveCb(dataCb);
        }
      }
    },
    mounted: function() {
      setTimeout(() => {
        this.navigateListNav(1);
      }, 100);
    },
    unmounted: function() {
      if (closeCb) {
        closeCb();
      }
    },
    backKeyListener: function() {
    }
  });
}

Kai.createOptionMenu = function(title, options, selectText, selectCb, closeCb, verticalNavIndex = -1, $router) {

  const sr = `, Press Enter to ${selectText}, Presss Back to return,`;
  var tabIndex = document.querySelectorAll("[tabIndex").length;
  options.forEach((opt, idx) => {
    opt['_tabIndex'] = tabIndex;
    tabIndex += 1;
    opt['_idx'] = idx + 1;
  });

  return new Kai({
    name: 'option_menu',
    data: {
      title: title,
      options: options
    },
    verticalNavClass: '.optMenuNav',
    verticalNavIndex: verticalNavIndex,
    template: '\
    <div class="kui-option-menu">\
      <div class="kui-option-title">{{ title }}</div>\
      <div class="kui-option-body">\
        <ul id="kui-options" class="kui-options">\
          {{#options}}\
            <li class="optMenuNav" tabIndex="{{_tabIndex}}" @click=\'selectOption({{__stringify__}})\'><span class="sr-only">{{ _idx }}, {{text}}{{#subtext}}, {{subtext}}{{/subtext}}' + sr + '</span><span>{{text}}</span>{{#subtext}}</br><small>{{subtext}}</small>{{/subtext}}</li>\
          {{/options}}\
        </ul>\
      </div>\
    </div>',
    methods: {
      selectOption: function(data) {
        if ($router) {
          $router.hideOptionMenu();
        }
        if (typeof selectCb === 'function') {
          const d = options[this.verticalNavIndex];
          if (d) {
            selectCb(d);
          } else {
            selectCb(this.verticalNavIndex);
          }
        }
      }
    },
    unmounted: function() {
      if (closeCb) {
        closeCb();
      }
    },
    softKeyText: { left: '', center: selectText.toUpperCase() || 'SELECT', right: '' },
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
      },
      arrowRight: function() {},
      arrowDown: function() {
        this.navigateListNav(1);
      },
      arrowLeft: function() {},
    },
    backKeyListener: function() {
    }
  });
}

Kai.createSingleSelector = function(title, options, selectText, selectCb, cancelText, cancelCb, closeCb, verticalNavIndex = -1, $router) {

  const marginLeft = navigator.b2g ? '0px' : '-25px';
  const sr = `, Press Enter to ${selectText}, Presss Back to return,`;
  var tabIndex = document.querySelectorAll("[tabIndex").length;
  options.forEach((opt, idx) => {
    opt['_tabIndex'] = tabIndex;
    tabIndex += 1;
    opt['_idx'] = idx + 1;
  });

  options = JSON.parse(JSON.stringify(options));
  options.forEach(function(v,k) {
    if (k === verticalNavIndex) {
      options[k]['checked'] = true;
    } else {
      options[k]['checked'] = false;
    }
  });

  return new Kai({
    name: 'single_selector',
    data: {
      title: title,
      options: options
    },
    verticalNavClass: '.optSSNav',
    verticalNavIndex: verticalNavIndex,
    template: '\
    <div class="kui-option-menu">\
      <div class="kui-option-title">{{ title }}</div>\
      <div class="kui-option-body">\
        <ul id="kui-options" class="kui-options">\
          {{#options}}\
            <li class="optSSNav" tabIndex="{{_tabIndex}}" @click=\'selectOption({{__stringify__}})\'>\
              <div class="kui-row-center">\
                <span class="sr-only">{{ _idx }}, {{text}}, {{#checked}} Selected{{/checked}}{{^checked}} Unselected{{/checked}}' + sr + '</span><span style="margin-left:' + marginLeft + ';height:100%;width:80%;overflow:hidden;text-overflow: ellipsis;">{{text}}</span>\
                {{#checked}}\
                  <label class="radio"><input type="radio" name="radio" checked><span></span></label>\
                {{/checked}}\
                {{^checked}}\
                  <label class="radio"><input type="radio" name="radio"><span></span></label>\
                {{/checked}}\
              </div>\
            </li>\
          {{/options}}\
        </ul>\
      </div>\
    </div>',
    methods: {
      selectOption: function(data) {
        if ($router) {
          $router.hideSingleSelector();
        }
        if (typeof selectCb === 'function') {
          const d = options[this.verticalNavIndex];
          if (d) {
            selectCb(d);
          } else {
            selectCb(this.verticalNavIndex);
          }
        }
      }
    },
    softKeyText: { left: cancelText || 'Cancel', center: selectText.toUpperCase() || 'SELECT', right: '' },
    softKeyListener: {
      left: function() {
        if ($router) {
          $router.hideSingleSelector();
        }
        if (typeof cancelCb === 'function') {
          cancelCb(data);
        }
      },
      center: function() {
        const listNav = document.querySelectorAll(this.verticalNavClass);
        if (this.verticalNavIndex > -1) {
          listNav[this.verticalNavIndex].click();
        }
      },
      right: function() {}
    },
    unmounted: function() {
      if (closeCb) {
        closeCb();
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
      },
      arrowRight: function() {},
      arrowDown: function() {
        this.navigateListNav(1);
      },
      arrowLeft: function() {},
    },
    backKeyListener: function() {
    }
  });
}

Kai.createMultiSelector = function(title, options, selectText, selectCb, saveText, saveCb, cancelText, cancelCb, closeCb, verticalNavIndex = -1, $router) {

  const marginLeft = navigator.b2g ? '0px' : '-25px';
  const sr = `, Press Right Key to ${saveText.trim().length > 0 ? saveText.trim() : 'Save'}, Presss Back to return,`;
  var tabIndex = document.querySelectorAll("[tabIndex").length;
  options.forEach((opt, idx) => {
    opt['_tabIndex'] = tabIndex;
    tabIndex += 1;
    opt['_idx'] = idx + 1;
  });

  options = JSON.parse(JSON.stringify(options));
  const focus = options[verticalNavIndex === -1 ? 0 : verticalNavIndex];
  if (focus) {
    if (focus.checked) {
      selectText = 'DESELECT';
    } else {
      selectText = 'SELECT';
    }
  }

  const multi_selector = new Kai({
    name: 'multi_selector',
    data: {
      title: title,
      options: options
    },
    verticalNavClass: '.optMSNav',
    verticalNavIndex: verticalNavIndex,
    template: '\
    <div class="kui-option-menu">\
      <div class="kui-option-title">{{ title }}</div>\
      <div class="kui-option-body">\
        <ul id="kui-options" class="kui-options">\
          {{#options}}\
            <li class="optMSNav" tabIndex="{{_tabIndex}}" @click=\'selectOption({{__stringify__}})\'>\
              <div class="kui-row-center">\
                <span class="sr-only">{{ _idx }}, {{text}}, {{#checked}} Selected, Press Enter to deselect{{/checked}}{{^checked}} Unselected, Press Enter to select{{/checked}}' + sr + '</span><span style="margin-left:' + marginLeft + ';height:100%;width:80%;overflow:hidden;text-overflow: ellipsis;">{{text}}</span>\
                {{#checked}}\
                  <label class="checkbox"><input type="checkbox" checked><span></span></label>\
                {{/checked}}\
                {{^checked}}\
                  <label class="checkbox"><input type="checkbox"><span></span></label>\
                {{/checked}}\
              </div>\
            </li>\
          {{/options}}\
        </ul>\
      </div>\
    </div>',
    methods: {
      selectOption: function(data) {
        const d = options[this.verticalNavIndex];
        if (d) {
          d['checked'] = !d['checked'];
          const idx = this.data.options.findIndex((opt) => {
            return opt.text === d.text;
          });
          if (idx > -1) {
            this.data.options[idx] = d;
            if (d.checked) {
              $router.setSoftKeyCenterText('DESELECT');
            } else {
              $router.setSoftKeyCenterText('SELECT');
            }
            this.setData({ options: this.data.options });
          }
        }
        if (typeof selectCb === 'function') {
          if (d) {
            selectCb(d);
          } else {
            selectCb(this.verticalNavIndex);
          }
        }
      }
    },
    softKeyText: { left: cancelText || 'Cancel', center: selectText.toUpperCase() || 'SELECT', right: saveText || 'Save' },
    softKeyListener: {
      left: function() {
        if ($router) {
          $router.hideSingleSelector();
        }
        if (typeof cancelCb === 'function') {
          cancelCb(data);
        }
      },
      center: function() {
        const listNav = document.querySelectorAll(this.verticalNavClass);
        if (this.verticalNavIndex > -1) {
          listNav[this.verticalNavIndex].click();
        }
      },
      right: function() {
        if ($router) {
          $router.hideSingleSelector();
        }
        if (typeof saveCb === 'function') {
          saveCb(this.data.options);
        }
      }
    },
    unmounted: function() {
      if (closeCb) {
        closeCb();
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
        const focus = this.data.options[this.verticalNavIndex];
        if (focus) {
          if (focus.checked) {
            $router.setSoftKeyCenterText('DESELECT');
          } else {
            $router.setSoftKeyCenterText('SELECT');
          }
        }
      },
      arrowRight: function() {},
      arrowDown: function() {
        this.navigateListNav(1);
        const focus = this.data.options[this.verticalNavIndex];
        if (focus) {
          if (focus.checked) {
            $router.setSoftKeyCenterText('DESELECT');
          } else {
            $router.setSoftKeyCenterText('SELECT');
          }
        }
      },
      arrowLeft: function() {},
    },
    backKeyListener: function() {
    }
  });
  return multi_selector.reset();
}

Kai.createDatePicker = function(year, month, day = 1, selectCb, closeCb, $router) {

  function formatString(val) {
    val = val.toString();
    if (val === '-')
      return val;
    const l = val[val.length - 1];
    if (l === '1')
      val = val + 'st';
    else if (l === '2')
      val = val + 'nd';
    else if (l === '3')
      val = val + 'rd';
    else
      val = val + 'th';
    return val;
  }

  var tabIndex = document.querySelectorAll("[tabIndex").length;

  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const today = new Date();
  day = day == undefined ? today.getDate() : day;
  month = month || today.getMonth() + 1;
  year = year || today.getFullYear();
  var MAX_DAY = new Date(year, month, 0).getDate();
  day = day <= MAX_DAY ? day : 1;

  return new Kai({
    name: 'date_picker',
    data: {
      title: 'Select Date',
      yearT: year - 1,
      yearM: year,
      yearB: year + 1,
      monthT: MONTHS[(month - 1) - 1] ? MONTHS[(month - 1) - 1] : '-',
      monthM: MONTHS[month - 1],
      monthB: MONTHS[(month - 1) + 1] ? MONTHS[(month - 1) + 1] : '-',
      dayT: day - 1 < 1 ? '-' : (day - 1),
      dayM: day,
      dayB: day + 1 > MAX_DAY ? '-' : (day + 1),
      _dayT: day - 1 < 1 ? '-' : formatString((day - 1)),
      _dayM: formatString(day),
      _dayB: day + 1 > MAX_DAY ? '-' : formatString((day + 1)),
      selector: 0
    },
    template: '\
    <div class="kui-option-menu">\
      <div class="kui-option-title">{{ title }}</div>\
      <div class="kui-option-body">\
        <div class="kui-lcr-container">\
          <div class="kai-left-col">\
            <div aria-hidden="true" class="kai-lcr-top">{{ _dayT }}</div>\
            <div id="__kai_dp_day__" tabindex="' + (tabIndex + 1) + '" class="kai-lcr-mid"><span class="sr-only">Day of {{ _dayM }}, press Arrow Up or Arrow Down to change day, press Enter to save, Back to cancel, or Arrow Right to set month,</span><span aria-hidden="true">{{ _dayM }}</span></div>\
            <div aria-hidden="true" class="kai-lcr-bottom">{{ _dayB }}</div>\
          </div>\
          <div class="kai-center-col">\
            <div aria-hidden="true" class="kai-lcr-top">{{ monthT }}</div>\
            <div id="__kai_dp_month__" tabindex="' + (tabIndex + 1) + '" class="kai-lcr-mid"><span class="sr-only">Month of {{ monthM }}, press Arrow Up or Arrow Down to change month, press Enter to save, Back to cancel, Arrow Left to set day, or Arrow Right to set year,</span><span aria-hidden="true">{{ monthM }}</span></div>\
            <div aria-hidden="true" class="kai-lcr-bottom">{{ monthB }}</div>\
          </div>\
          <div class="kai-right-col">\
            <div aria-hidden="true" class="kai-lcr-top">{{ yearT }}</div>\
            <div id="__kai_dp_year__" tabindex="' + (tabIndex + 1) + '" class="kai-lcr-mid"><span class="sr-only">Year of {{ yearM }}, press Arrow Up or Arrow Down to change year, press Enter to save, Back to cancel, Arrow Left to set month, or Arrow Right to set day,</span><span aria-hidden="true">{{ yearM }}</span></div>\
            <div aria-hidden="true" class="kai-lcr-bottom">{{ yearB }}</div>\
          </div>\
        </div>\
      </div>\
    </div>',
    mounted: function() {
      setTimeout(() => {
        document.activeElement.blur();
        this.methods.focus();
      }, 110);
    },
    unmounted: function() {
      document.activeElement.blur();
      if (closeCb) {
        closeCb();
      }
    },
    methods: {
      focus: function() {
        if (this.data.selector === 0) {
          document.getElementById('__kai_dp_day__').classList.add('kai-focus');
          document.getElementById('__kai_dp_day__').focus();
          document.getElementById('__kai_dp_month__').classList.remove('kai-focus');
          document.getElementById('__kai_dp_year__').classList.remove('kai-focus');
        } else if (this.data.selector === 1) {
          document.getElementById('__kai_dp_day__').classList.remove('kai-focus');
          document.getElementById('__kai_dp_month__').classList.add('kai-focus');
          document.getElementById('__kai_dp_month__').focus();
          document.getElementById('__kai_dp_year__').classList.remove('kai-focus');
        } else {
          document.getElementById('__kai_dp_day__').classList.remove('kai-focus');
          document.getElementById('__kai_dp_month__').classList.remove('kai-focus');
          document.getElementById('__kai_dp_year__').classList.add('kai-focus');
          document.getElementById('__kai_dp_year__').focus();
        }
      },
      setValue: function (val) {
        if (this.data.selector === 0) {
          const dayM = this.data.dayM + val;
          if (dayM > MAX_DAY || dayM < 1) {
            return;
          }
          const dayT = dayM - 1 < 1 ? '-' : (dayM - 1);
          const dayB = dayM + 1 > MAX_DAY ? '-' : (dayM + 1);
          this.setData({ dayT, _dayT: formatString(dayT), dayM, _dayM: formatString(dayM), dayB, _dayB: formatString(dayB) });
        } else if (this.data.selector === 1) {
          const oldMD = MAX_DAY;
          var idx = MONTHS.indexOf(this.data.monthM);
          idx += val;
          if (idx > 11 || idx < 0) {
            return
          }
          const monthT = MONTHS[idx - 1] ? MONTHS[idx - 1] : '-';
          const monthM = MONTHS[idx];
          const monthB = MONTHS[idx + 1] ? MONTHS[idx + 1] : '-';
          this.setData({ monthT, monthM, monthB });
          MAX_DAY = new Date(this.data.yearM, idx + 1, 0).getDate();
          if (this.data.dayM > MAX_DAY) {
            this.setData({ dayT: this.data.dayT - 1, dayM: this.data.dayM - 1, dayB: '-' });
          } else if (MAX_DAY > this.data.dayM && oldMD === this.data.dayM) {
            this.setData({ dayB: this.data.dayM + 1 });
          } else if (MAX_DAY === this.data.dayM && MAX_DAY < oldMD) {
            this.setData({ dayB: '-' });
          }
        } else {
          const yearM = this.data.yearM + val;
          const yearT = yearM - 1;
          const yearB = yearM + 1;
          this.setData({ yearT, yearM, yearB });
        }
        this.methods.focus();
      }
    },
    softKeyText: { left: 'Cancel', center: 'Save', right: '' },
    softKeyListener: {
      left: function() {
        if ($router) {
          $router.hideDatePicker();
        }
      },
      center: function() {
        if ($router) {
          $router.hideDatePicker();
        }
        if (typeof selectCb === 'function') {
          selectCb(new Date(this.data.yearM, MONTHS.indexOf(this.data.monthM), this.data.dayM));
        }
      },
      right: function() {}
    },
    dPadNavListener: {
      arrowUp: function() {
        this.methods.setValue(-1);
      },
      arrowDown: function() {
        this.methods.setValue(1);
      },
      arrowRight: function() {
        if (this.data.selector === 2) {
          this.setData({ selector: 0 });
        } else {
          this.setData({ selector: this.data.selector + 1 });
        }
        this.methods.focus();
      },
      arrowLeft: function() {
        if (this.data.selector === 0) {
          this.setData({ selector: 2 });
        } else {
          this.setData({ selector: this.data.selector - 1 });
        }
        this.methods.focus();
      }
    },
    backKeyListener: function() {
    }
  });
}

Kai.createTimePicker = function(hour, minute, is12H, selectCb, closeCb, $router) {

  var tabIndex = document.querySelectorAll("[tabIndex").length;

  const today = new Date();

  function isBrowserLocale12h()  {
    var dateString = today.toLocaleTimeString();
    if (dateString.match(/am|pm/i) || today.toString().match(/am|pm/i)) {
      return true;
    }
    return false;
  }

  function twoChar(n) {
    return n < 10 ? '0' + n.toString() : n;
  }

  hour = hour == undefined ? today.getHours() : hour;
  minute = minute == undefined ? today.getMinutes() : minute;
  is12H = is12H == undefined ? isBrowserLocale12h() : true;
  hour = hour > 23 ? 0 : hour;
  minute = minute > 59 ? 0 : minute;

  var  periodT = '-';
  var  periodM = '-';
  var  periodB = '-';

  if (is12H) {
    if (hour >= 12) {
      hour = hour > 12 ? hour - 12 : hour;
      periodT = 'AM';
      periodM = 'PM';
      periodB = '-';
    } else {
      periodT = '-';
      periodM = 'AM';
      periodB = 'PM';
    }
  } else {
    periodT = '-';
    periodM = '-';
    periodB = '-';
  }

  return new Kai({
    name: 'time_picker',
    data: {
      title: 'Select Time',
      hourT: is12H ? (hour - 1 > 0 ? twoChar(hour - 1) : '-') : (hour - 1 > -1 ? twoChar(hour - 1) : '-'),
      hourM: twoChar(hour),
      _hourM: hour,
      hourB: is12H ? (hour + 1 < 13 ? twoChar(hour + 1) : '-') : (hour + 1 < 24 ? twoChar(hour + 1) : '-'),
      minuteT: minute - 1 < 0 ? '-' : twoChar(minute - 1),
      minuteM: twoChar(minute),
      _minuteM: minute,
      minuteB: minute + 1 > 59 ? '-' : twoChar(minute + 1),
      periodT: periodT,
      periodM: periodM,
      periodB: periodB,
      is12H: is12H,
      selector: 0
    },
    template: '\
    <div class="kui-option-menu">\
      <div class="kui-option-title">{{ title }}</div>\
      <div class="kui-option-body">\
        <div class="kui-lcr-container">\
          <div class="kai-left-col">\
            <div aria-hidden="true" class="kai-lcr-top">{{ hourT }}</div>\
            <div id="__kai_dp_hour__" tabindex="' + (tabIndex + 1) + '" class="kai-lcr-mid"><span class="sr-only">Hour of {{ _hourM }}, press Arrow Up or Arrow Down to change hour, press Enter to save, Back to cancel, or Arrow Right to set minute,</span><span aria-hidden="true">{{ hourM }}</span></div>\
            <div aria-hidden="true" class="kai-lcr-bottom">{{ hourB }}</div>\
          </div>\
          <div class="kai-center-col">\
            <div aria-hidden="true" class="kai-lcr-top">{{ minuteT }}</div>\
            <div id="__kai_dp_minute__" tabindex="' + (tabIndex + 1) + '" class="kai-lcr-mid"><span class="sr-only">Minute of {{ _minuteM }}, press Arrow Up or Arrow Down to change minute, press Enter to save, Back to cancel,{{#is12H}} Arrow Left to set hour, or Arrow Right to set duration,{{/is12H}}{{^is12H}} or Arrow Left to set hour,{{/is12H}}</span><span aria-hidden="true">{{ minuteM }}</span></div>\
            <div aria-hidden="true" class="kai-lcr-bottom">{{ minuteB }}</div>\
          </div>\
          {{#is12H}}\
          <div class="kai-right-col">\
            <div aria-hidden="true" class="kai-lcr-top">{{ periodT }}</div>\
            <div id="__kai_dp_period__" tabindex="' + (tabIndex + 1) + '" class="kai-lcr-mid"><span class="sr-only">Duration is {{ periodM }}, press Arrow Up or Arrow Down to change duration, press Enter to save, Back to cancel, Arrow Left to set minute, or Arrow Right to set hour,</span><span aria-hidden="true">{{ periodM }}</span></div>\
            <div aria-hidden="true" class="kai-lcr-bottom">{{ periodB }}</div>\
          </div>\
          {{/is12H}}\
        </div>\
      </div>\
    </div>',
    mounted: function() {
      setTimeout(() => {
        document.activeElement.blur();
        this.methods.focus();
      }, 110);
    },
    unmounted: function() {
      document.activeElement.blur();
      if (closeCb) {
        closeCb();
      }
    },
    methods: {
      focus: function() {
        if (this.data.selector === 0) {
          document.getElementById('__kai_dp_hour__').classList.add('kai-focus');
          document.getElementById('__kai_dp_hour__').focus();
          document.getElementById('__kai_dp_minute__').classList.remove('kai-focus');
          if (this.data.is12H) {
            document.getElementById('__kai_dp_period__').classList.remove('kai-focus');
          }
        } else if (this.data.selector === 1) {
          document.getElementById('__kai_dp_hour__').classList.remove('kai-focus');
          document.getElementById('__kai_dp_minute__').classList.add('kai-focus');
          document.getElementById('__kai_dp_minute__').focus();
          if (this.data.is12H) {
            document.getElementById('__kai_dp_period__').classList.remove('kai-focus');
          }
        } else {
          document.getElementById('__kai_dp_hour__').classList.remove('kai-focus');
          document.getElementById('__kai_dp_minute__').classList.remove('kai-focus');
          if (this.data.is12H) {
            document.getElementById('__kai_dp_period__').classList.add('kai-focus');
            document.getElementById('__kai_dp_period__').focus();
          }
        }
      },
      setValue: function (val) {
        if (this.data.selector === 0) {
          var hourM = parseInt(this.data.hourM) + val;
          if (hourM < (this.data.is12H ? 1 : 0) || hourM > (this.data.is12H ? 12 : 23)) {
            return;
          }
          var hourT = !this.data.is12H ? (hourM - 1 > -1 ? twoChar(hourM - 1) : '-') : (hourM - 1 > 0 ? twoChar(hourM - 1) : '-');
          var hourB = !this.data.is12H ? (hourM + 1 < 24 ? twoChar(hourM + 1) : '-') : (hourM + 1 < 13 ? twoChar(hourM + 1) : '-');
          this.setData({ hourT, hourM: twoChar(hourM), _hourM: hourM, hourB });
        } else if (this.data.selector === 1) {
          var minuteM = parseInt(this.data.minuteM) + val;
          if (minuteM < 0 || minuteM > 59) {
            return;
          }
          var minuteT = minuteM - 1 < 0 ? '-' : twoChar(minuteM - 1);
          var minuteB = minuteM + 1 > 59 ? '-' : twoChar(minuteM + 1);
          this.setData({ minuteT, minuteM: twoChar(minuteM), _minuteM: minuteM, minuteB });
        } else {
          if (this.data.periodM === 'PM' && val === -1) {
            this.setData({ periodT: '-', periodM: 'AM', periodB: 'PM' });
          } else if (this.data.periodM === 'AM' && val === 1){
            this.setData({ periodT: 'AM', periodM: 'PM', periodB: '-' });
          }
        }
        this.methods.focus();
      }
    },
    softKeyText: { left: 'Cancel', center: 'Save', right: '' },
    softKeyListener: {
      left: function() {
        if ($router) {
          $router.hideTimePicker();
        }
      },
      center: function() {
        if ($router) {
          $router.hideTimePicker();
        }
        if (typeof selectCb === 'function') {
          var h = parseInt(this.data.hourM);
          var m = parseInt(this.data.minuteM)
          if (this.data.is12H) {
            if (parseInt(this.data.hourM) < 12 && this.data.periodM === 'PM') {
              h = parseInt(this.data.hourM) + 12;
            }
          }
          const dt = new Date();
          dt.setHours(h, m, 0);
          selectCb(dt);
        }
      },
      right: function() {}
    },
    dPadNavListener: {
      arrowUp: function() {
        this.methods.setValue(-1);
      },
      arrowDown: function() {
        this.methods.setValue(1);
      },
      arrowRight: function() {
        if (this.data.selector === 2) {
          this.setData({ selector: 0 });
        } else {
          this.setData({ selector: this.data.selector + 1 });
        }
        this.methods.focus();
      },
      arrowLeft: function() {
        if (this.data.selector === 0) {
          this.setData({ selector: 2 });
        } else {
          this.setData({ selector: this.data.selector - 1 });
        }
        this.methods.focus();
      }
    },
    backKeyListener: function() {
    }
  });
}
