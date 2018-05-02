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
      net = require('net'),
      host = process.argv[2],
      port = process.argv[3],
      id = process.argv[4],
      token = process.argv[5],
      local_unix = process.argv[6],
      url = `ws://${host}:${port}?mode=dest&id=${id}&token=${token}`;

class DestClient {
  constructor(path) {
    this.queue = [];
    this.server = net.createServer(this.onUnixConnection.bind(this));
    this.server.on('error', console.error.bind(console));
    this.server.listen(path, () => {
      console.log(`server bound to: ${this.server.address()}`);
    });
   }

  onUnixConnection(unix_socket) {
    console.log("New unix socket opened");

    this.unix_socket = unix_socket;
    this.web_socket = new WebSocket(url);
    this.start = false;

    this.web_socket.on('open', () => {
      this.ws_start = true;

      while (this.queue.length) {
        this.web_socket.send(this.queue.shift());
      }
    });

    this.web_socket.on('close', () => {
      throw new Error("Remote host closed connection, exiting");
    });

    this.web_socket.on('message', this.onMessage.bind(this));
    this.unix_socket.on('data', this.onData.bind(this));
  }

  onMessage(data) {
    console.log("Websocket message");
    // TODO: forward to local unix socket.
    this.unix_socket.write(data);
  }

  onData(data) {
    console.log("Unix data");

    if (this.ws_start) {
      this.web_socket.send(data);
    } else {
      this.queue.push(data);
    }
  }
}


const client = new DestClient(local_unix);
