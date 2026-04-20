// src/index.ts

import { type JetMiddleware, Jetpath } from "jetpath";
import { authPlugin } from "./plugins/auth.ts";
import { jetLogger } from "./plugins/logging.ts";

const app = new Jetpath({
   cluster: {
    enabled: true,
    workers: 4,
    silent: true,
  },
  strictMode: "OFF",
  generatedRoutesFilePath: "",
  apiDoc: {
    display: false,
  },
  source: ".",
  globalHeaders: {
    "Content-Type": "application/json",
  },
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 9000,
});

app.derivePlugins(jetLogger, authPlugin);

app.listen();;