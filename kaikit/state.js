const KaiState = (function() {

  function KaiState(initialState) {
    this.init(initialState);
  }

  KaiState.prototype.immutability = function(data) {
    const dataType = typeof data;
    return (dataType === 'string' || dataType === 'number') ? data : JSON.parse(JSON.stringify(data));
  }

  KaiState.prototype.init = function(initialState) {
    this.state = {};
    this.listener = {};
    this.globalListener = [];
    if (typeof initialState === 'object') {
      for (var name in initialState) {
        this.state[name] = this.immutability(initialState[name]);
        this.listener[name] = [];
      }
    }
  }

  KaiState.prototype.addState = function(name, data) {
    const dataType = typeof data;
    if (this.state[name] != undefined) {
      return this.setState(name, data);
    }
    this.state[name] = this.immutability(data);
    this.listener[name] = [];
    return true;
  }

  KaiState.prototype.addGlobalListener = function(cb) {
    if (typeof cb !== 'function') {
      return false;
    }
    this.globalListener.push(cb);
  }

  KaiState.prototype.removeGlobalListener = function(cb) {
    if (typeof cb !== 'function') {
      return false;
    }
    const index = this.globalListener.indexOf(cb);
    if (index > -1) {
      this.globalListener.splice(index, 1);
      return true;
    }
    return false;
  }

  KaiState.prototype.addStateListener = function(name, cb) {
    if (typeof cb !== 'function') {
      return false;
    }
    this.listener[name].push(cb);
  }

  KaiState.prototype.removeStateListener = function(name, cb) {
    if (typeof cb !== 'function') {
      return false;
    }
    if (this.listener[name] == undefined) {
      return false;
    }
    const index = this.listener[name].indexOf(cb);
    if (index > -1) {
      this.listener[name].splice(index, 1);
      return true;
    }
    return false;
  }

  KaiState.prototype.setState = function(name, data) {
    if (this.state[name] != undefined) {
      this.state[name] = this.immutability(data);
      this.listener[name].forEach((listener) => {
        listener(this.state[name]);
      });
      this.globalListener.forEach((listener) => {
        listener(name, this.state[name]);
      });
      return this.immutability(data);
    } else {
      return false;
    }
  }

  KaiState.prototype.getState = function(name) {
    if (name != undefined) {
      return this.immutability(this.state[name]);
    }
    return this.immutability(this.state);
  }

  return KaiState;

})();
