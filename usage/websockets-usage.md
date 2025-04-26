# Using websockets in jetpath 

## Deno & Bunjs

```js
// usage go to ws://localhost:8000/sockets

//  for deno and bun only
export const GET_sockets: JetFunc = (ctx) => {
  ctx.upgrade(); 
  const conn = ctx.connection!;
  try {
    conn.addEventListener("open", (socket) => {
      console.log("a client connected!");
      socket.send("😎 Welcome to jet chat");
    });
    conn.addEventListener("message", (socket,event) => {
      if (event.data === "ping") {
        socket.send("pong");
      } else {
        socket.send("all your " + event.data + "  are belong to us!");
      }
    });
  } catch (error) {
   console.log(error); 
  }
};

```
 
## Node

```js
// install

// npm i ws

// usage
import { WebSocketServer } from "ws";
import http from "node:http";
import { Jetpath } from "jetpath";
const app = new Jetpath({ source: "tests" });

// Spinning the HTTP server and the WebSocket server.
const server = app.server;
const wsServer = new WebSocketServer({ server });
const port = 8000;
server.listen(port, () => {
  console.log(`WebSocket server is running on port ${port}`);
});

//? listen for server upgrade via ctx.request
```