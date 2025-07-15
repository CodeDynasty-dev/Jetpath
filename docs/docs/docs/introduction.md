<docmach type="wrapper" file="docs/fragments/docs.html" replacement="content">
 
# Introduction to Jetpath

**Write Once, Run Cross-runtime**

Jetpath is more than just another framework - it's your new best friend in backend development, designed to make your life easier while giving you unprecedented flexibility.

## What Makes Jetpath Special?

- **Write Once, Run Cross-runtime:** Your code runs seamlessly on Node.js, Deno, or Bun. No more worrying about runtime lock-in!
- **Zero-Router Magic:** Create endpoints by simply writing functions. No need to wrestle with complex routing and middleware.
- **TypeScript First:** Built with TypeScript from the ground up, giving you the best of both worlds: type safety and JavaScript flexibility.
- **No boring parts:** We've eliminated all the boring parts of backend development so you can focus on what matters - building amazing features.

## How It Works

Jetpath uses smart conventions and naming-based routing. Instead of writing route definitions, you just:

1\. Create `.jet.ts` or `.jet.js` files in your `src` directory

2\. Export functions with intuitive names like `METHOD_ + optional path segments`

3\. That it.

For example, create `src/users.jet.ts` with:
```typescript
import { type JetRoute } from "jetpath";
// This becomes GET /users
export const GET_users: JetRoute = (ctx) => {
  ctx.send({ message: "runs on any runtime!" });
};
```

It's that simple!

## Here the best parts of Jetpath


- 🚀 **Blazing Fast Development:** No more configuration files or complex setup. Just write your code and let Jetpath handle the rest.
- 📚 **Automatic API Docs:** Define your validation schemas once, and get beautiful, interactive API documentation that stays in sync with your code.
- 🔒 **Type Safety:** Built with TypeScript first, giving you the best of both worlds: type safety and JavaScript flexibility.
- 🧩 **Unlimited Extensibility:** Extend Jetpath with official plugins or create your own. The framework is designed to grow with your needs.
- 💡 **Smart Conventions:** Jetpath works the way you think. Function naming conventions means your code structure matches your API structure.

## Jetpath is perfect for:

- **Every Developer & Teams:** Build projects faster without sacrificing quality
- **Startups:** Rapidly iterate on your API while maintaining type safety
- **Enterprise Teams:** Build maintainable, scalable APIs that work across multiple runtimes
- **Full-Stack Developers:** Finally have a backend framework that matches the joy of frontend development
- **Anyone Who Hates Boilerplate:** Jetpath handles the boring stuff so you can focus on what matters
- **Anyone Who Loves:** Developer experience, code maintainability, and runtime flexibility

## Ready to Get Started?

Dive into Jetpath and experience the joy of modern backend development:

- Quick Start: Follow our [Quick Start](./quickstart.html) guide to build your first API in minutes
- Core Concepts: Explore the [Core Concepts](./routing.html) to understand how everything works together

Join the [Discord community](https://discord.codedynasty.dev),

</docmach>



