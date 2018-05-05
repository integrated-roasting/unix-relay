#! /usr/bin/node

/* MIT License
 *
 * Copyright (c) 2018 Carbine Coffee
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const  http = require('http'),
       msgpack = require('msgpack-lite'),
       url = require('url'),
       uuid4 = require('uuid/v4'),
       WebSocket = require('ws'),
       port = process.env.HTTP_PORT || 80;


class RelaySession {
  constructor (origin, token, onShutdown) {
    this.origin = origin;
    this.token = token;
    this.onShutdown = onShutdown;
    // Handle socket closing.
    this.origin.on('close', () => this.shutdown());
  }

  startForwarding(dest) {
    const handler = (err) => {
      if (err) {
        console.log(err);
        this.shutdown();
      }
    };

    const writer = (sock) => {
      return (data) => {
        try {
          sock.send(data, handler);
        } catch (err) {
          handler(err);
        }
      }
    }

    this.dest = dest;
    this.dest.on('close', () => this.shutdown());
    this.dest.on('error', () => this.shutdown());

    this.origin.on('message', writer(this.dest));
    this.dest.on('message', writer(this.origin));
  }

  shutdown() {
    if (this.dest && this.dest.readyState === "OPEN") {
      this.dest.close();
    }

    if (this.origin.readyState === "OPEN") {
      this.origin.close();
    }

    this.onShutdown && this.onShutdown();
  }

  running() {
    return !!this.dest;
  }
}

class RelayServer {
  constructor (ws_server) {
    this.sessions = {};
    ws_server.on('connection', this.newConnection.bind(this));
  }

  heartBeat(socket) {
    var last_seen = Date.now();

    socket.on("pong", () => {
      last_seen = Date.now();
    });

    function check() {
      if ((Date.now() - last_seen) > 5000) {
        console.log("Ping timeout");
        socket.terminate();
      } else {
        try {
          socket.ping();
          setTimeout(check, 1000);
        } catch (err) {
          socket.terminate();
        }
      }
    }

    check();
  }

  newConnection(socket, req) {
    const location = url.parse(req.url, true);

    this.heartBeat(socket);

    switch(location.query.mode) {
      case "origin":
        this.newOriginConnection(socket, location.query);
        break;
      case "dest":
        this.newDestConnection(socket, location.query);
        break;
    }
  }

  newOriginConnection(socket, params) {
    const uid = uuid4(),
          session = new RelaySession(
            socket,
            params.token,
            () => this.shutdown(uid));

    console.log("Creating new connection:", uid);

    this.sessions[uid] = session;

    try {
      // Notify origin client of session id.
      socket.send(msgpack.encode({type: "start", id: uid}));
    } catch (err) {
      console.error("New socket was DoA");
      delete this.sessions[uid];
    }
  }

  newDestConnection(socket, params) {
    const uid = params.id,
          token = params.token,
          maybe_session = this.sessions[uid];
    if (maybe_session) {
      const session = maybe_session;
      if (session.token != token) {
        console.error("Invalid token for socket: ", uid);
        socket.close();
      }
      console.error("Forwarding for connection:", uid);
      session.startForwarding(socket);
    } else {
      console.error("Invalid socket id: ", uid);
      socket.close();
    }
  }

  shutdown(id) {
    console.log(`Shutting down session: ${id}`);
    if (this.sessions[id]) {
      delete this.sessions[id];
    } else {
      console.error(`Trying to close invalid session id: ${id}`);
    }
  }
}

if (!module.parent) {
  const ws_server = new WebSocket.Server({port}),
        server = new RelayServer(ws_server);
} else {
  module.exports = {RelayServer};
}
