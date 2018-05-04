const assert = require('assert'),
      msgpack = require('msgpack-lite'),
      net = require('net'),
      sinon  = require('sinon'),
      ws = require('ws'),
      dest = require('../dest.js'),
      mocks = require('./mocks.js'),
      origin = require('../origin.js'),
      server = require('../server.js');

describe('everything', function () {

  beforeEach(function () {
    this.clock = sinon.useFakeTimers();
  });

  afterEach(function() {
    this.clock.restore();
  });

  it("should all work together", function () {
    const ws_server = new mocks.Server(),
          origin_client_ws = new mocks.WebSocket(),
          dest_client_ws = new mocks.WebSocket(),
          origin_server_ws = new mocks.WebSocket(),
          dest_server_ws = new mocks.WebSocket(),
          relay_server = new server.RelayServer(ws_server),
          origin_unix = new mocks.File(),
          dest_unix = new mocks.File(),
          origin_client = new origin.OriginClient(
            origin_client_ws,
            () => origin_unix,
            "abcd"),
          dest_client = new dest.DestClient(
            "fake path",
            dest_client_ws,
            createServer,
            "abcd");

    var unix_server;
    function createServer(listener) {
      unix_server = new mocks.Server(listener);
      return unix_server;
    }

    // Sockets should be open before handing off to server.
    origin_client_ws.mockOpen();
    dest_client_ws.mockOpen();
    origin_server_ws.mockOpen();
    dest_server_ws.mockOpen();

    // Connect up the pipes.
    origin_client_ws.pair(origin_server_ws);
    dest_client_ws.pair(dest_server_ws);

    // Simulate origin connection
    ws_server.mockOpenSocket(origin_server_ws, {
      url: "?mode=origin&token=abcd"
    });

    // Extract the session id.
    const start_message = msgpack.decode(origin_server_ws.buffer);
    assert.equal(start_message.type, "start");
    const session_id = start_message.id;

    // Simulate destination connection
    origin_server_ws.clearBuffer();
    ws_server.mockOpenSocket(dest_server_ws, {
      url: `?mode=dest&token=abcd&id=${session_id}`
    });

    // Simulate a socket connection opening on the destination.
    origin_unix.mockOpen();
    dest_unix.mockOpen();
    unix_server.mockOpenSocket(dest_unix);
    const open_message = msgpack.decode(origin_server_ws.buffer);

    // Extract the socket id
    assert.equal(open_message.type, "open");
    const socket_id = open_message.id;
    origin_server_ws.clearBuffer();

    // Mock writing from one file should send data verbatim to the other.
    origin_unix.mockData("foobarbaz");
    assert.equal(dest_unix.buffer.toString(), "foobarbaz")
    dest_unix.mockData("frobblobblorg");
    assert.equal(origin_unix.buffer.toString(), "frobblobblorg");

    // Closing dest socket should close the origin socket
    dest_unix.close();
    assert.equal(dest_unix.open, false);
    assert.equal(origin_unix.open, false);
  });

  it("should handle origin sockets closing", function () {
    const ws_server = new mocks.Server(),
          origin_client_ws = new mocks.WebSocket(),
          dest_client_ws = new mocks.WebSocket(),
          origin_server_ws = new mocks.WebSocket(),
          dest_server_ws = new mocks.WebSocket(),
          relay_server = new server.RelayServer(ws_server),
          origin_unix = new mocks.File(),
          dest_unix = new mocks.File(),
          origin_client = new origin.OriginClient(
            origin_client_ws,
            () => origin_unix,
            "abcd"),
          dest_client = new dest.DestClient(
            "fake path",
            dest_client_ws,
            createServer,
            "abcd");

    var unix_server;
    function createServer(listener) {
      unix_server = new mocks.Server(listener);
      return unix_server;
    }

    // Sockets should be open before handing off to server.
    origin_client_ws.mockOpen();
    dest_client_ws.mockOpen();
    origin_server_ws.mockOpen();
    dest_server_ws.mockOpen();

    // Connect up the pipes.
    origin_client_ws.pair(origin_server_ws);
    dest_client_ws.pair(dest_server_ws);

    // Simulate origin connection
    ws_server.mockOpenSocket(origin_server_ws, {
      url: "?mode=origin&token=abcd"
    });

    // Extract the session id.
    const start_message = msgpack.decode(origin_server_ws.buffer);
    assert.equal(start_message.type, "start");
    const session_id = start_message.id;

    // Simulate destination connection
    origin_server_ws.clearBuffer();
    ws_server.mockOpenSocket(dest_server_ws, {
      url: `?mode=dest&token=abcd&id=${session_id}`
    });

    // Simulate a socket connection opening on the destination.
    origin_unix.mockOpen();
    dest_unix.mockOpen();
    unix_server.mockOpenSocket(dest_unix);
    const open_message = msgpack.decode(origin_server_ws.buffer);

    // Closing origin socket should close the dest socket
    origin_unix.close();
    assert.equal(dest_unix.open, false);
    assert.equal(origin_unix.open, false);
  });

  it("should handle origin websocket closing", function () {
    const ws_server = new mocks.Server(),
          origin_client_ws = new mocks.WebSocket(),
          dest_client_ws = new mocks.WebSocket(),
          origin_server_ws = new mocks.WebSocket(),
          dest_server_ws = new mocks.WebSocket(),
          relay_server = new server.RelayServer(ws_server),
          origin_unix = new mocks.File(),
          dest_unix = new mocks.File(),
          origin_client = new origin.OriginClient(
            origin_client_ws,
            () => origin_unix,
            "abcd"),
          dest_client = new dest.DestClient(
            "fake path",
            dest_client_ws,
            createServer,
            "abcd");

    var unix_server;
    function createServer(listener) {
      unix_server = new mocks.Server(listener);
      return unix_server;
    }

    // Sockets should be open before handing off to server.
    origin_client_ws.mockOpen();
    dest_client_ws.mockOpen();
    origin_server_ws.mockOpen();
    dest_server_ws.mockOpen();

    // Connect up the pipes.
    origin_client_ws.pair(origin_server_ws);
    dest_client_ws.pair(dest_server_ws);

    // Simulate origin connection
    ws_server.mockOpenSocket(origin_server_ws, {
      url: "?mode=origin&token=abcd"
    });

    // Extract the session id.
    const start_message = msgpack.decode(origin_server_ws.buffer);
    assert.equal(start_message.type, "start");
    const session_id = start_message.id;

    // Simulate destination connection
    origin_server_ws.clearBuffer();
    ws_server.mockOpenSocket(dest_server_ws, {
      url: `?mode=dest&token=abcd&id=${session_id}`
    });

    // Simulate a socket connection opening on the destination.
    origin_unix.mockOpen();
    dest_unix.mockOpen();
    unix_server.mockOpenSocket(dest_unix);
    const open_message = msgpack.decode(origin_server_ws.buffer);

    // Closing origin websocket should close the dest socket
    origin_server_ws.close();
    assert.equal(dest_server_ws.is_open, false);
  });

  it("should handle dest websocket closing", function () {
    const ws_server = new mocks.Server(),
          origin_client_ws = new mocks.WebSocket(),
          dest_client_ws = new mocks.WebSocket(),
          origin_server_ws = new mocks.WebSocket(),
          dest_server_ws = new mocks.WebSocket(),
          relay_server = new server.RelayServer(ws_server),
          origin_unix = new mocks.File(),
          dest_unix = new mocks.File(),
          origin_client = new origin.OriginClient(
            origin_client_ws,
            () => origin_unix,
            "abcd"),
          dest_client = new dest.DestClient(
            "fake path",
            dest_client_ws,
            createServer,
            "abcd");

    var unix_server;
    function createServer(listener) {
      unix_server = new mocks.Server(listener);
      return unix_server;
    }

    // Sockets should be open before handing off to server.
    origin_client_ws.mockOpen();
    dest_client_ws.mockOpen();
    origin_server_ws.mockOpen();
    dest_server_ws.mockOpen();

    // Connect up the pipes.
    origin_client_ws.pair(origin_server_ws);
    dest_client_ws.pair(dest_server_ws);

    // Simulate origin connection
    ws_server.mockOpenSocket(origin_server_ws, {
      url: "?mode=origin&token=abcd"
    });

    // Extract the session id.
    const start_message = msgpack.decode(origin_server_ws.buffer);
    assert.equal(start_message.type, "start");
    const session_id = start_message.id;

    // Simulate destination connection
    origin_server_ws.clearBuffer();
    ws_server.mockOpenSocket(dest_server_ws, {
      url: `?mode=dest&token=abcd&id=${session_id}`
    });

    // Simulate a socket connection opening on the destination.
    origin_unix.mockOpen();
    dest_unix.mockOpen();
    unix_server.mockOpenSocket(dest_unix);
    const open_message = msgpack.decode(origin_server_ws.buffer);

    // Closing origin websocket should close the dest socket
    dest_server_ws.close();
    assert.equal(origin_server_ws.is_open, false);
  });
});
