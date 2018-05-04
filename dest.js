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

const WebSocket = require('ws'),
      msgpack = require('msgpack-lite'),
      net = require('net'),
      uuid4 = require('uuid/v4'),
      host = process.argv[2],
      port = process.argv[3],
      id = process.argv[4],
      token = process.argv[5],
      local_unix = process.argv[6],
      url = `ws://${host}:${port}?mode=dest&id=${id}&token=${token}`;

class DestClient {
  constructor(path, web_socket, createServer, token) {
    this.sockets = {};
    this.path = path;
    this.createServer = createServer;
    this.token = token;

    this.web_socket = web_socket;
    this.web_socket.on('open', () => this.createUnixSocket(this.path));
    this.web_socket.on('close', () => {
      throw new Error("Remote host closed connection");
    });
    this.web_socket.on('message', (data) => this.onMessage(data));
  }

  createUnixSocket(path) {
    console.log("Websocket connected, opening unix socket");

    this.server = this.createServer((sock) => this.onUnixConnection(sock));
    this.server.on('error', console.error.bind(console));
    this.server.listen(path, () => {
      console.log(`server bound to: ${this.server.address()}`);
    });
  }

  send(payload) {
    this.web_socket.send(msgpack.encode(payload));
  }

  onUnixConnection(unix_socket) {
    const uid = uuid4();
    console.log("New unix socket opened:", uid);

    this.sockets[uid] = unix_socket;
    this.send({type: "open", id: uid, token: this.token});

    unix_socket.on('data', (data) => this.onUnixData(data, uid));
    unix_socket.on('end',   () => this.closeSocket(uid, true));
    unix_socket.on('error', () => this.closeSocket(uid, true));
    unix_socket.on('close', () => this.closeSocket(uid, true));
  }

  onMessage(data) {
    console.log("Websocket message");

    const decoded = msgpack.decode(data);

    switch (decoded.type) {
      case "close":
        this.closeSocket(decoded.id, false);
        break;
      case "data":
        this.onWebSocketData(decoded.data, decoded.id);
        break;
    }
  }

  onWebSocketData(data, uid) {
    const maybe_socket = this.sockets[uid];

    if (maybe_socket) {
      const socket = maybe_socket;
      socket.write(data);
    } else {
      console.error(`Trying to write to invalid socket: ${uid}`);
    }
  }

  onUnixData(data, id) {
    if (this.sockets[id]) {
      this.send({type: "data", data, id});
    } else {
      console.error(`Trying to forward invalid socket id ${id}`);
    }
  }

  closeSocket(id, ack) {
    const maybe_socket = this.sockets[id];

    if (maybe_socket) {
      if (ack) {
        this.send({type: "close", id});
      }
      delete this.sockets[id];
      maybe_socket.close();
    }
  }
}

// Entry point for script.
if (!module.parent) {
  const client = new DestClient(
    local_unix,
    new WebSocket(url),
    new net.createServer,
    token);
} else {
  module.exports = {DestClient};
}
