// src/routes/live.ts

import { JetRoute, use } from "jetpath";
// Import types if needed, e.g., for initial stats message
import { pets } from "../data/models"; // Import pets data for initial stats message

// --- WebSocket Server ---
// This route handles WebSocket connections for real-time updates.

// Keep track of connected WebSocket clients using a Set.
const connectedSockets = new Set<WebSocket>();

// --- WebSocket Broadcasting ---
// Function to broadcast messages to all connected clients.
const broadcastMessage = (message: string) => {
  // Iterate over all connected sockets.
  const messageJson = JSON.stringify({
    type: "update",
    message,
    timestamp: new Date().toISOString(),
  }); // Format message as JSON

  connectedSockets.forEach((socket) => {
    // Check if the socket connection is open before sending.
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(messageJson); // Send the message to the client.
    }
  });
  console.log(
    `Broadcasted message to ${connectedSockets.size} clients: "${message}"`,
  );
};

// Export the broadcast function so other modules (like recipes) can use it.
export { broadcastMessage };

/**
 * WebSocket Endpoint for real-time updates. (Extracted from app.jet.ts)
 * @route GET /live
 * @access Public (Based on app.jet.ts sample)
 * Demonstrates: Handling WebSocket connections, sending/receiving messages, broadcasting.
 */
export const GET_live: JetRoute = (ctx) => {
  // Initiate the WebSocket upgrade handshake.
  // This tells Jetpath to switch from HTTP to WebSocket protocol for this connection.
  ctx.upgrade();

  // After a successful upgrade, ctx.connection or a similar property holds the WebSocket object.
  // The exact way to access the WebSocket object might depend on the Jetpath version/adapter.
  // The original sample uses `const conn = ctx.connection!`. Let's stick to that assumption.
  const ws: WebSocket = (ctx as any).connection; // Assuming ctx.connection is the WebSocket or similar

  // If the upgrade fails, handle the error (though the middleware might catch it).
  if (!ws) {
    ctx.code = 500;
    ctx.send({ status: "error", message: "Failed to upgrade to WebSocket." });
    console.error("WebSocket upgrade failed for request:", ctx.request.url);
    return; // Stop processing if no WebSocket connection was established.
  }

  // --- WebSocket Event Listeners ---
  // Attach event listeners to the WebSocket object to handle connection events and messages.

  // When the WebSocket connection is opened successfully.
  ws.onopen = () => {
    console.log("WebSocket client connected.");
    connectedSockets.add(ws); // Add the new socket to our set of connected clients.

    // Send a welcome message to the new client.
    // You could include initial data like current stats.
    const availablePets = pets.filter((pet) => pet.available).length;
    ws.send(JSON.stringify({
      type: "info",
      message: "Connected to PetShop live updates.",
      currentStats: {
        totalPets: pets.length,
        availablePets: availablePets,
      },
      timestamp: new Date().toISOString(),
    }));

    // Inform other clients about the new connection (optional).
    broadcastMessage(
      `A new client connected (Total active connections: ${connectedSockets.size}).`,
    );
  };

  // When a message is received from a client.
  ws.onmessage = (event) => {
    const message = event.data; // The data received from the client.
    console.log("WebSocket message received:", message);
    // Handle incoming messages from clients if needed.
    // For this simple sample, we'll respond to a 'ping' message.
    try {
      const parsedMessage = typeof message === "string"
        ? JSON.parse(message)
        : message;
      if (parsedMessage.type === "ping") {
        // Respond with a pong message for health checks.
        ws.send(
          JSON.stringify({ type: "pong", timestamp: new Date().toISOString() }),
        );
      } else {
        // If the message is not recognized, you could broadcast it or handle it differently.
        // For this sample, we'll just log and ignore other messages.
        console.log(
          "Ignoring unknown WebSocket message type:",
          parsedMessage.type,
        );
        // Optionally send an error back to the client:
        // ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
      // You could add more complex command handling here based on message.type or content.
    } catch (e) {
      console.error("Failed to parse or handle WebSocket message:", e);
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format (expected JSON)",
        }),
      );
    }
  };

  // When the WebSocket connection is closed by either the client or server.
  ws.onclose = (event) => {
    console.log(
      `WebSocket client disconnected (Code: ${event.code}, Reason: ${
        event.reason || "No reason"
      }).`,
    );
    connectedSockets.delete(ws); // Remove the closed socket from the set.
    // Inform other clients about the disconnection (optional).
    broadcastMessage(
      `A client disconnected (Total active connections: ${connectedSockets.size}).`,
    );
  };

  // When a WebSocket error occurs.
  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    // The `onclose` event typically follows an `onerror` event, so cleanup usually happens in `onclose`.
  };

  // The initial HTTP request handler does not send a response after calling ctx.upgrade().
  // The connection is now managed by the WebSocket event listeners and the server's WebSocket handling.
};

// Apply .info() for documentation.
// This describes the GET request that initiates the WebSocket handshake.
use(GET_live).info("WebSocket endpoint for real-time pet updates."); // Adjusted info message

// Export the route handler.
