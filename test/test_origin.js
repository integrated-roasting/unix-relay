const assert = require('assert'),
      msgpack = require('msgpack-lite'),
      mocks = require('./mocks.js'),
      origin = require('../origin.js');

describe('origin client', function () {
  it("create a unix socket for each `open` message received", function () {
    const socket = new mocks.WebSocket(),
          client = new origin.OriginClient(socket, connect, "abcd");

    var sockets = [];
    function connect() {
      // Unix sockets are sufficiently similar to Files to use this mock.
      const unix = new mocks.File();
      unix.mockOpen();
      sockets.push(unix);
      return unix;
    }

    socket.mockOpen();
    socket.mockMessage(msgpack.encode({
      type: "start",
      id: "foo-bar-baz"
    }));
    socket.clearBuffer();

    socket.mockMessage(msgpack.encode({
      type: "open",
      id: "baz-quux-frob",
      token: "abcd"
    }));
    socket.clearBuffer();

    assert.equal(sockets[0].open, true);

    socket.mockMessage(msgpack.encode({
      type: "open",
      id: "blorg-blarg-blag",
      token: "abcd"
    }));
    socket.clearBuffer();

    assert.equal(sockets[1].open, true);
  });

  it("should ensure dest connections have unique id", function () {
    const socket = new mocks.WebSocket(),
          client = new origin.OriginClient(socket, connect, "abcd");

    var sockets = [];
    function connect() {
      // Unix sockets are sufficiently similar to Files to use this mock.
      const unix = new mocks.File();
      unix.mockOpen();
      sockets.push(unix);
      return unix;
    }

    socket.mockOpen();
    socket.mockMessage(msgpack.encode({
      type: "start",
      id: "foo-bar-baz"
    }));
    socket.clearBuffer();

    socket.mockMessage(msgpack.encode({
      type: "open",
      id: "foo-bar-baz",
      token: "abcd"
    }));
    socket.clearBuffer();

    assert.equal(sockets[0].open, true);

    socket.mockMessage(msgpack.encode({
      type: "open",
      id: "foo-bar-baz",
      token: "abcd"
    }));

    assert.equal(!!sockets[1], false);
  });

  it("should ensure dest connections use correct token", function () {
    const socket = new mocks.WebSocket(),
          client = new origin.OriginClient(socket, connect, "abcd");

    var sockets = [];
    function connect() {
      // Unix sockets are sufficiently similar to Files to use this mock.
      const unix = new mocks.File();
      unix.mockOpen();
      sockets.push(unix);
      return unix;
    }

    socket.mockOpen();
    socket.mockMessage(msgpack.encode({
      type: "start",
      id: "foo-bar-baz"
    }));
    socket.clearBuffer();

    socket.mockMessage(msgpack.encode({
      type: "open",
      id: "foo-bar-baz",
      token: "abcd"
    }));
    socket.clearBuffer();
    assert.equal(sockets[0].open, true);

    socket.mockMessage(msgpack.encode({
      type: "open",
      id: "foo-bar-baz",
      token: "efgh"
    }));
    assert.deepStrictEqual(msgpack.decode(socket.buffer), {
      type: "close",
      id: "foo-bar-baz"
    });

    assert.equal(!!sockets[1], false);
  });

  it("should forward data in both directions", function () {
    const socket = new mocks.WebSocket(),
          client = new origin.OriginClient(socket, connect, "abcd");

    var sockets = [];
    function connect() {
      // Unix sockets are sufficiently similar to Files to use this mock.
      const unix = new mocks.File();
      unix.mockOpen();
      sockets.push(unix);
      return unix;
    }

    socket.mockOpen();
    socket.mockMessage(msgpack.encode({
      type: "start",
      id: "foo-bar-baz"
    }));
    socket.clearBuffer();

    socket.mockMessage(msgpack.encode({
      type: "open",
      id: "foo-bar-baz",
      token: "abcd"
    }));
    socket.clearBuffer();
    assert.equal(sockets[0].open, true);

    socket.mockMessage(msgpack.encode({
      type: "data",
      data: "abcdefg",
      id: "foo-bar-baz"
    }));
    assert.equal(sockets[0].getBuffer().toString(), "abcdefg");
    sockets[0].clearBuffer();
    socket.clearBuffer();

    sockets[0].mockData("hijklmnop");
    assert.deepStrictEqual(msgpack.decode(socket.getBuffer()), {
      type: "data",
      id: "foo-bar-baz",
      data: "hijklmnop"
    });
  });

  it("should handle a unix socket going away", function () {
    const socket = new mocks.WebSocket(),
          client = new origin.OriginClient(socket, connect, "abcd");

    var sockets = [];
    function connect() {
      // Unix sockets are sufficiently similar to Files to use this mock.
      const unix = new mocks.File();
      unix.mockOpen();
      sockets.push(unix);
      return unix;
    }

    socket.mockOpen();
    socket.mockMessage(msgpack.encode({
      type: "start",
      id: "foo-bar-baz"
    }));
    socket.clearBuffer();

    socket.mockMessage(msgpack.encode({
      type: "open",
      id: "foo-bar-baz",
      token: "abcd"
    }));
    socket.clearBuffer();
    assert.equal(sockets[0].open, true);

    socket.mockMessage(msgpack.encode({
      type: "data",
      data: "abcdefg",
      id: "foo-bar-baz"
    }));
    assert.equal(sockets[0].getBuffer().toString(), "abcdefg");
    sockets[0].clearBuffer();
    socket.clearBuffer();

    sockets[0].emit('end');
    assert.deepStrictEqual(msgpack.decode(socket.buffer), {
      type: "close",
      id: "foo-bar-baz"
    });
    socket.clearBuffer();
    sockets[0].clearBuffer();

    // should attempt to route data to closed socket.
    socket.mockMessage(msgpack.encode({
      type: "data",
      id: "foo-bar-baz",
      data: "qrstuv"
    }))
    // buffer should remain empty.
    assert.equal(sockets[0].buffer.toString(), "");
  });

  it("should handle server explicitly closing unix socket", function () {
    const socket = new mocks.WebSocket(),
          client = new origin.OriginClient(socket, connect, "abcd");

    var sockets = [];
    function connect() {
      // Unix sockets are sufficiently similar to Files to use this mock.
      const unix = new mocks.File();
      unix.mockOpen();
      sockets.push(unix);
      return unix;
    }

    socket.mockOpen();
    socket.mockMessage(msgpack.encode({
      type: "start",
      id: "foo-bar-baz"
    }));
    socket.clearBuffer();

    socket.mockMessage(msgpack.encode({
      type: "open",
      id: "foo-bar-baz",
      token: "abcd"
    }));
    socket.clearBuffer();
    assert.equal(sockets[0].open, true);

    socket.mockMessage(msgpack.encode({
      type: "data",
      data: "abcdefg",
      id: "foo-bar-baz"
    }));
    assert.equal(sockets[0].getBuffer().toString(), "abcdefg");
    sockets[0].clearBuffer();
    socket.clearBuffer();

    socket.mockMessage(msgpack.encode({
      type: "close",
      id: "foo-bar-baz"
    }));
    assert.equal(sockets[0].open, false);
    // there shouldn't be an ack sent back to the client.
    assert.equal(socket.buffer.toString(), "");

    // should attempt to route data to closed socket.
    socket.mockMessage(msgpack.encode({
      type: "data",
      id: "foo-bar-baz",
      data: "qrstuv"
    }))
    // buffer should remain empty.
    assert.equal(sockets[0].buffer.toString(), "");
  });
});
