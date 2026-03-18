<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">

# Deployment

Deploying your Jetpath application involves packaging your code, choosing a hosting environment, and running the server. Jetpath's cross-runtime support gives you flexibility to deploy on VMs, containers, PaaS, or edge platforms.

---

## Common Deployment Strategies

### 1. Virtual Machines / Bare Metal

1. Provision a VM (AWS EC2, DigitalOcean Droplet, etc.)
2. Install your chosen runtime (Node.js, Deno, or Bun)
3. Clone your application and install dependencies
4. Set environment variables
5. Start your application:
   ```bash
   node dist/server.js
   # or
   bun run server.ts
   # or
   deno run --allow-net server.ts
   ```
6. Use a process manager (PM2, systemd) to auto-restart on crashes
7. Set up a reverse proxy (Nginx, Caddy) for TLS termination and load balancing

### 2. Containers (Docker)

Create a `Dockerfile` for your chosen runtime:

```dockerfile
FROM oven/bun:latest
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --production
COPY . .
EXPOSE 3000
CMD ["bun", "run", "server.ts"]
```

Build and run:
```bash
docker build -t my-jetpath-app .
docker run -p 3000:3000 -e "NODE_ENV=production" my-jetpath-app
```

Deploy to Kubernetes, AWS ECS, Google Cloud Run, Fly.io, etc.

### 3. Edge / Serverless

Jetpath supports AWS Lambda and Cloudflare Workers via the `edgeGrabber` option. In edge environments, filesystem scanning isn't available, so you pass route functions directly:

```typescript
import { Jetpath } from "jetpath";
import { GET_users, POST_users, MIDDLEWARE_ } from "./routes";

const app = new Jetpath({
  edgeGrabber: [GET_users, POST_users, MIDDLEWARE_],
  port: 3000,
});

app.listen();
```

---

## Graceful Shutdown

Jetpath provides a `close()` method for graceful shutdown. This stops accepting new connections and waits for in-flight requests to complete:

```typescript
const app = new Jetpath({ source: "./src", port: 3000 });
await app.listen();

// Handle shutdown signals
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await app.close();
  process.exit(0);
});
```

The `close()` method works across runtimes:
- Node.js: calls `server.close()`
- Bun: calls `server.stop()`
- Deno: calls `server.shutdown()`

---

## Jetpath-Specific Recommendations

- **Cross-Runtime:** Docker and VMs offer the most flexibility for runtime choice. PaaS support for Deno and Bun varies.
- **Runtime Tuning:** Use the `runtimes` constructor option for runtime-specific settings. For example, `runtimes: { bun: { reusePort: true } }` enables `SO_REUSEPORT` so multiple Bun processes can share the same port — useful for multi-process clustering behind a load balancer.
- **Configuration:** Use environment variables for all deployment-specific config (port, database URLs, secrets).
- **Build Output:** If using Node.js, compile TypeScript first (`tsc`) and deploy the `dist` folder. Bun and Deno can run TypeScript directly.
- **Process Management:** For VMs, always use a process manager. Containers and PaaS handle restarts automatically.
- **Logging:** Use structured JSON logging for easy integration with CloudWatch, Datadog, etc.
- **CORS:** In production, replace `origin: ['*']` with your specific frontend origin(s).
- **API Doc Auth:** If using the built-in API documentation UI, set `apiDoc.username` and `apiDoc.password` to protect it in production.

--- 

</docmach>
