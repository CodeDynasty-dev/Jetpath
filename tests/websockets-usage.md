uploading files with JetPath

## Node

```js
// install

// npm i ws

// usage
import { WebSocketServer } from "ws";
import http from "node:http";
import { JetPath } from "jetpath";
const app = new JetPath({ source: "tests" });

// Spinning the HTTP server and the WebSocket server.
const server = app.server;
const wsServer = new WebSocketServer({ server });
const port = 8000;
server.listen(port, () => {
  console.log(`WebSocket server is running on port ${port}`);
});

//? listen for server upgrade via ctx.request
```

## Bun

```js
// usage
export const POST_websocket = (ctx) => {
  // upgrade the request to a WebSocket
  if (app.server.upgrade(req)) {
    return; // do not return a Response
  }
  return    {
    //? https://bun.sh/docs/api/websockets
    message(ws, message) {}, // a message is received
    open(ws) {}, // a socket is opened
    close(ws, code, message) {}, // a socket is closed
    drain(ws) {}, // the socket is ready to receive more data
  },
}
```

## Deno

```js
// usage go to ws://localhost:8000/sockets

export const WS_sockets: JetFunc = (ctx) => {
  const req = ctx.request;
  if (req.headers.get("upgrade") != "websocket") {
    ctx.send("failed!");
  } 
  const { socket, response } = Deno.upgradeWebSocket(req);
  socket.addEventListener("open", () => {
    console.log("a client connected!");
  });
  socket.addEventListener("message", (event) => {
    if (event.data === "ping") {
      socket.send("pong");
    }
  });
  ctx.sendResponse(response);
};

```
 