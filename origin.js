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
