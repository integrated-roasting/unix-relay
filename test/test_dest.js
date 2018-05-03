const assert = require('assert'),
      msgpack = require('msgpack-lite'),
      dest = require('../dest.js'),
      mocks = require('./mocks.js');


describe('dest client', function () {
  it("should create unix socket server when the websocket opens", function () {
    const socket = new mocks.WebSocket(),
          client = new dest.DestClient(
            "fake path",
            socket,
            () => createServer());

    var server;
    function createServer(listener) {
      server = new mocks.Server(listener);
      return server;
    }
    assert.equal(!!server, false);

    socket.mockOpen();
    assert.equal(!!server, true);
  });

  it("should create new channel for each unix connection", function () {
    const socket = new mocks.WebSocket(),
          file1 = new mocks.File(),
          file2 = new mocks.File(),
          client = new dest.DestClient(
            "fake path",
            socket,
            createServer,
            "abcd");

    file1.mockOpen();
    file2.mockOpen();

    var server;
    var path;
    function createServer(listener) {
      server = new mocks.Server(listener);
      return server;
    }
    assert.equal(!!server, false);

    socket.mockOpen();
    assert.equal(!!server, true);
    assert.equal(server.path, "fake path");

    server.mockOpenSocket(file1);
    let message = msgpack.decode(socket.buffer);
    assert.equal(message.type, "open");
    assert.equal(message.id.length, 36);
    assert.equal(message.token, "abcd");
    socket.clearBuffer();

    server.mockOpenSocket(file2);
    message = msgpack.decode(socket.buffer);
    assert.equal(message.type, "open");
    assert.equal(message.id.length, 36);
    assert.equal(message.token, "abcd");
    socket.clearBuffer();

    // forwarding should be separated by channel.
    file1.mockData("abcdef");
    const message1 = msgpack.decode(socket.buffer);
    socket.clearBuffer();
    file2.mockData("abcdef");
    const message2 = msgpack.decode(socket.buffer);
    socket.clearBuffer();
    assert.equal(message1.type, message2.type);
    assert.equal(message1.data, message2.data);
    assert.notEqual(message1.id, message2.id);

    // In both directoins
    file1.clearBuffer();
    file2.clearBuffer();
    socket.clearBuffer();
    socket.mockMessage(msgpack.encode({
      type: "data",
      data: "hijkl",
      id: message1.id
    }));

    assert.equal(file1.buffer.toString(), "hijkl");
    socket.clearBuffer();
    socket.mockMessage(msgpack.encode({
      type: "data",
      data: "lmnop",
      id: message2.id
    }));
    assert.equal(file2.buffer.toString(), "lmnop");
  });

  it("should disconnect when the origin tells it to", function () {
    const socket = new mocks.WebSocket(),
          file1 = new mocks.File(),
          file2 = new mocks.File(),
          client = new dest.DestClient(
            "fake path",
            socket,
            createServer,
            "abcd");

    file1.mockOpen();
    file2.mockOpen();

    var server;
    var path;
    function createServer(listener) {
      server = new mocks.Server(listener);
      return server;
    }
    assert.equal(!!server, false);

    socket.mockOpen();
    assert.equal(!!server, true);
    assert.equal(server.path, "fake path");

    server.mockOpenSocket(file1);
    let message = msgpack.decode(socket.buffer);
    assert.equal(message.type, "open");
    assert.equal(message.id.length, 36);
    assert.equal(message.token, "abcd");
    socket.clearBuffer();

    server.mockOpenSocket(file2);
    message = msgpack.decode(socket.buffer);
    assert.equal(message.type, "open");
    assert.equal(message.id.length, 36);
    assert.equal(message.token, "abcd");
    socket.clearBuffer();

    file1.mockData("abcdef");
    const message1 = msgpack.decode(socket.buffer);
    socket.clearBuffer();
    file2.mockData("abcdef");
    const message2 = msgpack.decode(socket.buffer);
    socket.clearBuffer();

    // The right socket should close
    socket.mockMessage(msgpack.encode({
      type: "close",
      id: message1.id
    }));
    assert.equal(socket.buffer.toString(), "");
    assert.equal(file1.open, false);
    assert.equal(file2.open, true);

    // Data should not continue to be routed to the socket.
    file1.clearBuffer();
    socket.clearBuffer();
    socket.mockMessage(msgpack.encode({
      type: "data",
      id: message1.id,
      data: "hijkl"
    }));
    assert.equal(file1.buffer.toString(), "");
  });

  it("should close channels when the underlying sockets die", function () {
    const socket = new mocks.WebSocket(),
          file1 = new mocks.File(),
          file2 = new mocks.File(),
          client = new dest.DestClient(
            "fake path",
            socket,
            createServer,
            "abcd");

    file1.mockOpen();
    file2.mockOpen();

    var server;
    var path;
    function createServer(listener) {
      server = new mocks.Server(listener);
      return server;
    }
    assert.equal(!!server, false);

    socket.mockOpen();
    assert.equal(!!server, true);
    assert.equal(server.path, "fake path");

    server.mockOpenSocket(file1);
    let message = msgpack.decode(socket.buffer);
    assert.equal(message.type, "open");
    assert.equal(message.id.length, 36);
    assert.equal(message.token, "abcd");
    socket.clearBuffer();

    server.mockOpenSocket(file2);
    message = msgpack.decode(socket.buffer);
    assert.equal(message.type, "open");
    assert.equal(message.id.length, 36);
    assert.equal(message.token, "abcd");
    socket.clearBuffer();

    file1.mockData("abcdef");
    const message1 = msgpack.decode(socket.buffer);
    socket.clearBuffer();
    file2.mockData("abcdef");
    const message2 = msgpack.decode(socket.buffer);
    socket.clearBuffer();

    // The right socket should close
    socket.clearBuffer();
    file1.mockClose();
    assert.deepStrictEqual(msgpack.decode(socket.buffer), {
      type: "close",
      id: message1.id
    });
    assert.equal(file1.open, false);
    assert.equal(file2.open, true);

    // Data should not continue to be routed to the socket.
    file1.clearBuffer();
    socket.mockMessage(msgpack.encode({
      type: "data",
      id: message1.id,
      data: "hijkl"
    }));
  });
});
