<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">

# Deployment

Deploying your Jetpath application involves packaging your code and dependencies, choosing a hosting environment, and running the application server so it's accessible to users. Jetpath's flexibility allows you to deploy it across various platforms using Node.js, Deno, or Bun as the runtime.

---

## Common Deployment Strategies

Here are outlines for common deployment approaches:

### 1. Virtual Machines (VMs) / Bare Metal

* **Concept:** You manage the operating system, runtime installation, and application deployment manually or via configuration management tools.
* **Steps:**
    1. Provision a VM (e.g., AWS EC2, Google Compute Engine, DigitalOcean Droplet) or prepare a physical server.
    2. Install your chosen runtime (Node.js, Deno, or Bun).
    3. Install necessary tools (Git, potentially a process manager like PM2).
    4. Clone your application repository or copy your built application code (including `node_modules` or vendor directory).
    5. Install production dependencies if needed.
    6. Set environment variables (e.g., using `.env` files with `dotenv` or system environment variables).
    7. Start your application server (e.g., `node dist/server.js`, `deno run --allow-net server.ts`, `bun run server.ts`).
    8. **(Recommended)** Use a process manager (like PM2 for Node.js/Bun, or systemd for any runtime) to automatically restart your app if it crashes and manage logs.
    9. **(Recommended)** Set up a reverse proxy (like Nginx or Caddy) in front of your Jetpath app to handle TLS/SSL termination (HTTPS), load balancing (if running multiple instances), basic caching, and potentially serving static files directly.

### 2. Containers (Docker)

* **Concept:** Package your application, its runtime, and dependencies into a standardized container image. Deploy this image using container orchestration platforms.
* **Steps:**
    1.  **Create a `Dockerfile`:**
        * Start with a base image for your chosen runtime (e.g., `node:18-alpine`, `denoland/deno:latest`, `oven/bun:latest`).
        * Set the working directory (e.g., `/app`).
        * Copy `package.json`, `*.lockb`, `deno.json` etc. and install dependencies (`npm install --production`, `deno cache`, `bun install --production`). Use multi-stage builds to keep the final image small.
        * Copy your application source code.
        * Perform the build step if necessary (`RUN tsc` or `RUN bun build`).
        * Expose the port your Jetpath application listens on (`EXPOSE 3000`).
        * Set the command to run your application (`CMD ["node", "dist/server.js"]` or `CMD ["deno", "run", "--allow-net", "server.ts"]` or `CMD ["bun", "run", "server.ts"]`).
    2.  **Build the Docker Image:** `docker build -t my-jetpath-app .`
    3.  **Run the Container:** `docker run -p 3000:3000 -e "NODE_ENV=production" -e "DATABASE_URL=..." my-jetpath-app` (Map port, pass environment variables).
    4.  **Deploy:** Push the image to a registry (Docker Hub, AWS ECR, Google Artifact Registry) and deploy it using platforms like Kubernetes, AWS ECS, Google Cloud Run, Docker Swarm, etc. These platforms handle scaling, networking, and health checks.




## Jetpath Specifics & Recommendations

* **Cross-Runtime:** The main advantage is choosing the best platform *and* runtime combination for your needs. Docker and VMs offer the most flexibility here. PaaS support might vary depending on how well they support Deno and Bun compared to Node.js. Serverless often requires runtime-specific adapters.
* **Configuration:** Rely heavily on environment variables for configuration across all deployment types.
* **Build Output:** Ensure your deployment process correctly includes the compiled JavaScript output (`dist` folder or similar) if applicable for your runtime choice.
* **Process Management:** For VM/Bare Metal, always use a process manager (PM2, systemd) to ensure your app restarts on failure. Containers and PaaS handle this automatically.
* **Logging:** Configure structured logging (e.g., JSON format) that can be easily ingested by your chosen platform's logging service (CloudWatch, Google Cloud Logging, Datadog, etc.).

--- 

</docmach>



