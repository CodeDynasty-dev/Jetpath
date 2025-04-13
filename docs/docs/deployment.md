<docmach type="wrapper" file="doc-fragments/docs.html" replacement="content">

# Deployment

Deploying your JetPath application involves packaging your code and dependencies, choosing a hosting environment, and running the application server so it's accessible to users. JetPath's flexibility allows you to deploy it across various platforms using Node.js, Deno, or Bun as the runtime.

---

## General Considerations Before Deployment

Regardless of your target platform, consider these points:

1.  **Build Step (TypeScript Compilation):**
    * JetPath applications are typically written in TypeScript (`.jet.ts`, `.ts`).
    * **Node.js/Bun (often):** You'll usually need to compile your TypeScript code to JavaScript using `tsc` (based on your `tsconfig.json`) or Bun's built-in bundler/transpiler before deployment. Your `server.ts` entry point will then run the compiled JavaScript output (e.g., `node dist/server.js`).
    * **Deno:** Deno can run TypeScript directly. You might still have a build step for bundling or type checking (`deno check server.ts`), but compilation to JS isn't strictly necessary for running.
    * Ensure your build output includes all necessary JavaScript files.

2.  **Dependencies:**
    * **Node.js/Bun:** Your `node_modules` directory (containing dependencies listed in `package.json`) must be included in the deployment or installed on the target server using `npm install --production`, `yarn install --production`, or `bun install --production`.
    * **Deno:** Dependencies are typically cached based on imports. Ensure the deployment environment has network access to download dependencies on first run, or use `deno vendor` to vendor dependencies locally before deployment.

3.  **Runtime Choice:**
    * Ensure the exact runtime (Node.js, Deno, or Bun) and version you developed with is installed and available in your deployment environment (VM, container image, PaaS setting).

4.  **Environment Variables:**
    * **Never hardcode secrets** (API keys, database passwords, JWT secrets) in your code.
    * Use environment variables (`process.env.VARIABLE_NAME`) to manage configuration.
    * Most hosting platforms provide a way to securely set environment variables for your application. Consult your platform's documentation.

5.  **Port Binding:**
    * Your JetPath application listens on a port specified in the `JetPath` constructor (`port: 3000`) or potentially via an environment variable (e.g., `process.env.PORT`).
    * Most hosting platforms (PaaS, Containers) automatically route external traffic (on port 80/443) to the port your application listens on internally. Ensure your application respects the `PORT` environment variable if provided by the platform.

6.  **Static Files:**
    * If your application serves static files (CSS, JS, images) using JetPath's `static` option, ensure these files are included in your deployment package and the paths are configured correctly. Often, it's more performant to serve static files directly via a reverse proxy (like Nginx) or a CDN.

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
    9. **(Recommended)** Set up a reverse proxy (like Nginx or Caddy) in front of your JetPath app to handle TLS/SSL termination (HTTPS), load balancing (if running multiple instances), basic caching, and potentially serving static files directly.

### 2. Containers (Docker)

* **Concept:** Package your application, its runtime, and dependencies into a standardized container image. Deploy this image using container orchestration platforms.
* **Steps:**
    1.  **Create a `Dockerfile`:**
        * Start with a base image for your chosen runtime (e.g., `node:18-alpine`, `denoland/deno:latest`, `oven/bun:latest`).
        * Set the working directory (e.g., `/app`).
        * Copy `package.json`, `*.lockb`, `deno.json` etc. and install dependencies (`npm install --production`, `deno cache`, `bun install --production`). Use multi-stage builds to keep the final image small.
        * Copy your application source code.
        * Perform the build step if necessary (`RUN tsc` or `RUN bun build`).
        * Expose the port your JetPath application listens on (`EXPOSE 3000`).
        * Set the command to run your application (`CMD ["node", "dist/server.js"]` or `CMD ["deno", "run", "--allow-net", "server.ts"]` or `CMD ["bun", "run", "server.ts"]`).
    2.  **Build the Docker Image:** `docker build -t my-jetpath-app .`
    3.  **Run the Container:** `docker run -p 3000:3000 -e "NODE_ENV=production" -e "DATABASE_URL=..." my-jetpath-app` (Map port, pass environment variables).
    4.  **Deploy:** Push the image to a registry (Docker Hub, AWS ECR, Google Artifact Registry) and deploy it using platforms like Kubernetes, AWS ECS, Google Cloud Run, Docker Swarm, etc. These platforms handle scaling, networking, and health checks.

### 3. Platform-as-a-Service (PaaS)

* **Concept:** Abstract away server management. You push your code, and the platform handles building, deploying, scaling, and routing.
* **Platforms:** Heroku, Render, Fly.io, Railway, Vercel (Node.js focus), Deno Deploy (Deno focus).
* **Steps:**
    1. Choose a PaaS provider that supports your chosen runtime (Node.js, Deno, or Bun).
    2. Configure your project according to the platform's requirements:
        * **Procfile (Heroku, others):** Define how to start your web process (e.g., `web: node dist/server.js`).
        * **Build Scripts (`package.json`):** Define `build` and `start` scripts.
        * **Runtime Configuration:** Specify the runtime version (e.g., `engines` in `package.json`, `deno.json`, platform-specific config files).
        * **Environment Variables:** Configure secrets and settings through the platform's dashboard or CLI.
    3. Connect your Git repository to the platform.
    4. Push your code. The platform will detect your project type, install dependencies, run your build script, and deploy your application.

### 4. Serverless Functions

* **Concept:** Run your code in response to events (like HTTP requests) without managing servers. Pay per execution.
* **Platforms:** AWS Lambda, Google Cloud Functions, Azure Functions, Cloudflare Workers.
* **Steps:**
    1. **Adapter/Wrapper:** This is often the trickiest part. Serverless platforms have specific event formats. You typically need an **adapter** layer to translate the platform's event into a standard `Request` object that JetPath can understand and convert JetPath's response back into the format the platform expects. Look for official or community-provided adapters for running generic web frameworks (or specifically JetPath, if available) on your target serverless platform. Without an adapter, significant manual integration is required.
    2. **Packaging:** Bundle your JetPath application code, dependencies (including the adapter), and any build output into a deployment package (e.g., a zip file).
    3. **Configuration:** Define the function handler (pointing to the adapter's entry point), memory allocation, timeout, and environment variables.
    4. **API Gateway:** Configure an API Gateway service (like AWS API Gateway or Google Cloud API Gateway) to create an HTTP endpoint that triggers your serverless function.

---

## JetPath Specifics & Recommendations

* **Cross-Runtime:** The main advantage is choosing the best platform *and* runtime combination for your needs. Docker and VMs offer the most flexibility here. PaaS support might vary depending on how well they support Deno and Bun compared to Node.js. Serverless often requires runtime-specific adapters.
* **Configuration:** Rely heavily on environment variables for configuration across all deployment types.
* **Build Output:** Ensure your deployment process correctly includes the compiled JavaScript output (`dist` folder or similar) if applicable for your runtime choice.
* **Process Management:** For VM/Bare Metal, always use a process manager (PM2, systemd) to ensure your app restarts on failure. Containers and PaaS handle this automatically.
* **Logging:** Configure structured logging (e.g., JSON format) that can be easily ingested by your chosen platform's logging service (CloudWatch, Google Cloud Logging, Datadog, etc.).

---

## Next Steps

* Consult the documentation for your chosen **hosting platform** and **runtime** for detailed, platform-specific instructions.
* Review JetPath's [**Configuration**](./configuration.md) options.
* Implement robust [**Logging**](#observability) for monitoring your deployed application. *(Assuming an Observability page exists)*

</docmach>



