const assert = require('assert'),
      msgpack = require('msgpack-lite'),
      sinon = require('sinon'),
      mocks = require('./mocks.js'),
      server = require('../server.js');

describe('server', function () {

  beforeEach(function () {
    this.clock = sinon.useFakeTimers();
  });

  afterEach(function() {
    this.clock.restore();
  });

  it("should accept new connections", function () {
    const ws_server = new mocks.Server(),
          mock_origin_socket = new mocks.WebSocket(),
          mock_dest_socket = new mocks.WebSocket(),
          relay_server = new server.RelayServer(ws_server);

    mock_origin_socket.mockOpen();
    mock_dest_socket.mockOpen();

    ws_server.mockOpenSocket(mock_origin_socket, {
      url: "?mode=origin&token=abcd"
    });

    const message = msgpack.decode(mock_origin_socket.buffer);
    assert.equal(message.type, "start");
    assert.equal(message.id.length, 36);

    mock_origin_socket.clearBuffer();
    ws_server.mockOpenSocket(mock_dest_socket, {
      url: `?mode=dest&token=abcd&id=${message.id}`
    });
    assert.equal(mock_dest_socket.buffer.toString(), "");

    // Test that forwarding  works.
    mock_origin_socket.mockMessage("foo");
    assert.equal(mock_dest_socket.buffer.toString(), "foo");
    mock_dest_socket.mockMessage("bar");
    assert.equal(mock_origin_socket.buffer.toString(), "bar");

    // Test that dest socket is closed if origin socket is closed.
    mock_origin_socket.mockClose();
    assert.equal(mock_origin_socket.is_open, false);
    assert.equal(mock_dest_socket.is_open, false);
  });

  it("should disconnect origin if dest disconnects", function () {
    const ws_server = new mocks.Server(),
          mock_origin_socket = new mocks.WebSocket(),
          mock_dest_socket = new mocks.WebSocket(),
          relay_server = new server.RelayServer(ws_server);

    mock_origin_socket.mockOpen();
    mock_dest_socket.mockOpen();

    ws_server.mockOpenSocket(mock_origin_socket, {
      url: "?mode=origin&token=abcd"
    });

    const message = msgpack.decode(mock_origin_socket.buffer);
    assert.equal(message.type, "start");
    assert.equal(message.id.length, 36);

    mock_origin_socket.clearBuffer();
    ws_server.mockOpenSocket(mock_dest_socket, {
      url: `?mode=dest&token=abcd&id=${message.id}`
    });
    assert.equal(mock_dest_socket.buffer.toString(), "");

    // Test that origin socket is closed if dest socket is closed.
    mock_dest_socket.mockClose();
    assert.equal(mock_origin_socket.is_open, false);
    assert.equal(mock_dest_socket.is_open, false);
  });

  it("should not allow connecting if tokens don't match", function () {
    const ws_server = new mocks.Server(),
          mock_origin_socket = new mocks.WebSocket(),
          mock_dest_socket = new mocks.WebSocket(),
          relay_server = new server.RelayServer(ws_server);

    mock_origin_socket.mockOpen();
    mock_dest_socket.mockOpen();

    ws_server.mockOpenSocket(mock_origin_socket, {
      url: "?mode=origin&token=abcd"
    });

    const message = msgpack.decode(mock_origin_socket.buffer);
    assert.equal(message.type, "start");
    assert.equal(message.id.length, 36);

    mock_origin_socket.clearBuffer();
    ws_server.mockOpenSocket(mock_dest_socket, {
      url: `?mode=dest&token=efgh&id=${message.id}`
    });
    assert.equal(mock_dest_socket.buffer.toString(), "");
    assert.equal(mock_dest_socket.is_open, false);

    // Origin connection should remain open.
    assert.equal(mock_origin_socket.is_open, true);
  });

  it("should not allow connecting to a nonexistent session", function () {
    const ws_server = new mocks.Server(),
          mock_origin_socket = new mocks.WebSocket(),
          mock_dest_socket = new mocks.WebSocket(),
          relay_server = new server.RelayServer(ws_server);

    mock_origin_socket.mockOpen();
    mock_dest_socket.mockOpen();

    ws_server.mockOpenSocket(mock_origin_socket, {
      url: "?mode=origin&token=abcd"
    });

    const message = msgpack.decode(mock_origin_socket.buffer);
    assert.equal(message.type, "start");
    assert.equal(message.id.length, 36);

    mock_origin_socket.clearBuffer();
    ws_server.mockOpenSocket(mock_dest_socket, {
      url: `?mode=dest&token=abcd&id=fooobarrbazz-adsfsdf-sdfsdf-sdf`
    });
    assert.equal(mock_dest_socket.buffer.toString(), "");
    assert.equal(mock_dest_socket.is_open, false);

    // Origin connection should remain open.
    assert.equal(mock_origin_socket.is_open, true);
  });

  it("should not allow allow reconnecting to a closed session", function () {
    const ws_server = new mocks.Server(),
          mock_origin_socket = new mocks.WebSocket(),
          mock_dest_socket = new mocks.WebSocket(),
          another_socket = new mocks.WebSocket(),
          relay_server = new server.RelayServer(ws_server);

    mock_origin_socket.mockOpen();
    mock_dest_socket.mockOpen();
    another_socket.mockOpen();

    ws_server.mockOpenSocket(mock_origin_socket, {
      url: "?mode=origin&token=abcd"
    });

    const message = msgpack.decode(mock_origin_socket.buffer);
    assert.equal(message.type, "start");
    assert.equal(message.id.length, 36);

    mock_origin_socket.clearBuffer();
    ws_server.mockOpenSocket(mock_dest_socket, {
      url: `?mode=dest&token=abcd&id=${message.id}`
    });
    assert.equal(mock_dest_socket.buffer.toString(), "");
    assert.equal(mock_dest_socket.is_open, true);
    assert.equal(mock_origin_socket.is_open, true);

    mock_dest_socket.mockClose();
    assert.equal(mock_dest_socket.is_open, false);
    assert.equal(mock_origin_socket.is_open, false);

    ws_server.mockOpenSocket(another_socket, {
      url: `?mode=dest&token=abcd&id=${message.id}`
    });
    assert.equal(mock_dest_socket.is_open, false);
    assert.equal(mock_origin_socket.is_open, false);
    assert.equal(another_socket.is_open,false);
  });
})
