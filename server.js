#! /usr/bin/node

const  http = require('http'),
       url = require('url'),
       uuid4 = require('uuid/v4'),
       ws = require('ws'),
       port = process.env.HTTP_PORT || 80,
       ws_server = new ws.Server({port});

class ProxyConnection {
  constructor (origin, token) {
    this.origin = origin;
    this.token = token;
  }

  startForwarding(dest) {
    this.dest = dest;

    this.origin.on('message', (data) => dest.send(data));
    this.origin.on('close', () => this.shutdown);
    this.origin.on('error', () => this.shutdown);

    this.dest.on('message', (data) => this.origin.send(data));
    this.dest.on('close', () => this.shutdown);
    this.dest.on('error', () => this.shutdown);

    this.origin.send('start');
  }

  shutdown() {
    console.log("Shutdown called");
    this.dest.close();
    this.origin.close();
  }

  running() {
    return !!this.dest;
  }
}

class ProxyServer {
  constructor (ws_server) {
    this.connections = {};
    ws_server.on('connection', this.newConnection.bind(this));
  }

  newConnection(socket, req) {
    const location = url.parse(req.url, true);

    console.log(location.query);

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
          conn = new ProxyConnection(socket, params.token);

    console.log("Creating new connection:", uid);

    this.connections[uid] = conn;

    socket.send(uid);
  }

  newDestConnection(socket, params) {
    const uid = params.id,
          token = params.token,
          maybe_conn = this.connections[uid];
    if (maybe_conn) {
      const conn = maybe_conn;
      /* if (conn.running()) {
       *   console.log("Connection already completed: ", uid);
       *   socket.close();
       * }
       */
      if (conn.token != token) {
        console.log("Invalid token for socket: ", uid);
        socket.close();
      }

      console.log("Forwarding for connection:", uid);
      conn.startForwarding(socket);
    } else {
      console.log("Invalid socket id: ", uid);
      socket.close();
    }
  }
}

const server = new ProxyServer(ws_server);
