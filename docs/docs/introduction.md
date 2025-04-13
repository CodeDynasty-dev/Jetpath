<docmach type="wrapper" file="doc-fragments/docs.html" replacement="content">
 
# Introduction to JetPath

**Write Once, Run Everywhere: The Universal JavaScript Backend Framework**

Welcome to JetPath! If you're looking to build modern, efficient, and scalable backend APIs with JavaScript or TypeScript, you've come to the right place. JetPath is designed from the ground up to streamline your development process while offering unprecedented flexibility in your choice of runtime environment.

---

## What is JetPath?

JetPath is a backend framework that simplifies API creation through smart **conventions** and a **file-based routing** system. Instead of manually defining every endpoint, you simply create files and export named functions within a designated project structure – JetPath automatically discovers these and wires them up as API routes.

At its core, JetPath embraces the **"write once, run everywhere"** philosophy for server-side JavaScript. It achieves this through a carefully designed abstraction layer, allowing your JetPath application code to run natively and performantly on:

* **Node.js:** The long-standing standard.
* **Deno:** The modern, secure runtime.
* **Bun:** The new, ultra-fast toolkit.

This eliminates platform lock-in and gives you the freedom to choose the best runtime for your deployment needs, now or in the future, without rewriting your application logic.

---

## Why JetPath?

Choosing the right framework is crucial. Here's what makes JetPath stand out:

* 🚀 **Rapid Development:** Get APIs up and running faster. Convention-based routing minimizes boilerplate code, letting you focus on business logic. File-based routing means adding new endpoints is as simple as creating a new file.
* universal **Universal Runtime Support:** Target Node.js, Deno, *and* Bun with a single codebase. Reduce maintenance overhead and future-proof your application.
* 📚 **Integrated API Documentation:** Define validation schemas once using powerful libraries like Zod or TypeBox. JetPath uses these schemas not only for robust validation and TypeScript type inference but also to automatically generate interactive API documentation (like Swagger UI), keeping your docs always in sync with your code. [cite: tests/app.jet.ts]
* 🔒 **Strong Type Safety:** Built with TypeScript first in mind. Leverage static typing throughout your application, from request validation to handler logic, catching errors early and improving developer experience.
* 🧩 **Extensible Plugin System:** Enhance core functionality easily. Integrate official or community plugins for common tasks like authentication, advanced file uploads, logging, and more, or create your own. [cite: tests/app.jet.ts]
* ⚡ **Performance Aware:** While prioritizing portability, JetPath provides mechanisms for performance optimization. Use opt-in features like eager request processing or official runtime-specific adapters for critical paths when maximum speed is required on a specific platform.

---

## Who is JetPath For?

JetPath is an excellent choice for:

* **Startups and Teams:** Needing to build and iterate quickly without sacrificing structure or type safety.
* **Multi-Platform Deployments:** Developers or organizations targeting or potentially migrating between Node.js, Deno, and Bun environments.
* **API-First Development:** Projects where clear, automatically generated API documentation is essential.
* **Full-Stack Developers:** Looking for a productive and modern JavaScript/TypeScript backend framework.
* **Anyone valuing:** Developer experience, code maintainability, and runtime flexibility.

---

## Ready to Dive In?

* **Get Started Quickly:** Follow the [**Quick Start**](./quick-start.md) guide.
* **Understand the Fundamentals:** Explore the [**Core Concepts**](./core-concepts/routing.md).

</docmach>



