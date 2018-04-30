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
