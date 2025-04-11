// Bun.serve({
//   port: 3000,
//   fetch(req, server) {
//     // upgrade the request to a WebSocket
//     if (server.upgrade(req)) {
//       return; // do not return a Response
//     }
//     return new Response("Upgrade failed", { status: 500 });
//   },
//   websocket: {
//     open: (ws) => {
//       console.log("Client connected");
//       ws.send("Hello from Bun!");
//     },
//     message: (ws, message) => {
//       console.log("Client sent message", message);
//       ws.send("All your " + message + " are belong to us!");
//     },
//     close: (ws) => {
//       console.log("Client disconnected");
//     },
//   },
// });
