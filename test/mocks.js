/**
 * Event emitter base class.
 *
 */
class EventEmitter {
  constructor() {
    this.callbacks = {};
  }

  on(event, callback) {
    let callbacks = this.getOrElse(event);
    callbacks.push(callback);
    return callbacks.length;
  }

  off(event, id) {
    let callbacks = this.getOrElse(event);
    callbacks && (callbacks[id] = null);
  }

  emit(event, ...args) {
    this.getOrElse(event).forEach((callback) => {
      callback(...args)
    });
  }

  emitLater(event, ...args) {
    return () => this.emit(event, ...args);
  }

  getOrElse(event) {
    let callbacks = this.callbacks[event];
    if (callbacks) {
      return callbacks
    } else {
      let ret = this.callbacks[event] = [];
      return ret;
    }
  }
}


/**
 * Mock a websocket for testing server-side functionality.
 */
class WebSocket extends EventEmitter {

  constructor() {
    super();
    this.readyState = "CONNECTING";
    this.buffer = new Buffer('');
    this.is_open = false;
  }

  send(data) {
    if (!this.is_open) {
      throw "Send after close.";
    }

    if (typeof(data) === 'string') {
      this.buffer = new Buffer(data);
    } else {
      this.buffer = data;
    }
  };

  close() {
    this.mockClose();
  }

  mockMessage(data) {
    this.emit("message", data);
  };

  mockOpen() {
    this.is_open = true;
    this.readyState = "OPEN";
    this.emit("open");
  };

  mockClose() {
    if (this.is_open) {
      this.is_open = false;
      this.readyState = "CLOSED";
      this.emit("close");
    } else {
      console.trace("Already closed");
    }
  };

  getBuffer() {
    return this.buffer;
  }

  clearBuffer() {
    this.buffer = new Buffer('');
  }
}


/**
 * Mock file-like object, including serialports.
 */
class File extends EventEmitter {
  constructor() {
    super();
    this.open = false;
    this.clearBuffer();
  }

  write(data) {
    if (this.open) {
      if (typeof(data) === "string") {
	this.buffer = Buffer.concat([this.buffer, new Buffer(data)]);
      } else if (data instanceof Buffer) {
	this.buffer = Buffer.concat([this.buffer, data]);
      } else {
	throw new Error(`Don't know what to do with ${data}`);
      }
    } else {
      throw new Error("Write after close.");
    }

    this.emit('write', data);
  }

  mockOpen() {
    this.open = true;
    this.emit('open');
  }

  mockClose() {
    if (this.open) {
      this.emit('close');
    }
  }

  mockData(data) {
    if (!data instanceof Buffer) {
      this.emit('data', new Buffer(data));
    } else {
      this.emit('data', data);
    }
  }

  mockError(err) {
    this.emit('error', err);
  }

  getBuffer() {
    return this.buffer;
  }

  clearBuffer() {
    return this.buffer = new Buffer('');
  }
}


/**
 * Server mock
 */
class Server extends EventEmitter {
  constructor (listener) {
    super();
    this.listener = listener;
    this.listen_cb = null;
  }

  listen(path, listen_cb) {
    this.listen_cb = listen_cb;
  }

  mockOpenSocket(unix_socket, req) {
    // For websocket server
    this.emit('connection', unix_socket, req);

    // For unix socket server
    this.listener && this.listener(unix_socket);
  }

  mockError(err) {
    this.emit('error', err);
  }
}


module.exports = {
  Server,
  WebSocket,
  File,
}
