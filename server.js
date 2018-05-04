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
  constructor (origin, token) {
    this.origin = origin;
    this.token = token;
  }

  startForwarding(dest) {
    this.dest = dest;
    this.origin.on('message', (data) => dest.send(data));
    this.dest.on('message', (data) => this.origin.send(data));
  }

  shutdown() {
    if (this.dest && this.dest.readyState === "OPEN") {
      this.dest.close();
    }

    if (this.origin.readyState === "OPEN") {
      this.origin.close();
    }
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

  newConnection(socket, req) {
    const location = url.parse(req.url, true);

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
          session = new RelaySession(socket, params.token);

    console.log("Creating new connection:", uid);

    this.sessions[uid] = session;

    // Notify origin client of session id.
    socket.send(msgpack.encode({type: "start", id: uid}));

    // Handle socket closing.
    socket.on('close', () => this.originClosed(uid));
    socket.on('error', () => this.originClosed(uid));
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
      socket.on('close', () => session.shutdown());
      socket.on('error', () => session.shutdown());
    } else {
      console.error("Invalid socket id: ", uid);
      socket.close();
    }
  }

  originClosed(id) {
    console.log(`Shutting down session: ${id}`);
    if (this.sessions[id]) {
      this.sessions[id].shutdown();
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
