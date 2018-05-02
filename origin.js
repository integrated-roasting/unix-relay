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
      token = process.argv[4],
      local_unix = process.argv[5],
      url = `ws://${host}:${port}?mode=origin&token=${token}`;

class OriginClient {
  constructor(socket) {
    this.start = false;
    this.socketId = null;
    this.web_socket = socket;

    this.web_socket.on('open', function () {
      console.log("Socket opened");
    });

    this.web_socket.on('close', function () {
      throw new Error("Remote host closed connection, exiting");
    });

    this.web_socket.on('message', this.onMessage.bind(this));
  }

  onMessage(data) {
    if (!this.start) {
      if (!this.socketId) {
        console.log(`SOCKET_ID="${data}"`);
        this.socketId = data;
      } else {
        if (data == "start") {
          console.log("Recevied start token");
          this.openUnixSocket(local_unix);
        }
      }
    } else {
      console.log("Recvd: data");
      this.unix_socket.write(data);
    }
  }

  onData(data) {
    this.web_socket.send(data);
  }

  openUnixSocket(path) {
    this.unix_socket = net.connect(path, () => {this.start = true});
    this.unix_socket.on('data', this.onData.bind(this));
  }
}

const client = new OriginClient(new WebSocket(url));
