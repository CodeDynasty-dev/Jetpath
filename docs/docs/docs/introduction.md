<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">
 
# Introduction to Jetpath

**Write Once, Run Cross-runtime**

Jetpath is a performance-first, cross-runtime API framework designed to eliminate boilerplate and cognitive overhead in API development.

## What Makes Jetpath Special?

- **Write Once, Run Cross-runtime:** Your code runs seamlessly on Node.js, Deno, Bun, AWS Lambda, and Cloudflare Workers. No runtime lock-in.
- **Zero-Router Magic:** Create endpoints by simply writing functions. No route definitions, no configuration files.
- **TypeScript First:** Built with TypeScript from the ground up, giving you type safety with JavaScript flexibility.
- **No Boring Parts:** Convention-based routing, auto-generated API docs, and built-in validation mean you focus on features, not plumbing.

## How It Works

Jetpath uses smart conventions and naming-based routing. Instead of writing route definitions, you just:

1. Create `.jet.ts` files in your `src` directory
2. Export functions with intuitive names like `METHOD_path_segments`
3. That's it.

For example, create `src/users.jet.ts` with:

```typescript
import { type JetRoute } from "jetpath";

// This becomes GET /users
export const GET_users: JetRoute = (ctx) => {
  ctx.send({ message: "runs on any runtime!" });
};
```

## The Best Parts

- **Fast Development:** No configuration files or complex setup. Write code and go.
- **Automatic API Docs:** Define validation schemas once, get interactive API documentation that stays in sync with your code.
- **Type Safety:** Full TypeScript support with generics for request body, params, query, and response types.
- **Extensible:** Extend Jetpath with plugins for auth, logging, file uploads, or anything else.
- **Smart Conventions:** Function naming conventions mean your code structure matches your API structure.
- **Performance:** Trie-based routing, context pooling, and minimal abstractions keep throughput high.

## Jetpath is for:

- **Startups:** Rapidly iterate on your API while maintaining type safety
- **Enterprise Teams:** Build maintainable, scalable APIs that work across multiple runtimes
- **Full-Stack Developers:** A backend framework that matches the joy of frontend development
- **Anyone Who Hates Boilerplate:** Jetpath handles the boring stuff so you can focus on what matters

## Ready to Get Started?

- Quick Start: Follow our [Quick Start](./quickstart.html) guide to build your first API in minutes
- Core Concepts: Explore [Routing](./routing.html) to understand how everything works together

Join the [Discord community](https://discord.codedynasty.dev).

</docmach>
