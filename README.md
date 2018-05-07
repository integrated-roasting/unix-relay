# Introduction

This project allows relaying local unix sockets between
internet-connected hosts via an intermediary server. WebSocket is used
for transport. While it is possible to do something similar with
socat, Unlike socat, this project is intended to be used at a larger
scale as part of production infrastructure. The server brokers
connections between multiple clients on the same port, each session
capable of multiplexing multiple unix socket connections.

## Motivation

The primary use-case is to allow ssh agent forwarding to remote hosts
and / or inside docker containers. This allows local ssh keys, unique
to each developer, to be used for authentication during remote
builds. The problem of build secret managment is thus reduced to ssh
keys management.

Unlike with traditional ssh agent forwarding, the socket need not be
forwarded across each intermediate hosts, and there need not be a
chain of ssh connections between hosts.  The ssh agent socket can be
forwarded from the origninating agent to any host which can see the
relay server. This can be either good or bad depending on your
networking environment.

## Requirements

The only networking requirement is that the intermediary be visible to
both hosts, and that websocket or plain TCP communication
communication be possible (i.e. intermediate proxies don't mess with
the WebSocket protocol).

Software requirements: NodeJS 6 or higher.

## Overview and Terminology

- _relay_: The intermediary server which proxies connections between
  endpoints.
- _origin_: The endpoint with the unix socket you wish to forward.
- _destination_: The endpoint to which you want to expose the unix socket.
- _session_: The entire transaction between _origin_ and
  _destination_. A session is initiated by the _origin_.

The assumption is that a server process -- e.g. `ssh-agent` -- running
on one machine (the _origin_) is listening for connections on a socket
-- e.g. `SSH_AUTH_SOCK` -- and you wish to forward this socket over
the network to a remote machine (the _destination_).

Starting the _origin client_ immediately opens a WebSocket connection
to the _relay server_ in _origin mode_. The server responds with a
random uuid that identifies the session. The _origin client_
outputs the uuid, then waits until a _start token_ is recieved,
indicating that a remote connection has been initiated.

The _dest client_ creates a new local unix socket, and listens for
new connections on said socket. When an incoming connection is received,
a new WebSocket connection is made to the _relay_, this time in
_destination mode_. If the socket id and _auth token_ match, the
server begins forwarding data bidirectionally betwen the _origin
WebSocket_ and the _destination WebSocket_. This continues until
either end closes the connection, at which point session ends.

The origin and destination clients can multiplex multiple unix socket
connections over a single websocket. This is done without the direct
involvment of the relay server.

## Current Limitations

- The _origin socket_ must exist, and something must be listening on
  it.
- If the _destination socket_ exists, nothing should be listening on it.
- Doesn't use SSL internally, you need another tool like HAProxy to
  terminate SSL.
- While the server isn't involved in multiplexing each socket connection,
  it can see all the traffic passing between clients. This could be a
  security concern in some environments.

## Installation

    npm install

# Use Case: SSH Agent Forwarding

## Start the server

Deploy the server somewhere. It accepts a port argument on the
command-line, which defaults to port 80.

    node server.js 8080 &

## Start the origin client

On the machine with the ssh agent whose socket you wish to expose,
start origin client:

    node origin.js foo.bar.com 8080 abcdefabcdef "${SSH_AUTH_SOCK}"

- The first two arguments represent the host and port.
- The third argument is an arbitrary string token used to authenticate
  connections.
- The final argument is the path to the local socket you wish to forward.

The server will respond by printing out the uuid of the socket:

    SOCKET_ID="c0616ef5-9dfa-49a7-bb3b-c25a0b54740f"

This is done so that the whole invocation can be wrapped in `eval`
like so, similar to the manner in which ssh-agent is often used:

    eval "$(node origin.js ...)"

**Note** Currently, too much stuff is printed by default to eval directly.

## Start the dest client

On the machine to which you would like to forward the socket, start
the destination client in the background, like so:

    node dest.js foo.bar.com 8080 \
        c0616ef5-9dfa-49a7-bb3b-c25a0b54740f \
        abcdefabcdef /tmp/ssh_auth_sock &

If you are using this for ssh, the only remaining step is to set the
envvar, and use it to authenticate with something.

    export SSH_AUTH_SOCK=/tmp/ssh_auth_sock &
    ssh -T git@github.com

# Considerations for SSH Agent Forwarding

- The usual cautions about ssh agent forwarding apply:
  - Don't expose your ssh agent socket to untrusted hosts.
- Use a separate ssh key specifically for each system using this
  forwarding mechanism.
- Ensure that this key can only be used for the specific operations
  required. Limit the damage that can be done if your socket gets hijacked.
  - For example, a github key to a user with read-only access to your
    source repo.
- Forward your agent socket for only as long as necessary, and no longer:
  - Do not leave your connection to the relay server running for long
    periods of time.
- Whitelist hosts where possible.
- Keep the relay server confined to a private network, where possible.

# Roadmap

- Auth token validation should be controlled by _origin_, not shared
  directly with _relay_.
- Allow up to N total connections per session, controlled by the _origin_.
- Allow up to N simultaneous connections, controlled by the _origin_.
- Allow specifying destination host whitelist, controlled by the _origin_.
  - Relies at least on _relay_ remaining trustworthy.
- Support client-side stream cypher?
  - Help prevent malicious or compromised _relay_ from hijacking client
    sessions, since symetric key wouldn't be (directly) shared with server.
- Support listening on separate ports for _origin_ and _destination_ clients.
  - Allows _relay_ administrators to employ more restrictive routing
    rules for _destination_ clients, such as whitelisting based on ip.
- Add ssl support.
- Support passing parameters in file or via stdin.
