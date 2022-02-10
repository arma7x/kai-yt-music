const DataStorage = (function() {

  const SDCARDS = navigator.b2g ? navigator.b2g.getDeviceStorages('sdcard') : navigator.getDeviceStorages('sdcard');
  const SDCARD = navigator.b2g ? navigator.b2g.getDeviceStorage('sdcard') : navigator.getDeviceStorage('sdcard');

  function getStorageNameByPath(path) {
    var split = path.split('/')
    if (split[0] !== '' && split[0].length > 0) {
      return ''; // emulator
    } else {
      return split[1]; // realdevice
    }
  }

  function getSDCard(name) {
    var card;
    for (var x in SDCARDS) {
      if (SDCARDS[x].storageName === name) {
        card = SDCARDS[x];
        break;
      }
    }
    return card;
  }

  function enumerate(cards, index, files, cb) {
    if (navigator.b2g) {
      var iterable = cards[index].enumerate();
      var iterFiles = iterable.values();
      function next(_files) {
        _files.next()
        .then((file) => {
          if (file.done) {
            if (cards.length === (index + 1)) {
              cb(files);
            } else {
              enumerate(cards, (index + 1), files, cb);
            }
          } else {
            files.push(file.value);
            next(_files);
          }
        })
        .catch(() => {
          next(_files);
        });
      }
      next(iterFiles);
    } else {
      const cursor = cards[index].enumerate('');
      cursor.onsuccess = function () {
        if (!this.done) {
          if(cursor.result.name !== null) {
            files.push(cursor.result);
            this.continue();
          }
        } else {
          if (cards.length === (index + 1)) {
            cb(files);
          } else {
            enumerate(SDCARDS, (index + 1), files, cb);
          }
        }
      }
      cursor.onerror = (err) => {
        console.warn(`No file found: ${err.toString()}`);
        if (cards.length === (index + 1)) {
          cb(files);
        } else {
          enumerate(SDCARDS, (index + 1), files, cb);
        }
      }
    }
  }

  function getAllFiles(cb = function(x){}) {
    var files = [];
    enumerate(SDCARDS, 0, files, cb);
  }

  function getFile(name, success, error, getEditable) {
    return new Promise((resolve, reject) => {
      var request;
      if (getEditable === true) {
        request = getSDCard(getStorageNameByPath(name)).getEditable(name);
      } else {
        request = getSDCard(getStorageNameByPath(name)).get(name);
      }
      request.onsuccess = function () {
        resolve(this.result);
        if (success !== undefined) {
          success(this.result);
        }
      }
      request.onerror = function () {
        reject(this.error);
        if (error !== undefined) {
          error(this.error);
        }
      }
    });
  }

  function removeNode(target, path, steps = []) {
    var dir = path.splice(0, 1);
    dir = dir[0];
    if (target[dir] == null) {
      return false;
    }
    if (path.length === 0 && Object.keys(target[dir]).length === 0) {
      delete target[dir];
      return steps;
    }
    steps.push(dir);
    return removeNode(target[dir], path, steps);
  }

  function removeChild(target, path, steps = []) {
    var dir = path.splice(0, 1);
    dir = dir[0];
    if (target[dir] == null) {
      return false;
    }
    if (typeof target[dir] !== 'object') {
      delete target[dir];
      return steps;
    }
    steps.push(dir);
    return removeChild(target[dir], path, steps);
  }

  function insertChild(path, tree, parent, root) {
    if (path.length === 1) {
      tree[parent] = root;
      return tree;
    } else {
      if (tree[parent] === undefined) {
        tree[parent] = {};
      }
      tree[parent] = insertChild(path.slice(1, path.length), tree[parent], path.slice(1, path.length)[0], root);
      return tree;
    }
  }

  function indexingDocuments(files, _this) {
    var docTree = {}
    files.forEach(function(element) {
      if (element[0] === '/') {
        element = element.replace('/', '');
        _this.trailingSlash = '/';
      }
      docTree = insertChild(element.split('/'), docTree, element.split('/')[0], element);
    })
    return docTree;
  }

  function groupByType(files, cb = ()=>{}) {
    var _taskLength = files.length;
    var _taskFinish = 0;
    var _groups = {};
    files.forEach(function(element) {
      getFile(element, function(file) {
        var type = 'unknown'
        if (file.type === '') {
          var mime = file.name.split('.');
          if (mime.length > 1 && mime[mime.length - 1] !== '') {
            type = mime[mime.length - 1]
          }
          if (_groups[type] == undefined) {
            _groups[type] = []
          }
        } else {
          var mime = file.type.split('/');
          type = mime[0]
          if (_groups[type] == undefined) {
            _groups[type] = []
          }
        }
        _groups[type].push(file.name);
        _taskFinish++;
        if (_taskFinish === _taskLength) {
          cb(_groups);
        }
      });
    })
    return _groups;
  }

  function DataStorage(onChange, onReady, indexing = true) {
    this.init(onChange, onReady, indexing);
  }

  DataStorage.prototype.init = function(onChange = () => {}, onReady = () => {}, indexing = true) {
    this.indexing = indexing;
    this.deviceStorage = SDCARD;
    this.deviceStorages = SDCARDS;
    this.trailingSlash = SDCARD.storageName != '' ? '/' : '';
    this.isReady = false;
    this.onChange = onChange;
    this.onReady = onReady;
    this.fileRegistry = [];
    this.fileAttributeRegistry = {};
    this.documentTree = {};
    this.groups = {};
    this.indexingStorage();
    this.onChangeListener = (event) => {
      // console.log(event.type, event.reason, event.path);
      if (!this.indexing)
        return;
      const fp = event.path;
      if (event.type === 'change' && event.reason === 'created') {
        this.onReady(false);
        getFile(fp)
        .then((file) => {
          if (file != null) {
            this.fileAttributeRegistry[file.name] = { type: file.type, size: file.size, lastModified: file.lastModified };
            this.fileRegistry.push(file.name);
            var filePath = file.name;
            if (filePath[0] === '/')
              filePath = filePath.replace('/', '');
            this.documentTree = insertChild(filePath.split('/'), this.documentTree, filePath.split('/')[0], filePath);
            if (file.type === '') {
              if (this.groups['unknown'] == null) {
                this.groups['unknown'] = [];
              }
              this.groups['unknown'].push(file.name);
            } else {
              const t = file.type.split('/')[0];
              if (this.groups[t] == null) {
                this.groups[t] = [];
              }
              this.groups[t].push(file.name);
            }
            this.onChange(this.fileRegistry, this.documentTree, this.groups);
            this.onReady(true);
          } else {
            this.onReady(true);
          }
        })
        .catch((err) => {
          this.onReady(true);
        });
      } else if (event.type === 'change' && event.reason === 'modified') {
        this.onReady(false);
        getFile(fp)
        .then((file) => {
          if (file != null) {
            this.fileAttributeRegistry[file.name] = { type: file.type, size: file.size, lastModified: file.lastModified };
            this.onChange(this.fileRegistry, this.documentTree, this.groups);
            this.onReady(true);
          } else {
            this.onReady(true);
          }
        })
        .catch((err) => {
          this.onReady(true);
        });
      } else if (event.type === 'change' && event.reason === 'deleted') {
        this.onReady(false);
        const attrb = this.fileAttributeRegistry[fp];
        delete this.fileAttributeRegistry[fp];
        this.fileRegistry.splice(this.fileRegistry.indexOf(fp), 1);
        var path = removeChild(this.documentTree, fp.split('/'));
        if (path !== false) {
          path = removeNode(this.documentTree, path);
          while (path !== false) {
            path = removeNode(this.documentTree, path);
          }
        }
        if (attrb.type === '') {
          this.groups['unknown'].splice(this.groups['unknown'].indexOf(fp), 1);
        } else {
          const t = attrb.type.split('/')[0];
          this.groups[t].splice(this.groups[t].indexOf(fp), 1);
        }
        this.onChange(this.fileRegistry, this.documentTree, this.groups);
        this.onReady(true);
      }
    }
    SDCARDS.forEach((c) => {
      c.addEventListener("change", this.onChangeListener);
    });
  }

  DataStorage.prototype.destroy = function() {
    SDCARDS.forEach((c) => {
      c.removeEventListener("change", this.onChangeListener);
    });
  }

  DataStorage.prototype.indexingStorage = function() {
    if (!this.indexing)
      return;
    var _this = this;
    var files = [];
    _this.isReady = false;
    if (typeof _this.onReady === "function" ) {
      _this.onReady(false);
    }
    getAllFiles((_files) => {
      _files.forEach((f) => {
        files.push(f.name);
        _this.fileAttributeRegistry[f.name] = { type: f.type, size: f.size, lastModified: f.lastModified };
      });
      _this.fileRegistry = files;
      _this.documentTree = indexingDocuments(files, _this);
      groupByType(files, function(grouped) {
        _this.groups = grouped;
          if (_this.onChange != undefined) {
          _this.onChange(_this.fileRegistry, _this.documentTree, _this.groups);
        }
        _this.isReady = true;
        if (typeof _this.onReady === "function" ) {
          _this.onReady(true);
        }
        if (typeof _this.onReady === "function" ) {
          _this.onReady(true);
        }
      });
    });
  }

  DataStorage.prototype.getFile = function(name, success, error, getEditable) {
    if (name[0] != this.trailingSlash)
      name = this.trailingSlash + name
    return getFile(name, success, error, getEditable);
  }

  DataStorage.prototype.addFile = function(path, name, blob) {
    var _this = this;
    var des = this.trailingSlash + [...path, name].join('/');

    function addFile(success, fail) {
      var request = getSDCard(getStorageNameByPath(des)).addNamed(blob, des);
      request.onsuccess = function (evt) {
        var find = getSDCard(getStorageNameByPath(evt.target.result)).get(evt.target.result);
        find.onsuccess = function (evt2) {
          success(evt2.target.result);
        }
        find.onerror = function (err) {
          fail(err);
        }
      }
      request.onerror = function (err) {
        fail(err);
      }
    }

    return new Promise((success, fail) => {
      var remove = getSDCard(getStorageNameByPath(des)).delete(des);
      remove.onsuccess = function () {
        addFile(success, fail);
      }
      remove.onerror = function () {
        addFile(success, fail);
      }
    });
  }

  DataStorage.prototype.copyFile = function(path, name, to, isCut) {
    var _this = this;
    return new Promise((success, fail) => {
      this.getFile([...path, name].join('/'), function(res) {
        var des = _this.trailingSlash + to + "/" + name;
        if (to.length == 0 || to === '') {
          des = _this.trailingSlash + name;
        }
        var request = getSDCard(getStorageNameByPath(des)).addNamed(res, des);
        request.onsuccess = function (result) {
          success(result);
          if (isCut === true) {
            _this.deleteFile(JSON.parse(JSON.stringify(path)), name);
          }
        }
        request.onerror = function (err) {
          fail(err);
        }
      }, function(err) {
        fail(err);
      });
    });
  }

  DataStorage.prototype.deleteFile = function(path, name, force = false) {
    var _this = this;
    return new Promise((success, fail) => {
      path.push(name)
      var dir = JSON.parse(JSON.stringify(_this.documentTree));
      var valid = force;
      for (var i in path) {
        if (typeof dir[path[i]] === 'string') {
          valid = true;
        } else if (typeof dir[path[i]] === 'object') {
          dir = JSON.parse(JSON.stringify(dir[path[i]]));
        }
      };
      if (!valid) {
        fail("NoModificationAllowedError");
        return
      }
      const des = _this.trailingSlash + path.join('/');
      var request = getSDCard(getStorageNameByPath(des)).delete(des);
      request.onsuccess = function(res) {
        success(res);
      }
      request.onerror = function(err) {
        fail(err);
      }
    });
  }

  DataStorage.prototype.newFolder = function(path, name) {
    var _this = this;
    return new Promise((success, fail) => {
      var file = new Blob(["index"], {type: "text/plain"});
      path.push(name)
      var dir = JSON.parse(JSON.stringify(_this.documentTree));
      var valid = false;
      for (var i in path) {
        if (dir[path[i]] == null) {
          valid = true;
        } else if (typeof dir[path[i]] === 'object') {
          dir = JSON.parse(JSON.stringify(dir[path[i]]));
        }
      };
      if (!valid) {
        fail("NoModificationAllowedError");
        return
      }
      path.push(".index")
      const des = _this.trailingSlash + path.join('/');
      var request = getSDCard(getStorageNameByPath(des));
      if (request == null) {
        fail("Unable to create folder on root path");
      } else {
        request.addNamed(file, des);
        request.onsuccess = function(res) {
          success(res);
        }
        request.onerror = function(err) {
          fail(err);
        }
      }
    });
  }

  DataStorage.prototype.copyFolder = function(path, name, to, doneCb, progressCb, isCut) {
    var _this = this;
    var files = [];
    var taskSuccess = 0;
    var taskFail = 0;
    var resume = false;
    var origin = JSON.parse(JSON.stringify(path));
    var tempPath = JSON.parse(JSON.stringify(path));
    tempPath.push(name);
    var dir = JSON.parse(JSON.stringify(_this.documentTree));
    for (var i in tempPath) {
      if (typeof dir[tempPath[i]] === 'object') {
        dir = JSON.parse(JSON.stringify(dir[tempPath[i]]));
        resume = true;
      }
    };
    if (!resume) {
      if (typeof doneCb === 'function') {
        doneCb(taskSuccess, taskFail, files.length);
      }
      return;
    }
    function getFiles(dir) {
      if (typeof dir === 'object') {
        for (var x in dir) {
          getFiles(dir[x]);
        }
      } else {
        files.push(dir);
      }
    }
    getFiles(dir);
    files.forEach((filePath) => {
      var pathName = filePath.replace(origin.join('/'), '');
      if (pathName[0] === '/') {
        pathName = pathName.replace('/', '');
      }
      this.getFile(this.trailingSlash + filePath, function(res) {
        var des = _this.trailingSlash + to + "/" + pathName;
        if (to.length == 0 || to === '') {
          des = _this.trailingSlash + pathName;
        }
        var request = getSDCard(getStorageNameByPath(des)).addNamed(res, des);
        request.onsuccess = function (result) {
          taskSuccess += 1;
          if (typeof progressCb === 'function') {
            progressCb(taskSuccess, taskFail, files.length);
          }
          if (taskSuccess + taskFail === files.length && typeof doneCb === 'function') {
            doneCb(taskSuccess, taskFail, files.length);
            if (isCut === true) {
              _this.deleteFolder(path, name);
            }
          }
        }
        request.onerror = function (err) {
          taskFail += 1;
          if (typeof progressCb === 'function') {
            progressCb(taskSuccess, taskFail, files.length);
          }
          if (taskSuccess + taskFail === files.length && typeof doneCb === 'function') {
            doneCb(taskSuccess, taskFail, files.length);
            if (isCut === true) {
              _this.deleteFolder(path, name);
            }
          }
        }
      }, function(err) {
        taskFail += 1;
        if (typeof progressCb === 'function') {
          progressCb(taskSuccess, taskFail, files.length);
        }
        if (taskSuccess + taskFail === files.length && typeof doneCb === 'function') {
          doneCb(taskSuccess, taskFail, files.length);
        }
      });
    });
  }

  DataStorage.prototype.deleteFolder = function(path, name, doneCb, progressCb) {
    var _this = this;
    var files = [];
    var taskSuccess = 0;
    var taskFail = 0;
    var resume = false;
    path.push(name);
    var dir = JSON.parse(JSON.stringify(_this.documentTree));
    for (var i in path) {
      if (typeof dir[path[i]] === 'object') {
        dir = JSON.parse(JSON.stringify(dir[path[i]]));
        resume = true;
      } else if (typeof dir[path[i]] === 'undefined') {
        resume = false;
      }
    };
    if (!resume) {
      if (typeof doneCb === 'function') {
        doneCb(taskSuccess, taskFail, files.length);
      }
      return;
    }
    function getFiles(dir) {
      if (typeof dir === 'object') {
        for (var x in dir) {
          getFiles(dir[x]);
        }
      } else {
        files.push(dir);
      }
    }
    getFiles(dir);
    files.forEach((filePath) => {
      const des = _this.trailingSlash + filePath;
      var request = getSDCard(getStorageNameByPath(des)).delete(des);
      request.onsuccess = function(res) {
        taskSuccess += 1;
        if (typeof progressCb === 'function') {
          progressCb(taskSuccess, taskFail, files.length);
        }
        if (taskSuccess + taskFail === files.length && typeof doneCb === 'function') {
          doneCb(taskSuccess, taskFail, files.length);
        }
      }
      request.onerror = function(err) {
        taskFail += 1;
        if (typeof progressCb === 'function') {
          progressCb(taskSuccess, taskFail, files.length);
        }
        if (taskSuccess + taskFail === files.length && typeof doneCb === 'function') {
          doneCb(taskSuccess, taskFail, files.length);
        }
      }
    });
  }

  DataStorage.prototype.__getFile__ = getFile;

  return DataStorage;
})();
