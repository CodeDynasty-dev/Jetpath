import { writeFile } from "node:fs/promises";
import {
  _jet_middleware,
  _JetPath_paths,
  _JetPath_paths_trie,
  assignMiddleware,
  compileAPI,
  compileUI,
  corsMiddleware,
  generateRouteTypes,
  getHandlers,
  getLocalIP,
  server,
} from "./primitives/functions.js";
import type { jetOptions, UnionToIntersection } from "./primitives/types.js";
import { JetPlugin, Log } from "./primitives/classes.js";
import { sep } from "node:path";

export class Jetpath {
  public server: any;
  private listening: boolean = false;
  /**
   * an object you can set values to per request
   */
  plugins: (UnionToIntersection<JetPlugin[]> & Record<string, any>) | undefined;
  private options: jetOptions = {
    port: 8080,
    apiDoc: { display: "UI" },
    cors: false,
    strictMode: "OFF",
    source: ".",
  };
  private plugs: JetPlugin[] = [];
  constructor(options: jetOptions = {}) {
    Object.assign(this.options, options);
    if (!this.options.port) this.options.port = 8080;
    // ? setting up app configs
    if (this.options.cors === true) {
      corsMiddleware({
        exposeHeaders: [],
        allowMethods: ["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT"],
        origin: ["*"],
        allowHeaders: ["*"],
        maxAge: "86400",
        keepHeadersOnError: true,
        ...(typeof options?.cors === "object" ? options.cors : {}),
      });
    }
  }
  addPlugins(plugins: {
    executor: (init: any) => Record<string, Function>;
    server?: any;
    name: string;
  }[]): void {
    if (this.listening) {
      throw new Error("Your app is listening new plugins can't be added.");
    }
    plugins.forEach((plugin) => {
      if (
        typeof plugin.executor === "function" || typeof plugin.name === "string"
      ) {
        // ? add plugin to the server
        this.plugs.push(
          new JetPlugin(plugin),
        );
      } else {
        throw new Error("Plugin executor and name is required");
      }
    });
  }
  async listen(): Promise<void> {
    if (!this.options.source) {
      Log.LOG(
        "Jetpath: Provide a source directory to avoid scanning the root directory",
        "warn",
      );
    }
    // ? {-view-} here is replaced at build time to html
    let UI = `{{view}}`;
    Log.LOG("Compiling...", "warn");
    const startTime = performance.now();

    // ? Load all jetpath functions described in user code
    const errorsCount = await getHandlers(this.options?.source!, true);
    const endTime = performance.now();
    // Log.LOG("Compiled!");
    //? compile API
    const [handlersCount, compiledAPI] = compileAPI(this.options);
    // ? render API in UI
    if (this.options?.apiDoc?.display === "UI") {
      UI = compileUI(UI, this.options, compiledAPI);
      const name = this.options?.apiDoc?.path || "/api-doc";
      _JetPath_paths_trie["GET"].insert(name, (
        ctx,
      ) => {
        if (this.options.apiDoc?.username && this.options.apiDoc?.password) {
          const authHeader = ctx.get("authorization");
          if (authHeader && authHeader.startsWith("Basic ")) {
            const [authType, encodedToken] = authHeader.trim().split(" ");
            if (authType !== "Basic" || !encodedToken) {
              ctx.code = 401;
              ctx.set(
                "WWW-Authenticate",
                `Basic realm=Jetpath API Doc`,
              );
              ctx.send(
                `<h1>401 Unauthorized</h1>`,
                "text/html",
              );
              return;
            }
            let username, password;
            try {
              const decodedToken = new TextDecoder().decode(
                Uint8Array.from(atob(encodedToken), (c) => c.charCodeAt(0)),
              );
              [username, password] = decodedToken.split(":");
            } catch (error) {
              ctx.code = 401;
              ctx.set(
                "WWW-Authenticate",
                `Basic realm=Jetpath API Doc`,
              );
              ctx.send(
                `<h1>401 Unauthorized</h1>`,
                "text/html",
              );
              return;
            }
            if (
              password === this.options?.apiDoc?.password &&
              username === this.options?.apiDoc?.username
            ) {
              ctx.send(UI, "text/html");
              return;
            } else {
              ctx.code = 401;
              ctx.set(
                "WWW-Authenticate",
                `Basic realm=Jetpath API Doc`,
              );
              ctx.send(
                `<h1>401 Unauthorized</h1>`,
                "text/html",
              );
              return;
            }
          } else {
            ctx.code = 401;
            ctx.set(
              "WWW-Authenticate",
              `Basic realm=Jetpath API Doc`,
            );
            ctx.send(
              `<h1>401 Unauthorized</h1>`,
              "text/html",
            );
            return;
          }
        } else {
          ctx.send(UI, "text/html");
          return;
        }
      });
      Log.LOG(
        `Compiled ${handlersCount} Functions\nTime: ${
          Math.round(
            endTime - startTime,
          )
        }ms`,
        "warn",
      );
      //? generate types
      if (/(ON|WARN)/.test(this.options?.strictMode || "OFF")) {
        await generateRouteTypes(
          this.options.source || ".",
          this.options.strictMode as "ON" | "WARN",
        );
      }
      Log.LOG(
        `APIs: Viewable at http://localhost:${this.options.port}${
          this.options?.apiDoc?.path || "/api-doc"
        }`,
        "info",
      );
    } else if (this.options?.apiDoc?.display === "HTTP") {
      //? generate types
      await generateRouteTypes(
        this.options.source || ".",
        this.options?.strictMode as "ON" | "WARN",
      );
      // ? render API in a .HTTP file
      await writeFile("api-doc.http", compiledAPI);
      Log.LOG(
        `Compiled ${handlersCount} Functions\nTime: ${
          Math.round(
            endTime - startTime,
          )
        }ms`,
        "info",
      );
      Log.LOG(
        `APIs: written to ${sep}api-doc.http`,
        "info",
      );
    }
    if (errorsCount) {
      for (let i = 0; i < errorsCount.length; i++) {
        Log.LOG(
          `\nReport: ${errorsCount[i].file} file was not loaded due to \n "${
            errorsCount[i].error
          }" error; \n please resolve!`,
          "warn",
        );
      }
    }

    this.server = server(this.plugs, this.options);
    //
    assignMiddleware(_JetPath_paths, _jet_middleware);
    // ? start server
    this.listening = true;
    this.server.listen(this.options.port);
    Log.LOG(`Open http://localhost:${this.options.port}`, "info");
    // ? show external IP
    const localIP = getLocalIP();
    if (localIP) {
      Log.LOG(`External: http://${localIP}:${this.options.port}`, "info");
    }
  }
}

//? exports
export type {
  JetContext,
  JetFile,
  JetMiddleware,
  JetRoute,
} from "./primitives/types.js";
export { JetMockServer, JetPlugin } from "./primitives/classes.js";
export { use } from "./primitives/functions.js";
export { mime } from "./extracts/mimejs-extract.js";
