'use strict';

var fs = (function() {
  function normalizePath(path) {
    if (path.length != 1 && path.lastIndexOf("/") == path.length-1) {
      path = path.substring(0, path.length-1);
    }
    return path;
  }

  function dirname(path) {
    var index = path.lastIndexOf("/");
    if (index == -1) {
      return ".";
    }

    while (index >= 0 && path[index] == "/") {
      --index;
    }

    var dir = path.slice(0, index + 1);
    if (dir == "") {
      dir = "/";
    }
    return dir;
  }

  function basename(path) {
    return path.slice(path.lastIndexOf("/") + 1);
  }

  function init(cb) {
    asyncStorage.getItem("/", function(data) {
      if (data) {
        cb();
      } else {
        asyncStorage.setItem("/", [], cb);
      }
    });
  }

  var openedFiles = [];

  function open(path, cb) {
    path = normalizePath(path);

    asyncStorage.getItem(path, function(blob) {
      if (blob == null || !(blob instanceof Blob)) {
        cb(-1);
      } else {
        var reader = new FileReader();
        reader.addEventListener("loadend", function() {
          var fd = openedFiles.push({
            path: path,
            buffer: new Uint8Array(reader.result),
          }) - 1;
          cb(fd);
        });
        reader.readAsArrayBuffer(blob);
      }
    });    
  }

  function close(fd) {
    if (fd >= 0) {
      openedFiles.splice(fd, 1);
    }
  }

  function read(fd, from, to) {
    if (!openedFiles[fd]) {
      return null;
    }

    var buffer = openedFiles[fd].buffer;

    if (!from) {
      from = 0;
    }

    if (!to) {
      to = buffer.byteLength;
    }

    if (from > buffer.byteLength || to > buffer.byteLength) {
      return null;
    }

    return buffer.subarray(from, to);
  }

  function write(fd, data, from) {
    if (!from) {
      from = 0;
    }

    var buffer = openedFiles[fd].buffer;

    if (from > buffer.byteLength) {
      from = buffer.byteLength;
    }

    var newLength = (from + data.byteLength > buffer.byteLength) ? (from + data.byteLength) : (buffer.byteLength);

    var newBuffer = new Uint8Array(newLength);

    for (var i = 0; i < from; i++) {
      newBuffer[i] = buffer[i];
    }

    for (var i = from; i < data.byteLength + from; i++) {
      newBuffer[i] = data[i - from];
    }

    for (var i = from + data.byteLength; i < newLength; i++) {
      newBuffer[i] = buffer[i];
    }

    openedFiles[fd].buffer = newBuffer;
  }

  function flush(fd, cb) {
    var blob = new Blob([openedFiles[fd].buffer]);
    asyncStorage.setItem(openedFiles[fd].path, blob, cb);
  }

  function list(path, cb) {
    path = normalizePath(path);

    asyncStorage.getItem(path, function(files) {
      if (files == null || files instanceof Blob) {
        cb(null);
      } else {
        cb(files);
      }
    });
  }

  function exists(path, cb) {
    path = normalizePath(path);

    asyncStorage.getItem(path, function(data) {
      if (data == null) {
        cb(false);
      } else {
        cb(true);
      }
    });
  }

  function truncate(path, cb) {
    path = normalizePath(path);

    asyncStorage.getItem(path, function(data) {
      if (data == null || !(data instanceof Blob)) {
        cb(false);
      } else {
        asyncStorage.setItem(path, new Blob(), function() {
          cb(true);
        });
      }
    });
  }

  function remove(path, cb) {
    path = normalizePath(path);

    list(path, function(files) {
      if (files != null && files.length > 0) {
        cb(false);
        return;
      }

      var name = basename(path);
      var dir = dirname(path);

      list(dir, function(files) {
        var index = -1;

        if (files == null || (index = files.indexOf(name)) < 0) {
          cb(false);
          return;
        }

        files.splice(index, 1);
        asyncStorage.setItem(dir, files, function() {
          asyncStorage.removeItem(path, function() {
            cb(true);
          });
        });
      });
    });
  }

  function createInternal(path, data, cb) {
    path = normalizePath(path);

    var name = basename(path);
    var dir = dirname(path);

    list(dir, function(files) {
      if (files == null || files.indexOf(name) >= 0) {
        cb(false);
        return;
      }

      files.push(name);
      asyncStorage.setItem(dir, files, function() {
        asyncStorage.setItem(path, data, function() {
          cb(true);
        });
      });
    });
  }

  function create(path, blob, cb) {
    createInternal(path, blob, cb);
  }

  function mkdir(path, cb) {
    createInternal(path, [], cb);
  }

  function size(path, cb) {
    path = normalizePath(path);

    asyncStorage.getItem(path, function(blob) {
      if (blob == null || !(blob instanceof Blob)) {
        cb(-1);
      } else {
        cb(blob.size);
      }
    });
  }

  return {
    init: init,
    open: open,
    close: close,
    read: read,
    write: write,
    flush: flush,
    list: list,
    exists: exists,
    truncate: truncate,
    remove: remove,
    create: create,
    mkdir: mkdir,
    size: size,
  };
})();