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
      host = process.argv[2],
      port = process.argv[3],
      token = process.argv[4],
      local_unix = process.argv[5],
      url = `ws://${host}:${port}?mode=origin&token=${token}`;

class OriginClient {
  constructor(socket) {
    this.session_id = null;
    this.web_socket = socket;
    this.dest_sockets = {};

    this.web_socket.on('open', function () {
      console.log("Socket opened");
    });

    this.web_socket.on('close', function () {
      throw new Error("Remote host closed connection, exiting.");
    });

    this.web_socket.on('error', function () {
      throw new Error("Remote host closed connection, exiting.");
    });

    this.web_socket.on('message', (data) => this.onMessage(data));
  }

  send(payload) {
    this.web_socket.send(msgpack.encode(payload));
  }

  onMessage(data) {
    try {
      const decoded = msgpack.decode(data);

      switch (decoded.type) {
        case "start":
          // TODO: make sure this goes to stdout!
          console.log(`export SESSION_ID="${decoded.id}"`);
          break;
        case "open":
          this.openUnixSocket(local_unix, decoded.id, decoded.token);
          break;
        case "close":
          this.closeSocket(decoded.id);
          break;
        case "data":
          this.onWebSocketData(decoded.data, decoded.id);
          break;
      }
    } catch (err) {
      console.error("Couldn't decode payload:", err, data);
    }
  }

  onUnixData(data, id) {
    if (this.dest_sockets[id]) {
      this.send({type: "data", id, data});
    } else {
      console.error(`Received data from dead socket ${id}`);
    }
  }

  onWebSocketData(data, id) {
    const maybe_sock = this.dest_sockets[id];
    if (maybe_sock) {
      const sock = maybe_sock;
      sock.write(data);
    } else {
      console.error(`Trying to forward to invalid socket: ${id}`);
    }
  }

  openUnixSocket(path, id, given_token) {
    // TODO: check max connection limit
    // TODO: check simulatneous connection limit.

    if (this.dest_sockets[id]) {
      console.error(`Dest socket ${id} already open`);
      this.send({type: "close", id});
    }

    if (given_token == token) {
      const sock = net.connect(path);
      this.dest_sockets[id] = sock;
      sock.on('data', (data) => this.onUnixData(data, id));
      sock.on('end', () => this.closeSocket(id));
      sock.on('error', () => this.closeSocket(id));
    } else {
      console.error(`A client tried to connect with invalid token: ${token}`);
      this.send({type: "close", id});
    }
  }

  closeSocket(id) {
    console.log(`Closing connection for dest id ${id}`);

    const maybe_sock = this.dest_sockets[id];
    if (maybe_sock) {
      const sock = maybe_sock;

      // Actually close the socket on our end.
      maybe_sock.close();

      // Tell server we won't accept any more data from this socket.
      this.send({type: "close", id});

      // Remove socket from list working set, so we no longer handle it.
      delete this.dest_sockets[id];
    } else {
      console.error("Already closed");
    }
  }
}

if (!module.parent) {
  const client = new OriginClient(new WebSocket(url));
}
