// type imports
import { type IncomingMessage, type ServerResponse } from "node:http";
import type {
  compilerType,
  FileOptions,
  HTTPBody,
  JetMiddleware,
  jetOptions,
  JetRoute,
  methods,
  SchemaDefinition,
  ValidationOptions,
} from "./types.js";
import {
  ArraySchema,
  BooleanSchema,
  Context,
  DateSchema,
  FileSchema,
  JetPlugin,
  JetSocketInstance,
  LOG,
  NumberSchema,
  ObjectSchema,
  SchemaBuilder,
  SchemaCompiler,
  StringSchema,
} from "./classes.js";
import {
  _cloneJsonHeaders,
  ctxPool,
  isNode,
  MAX_POOL_SIZE,
  returnScratchCtx,
  runtime,
  Trie,
} from "./trie-router.js";
import { optionsCtx } from "./cors.js";
import { fs } from "./fs.js";
import { PluginBox } from "./plugins.js";

export const _JetPath_paths: Record<methods, Record<string, JetRoute>> = {
  GET: {},
  POST: {},
  HEAD: {},
  PUT: {},
  PATCH: {},
  DELETE: {},
  OPTIONS: {},
  CONNECT: {},
  TRACE: {},
};

export const _JetPath_paths_trie: Record<methods, Trie> = {
  GET: new Trie("GET"),
  POST: new Trie("POST"),
  HEAD: new Trie("HEAD"),
  PUT: new Trie("PUT"),
  PATCH: new Trie("PATCH"),
  DELETE: new Trie("DELETE"),
  OPTIONS: new Trie("OPTIONS"),
  TRACE: new Trie("TRACE"),
  CONNECT: new Trie("CONNECT"),
};

export const _jet_middleware: Record<
  string,
  | ((ctx: Context, err?: unknown) => void | Promise<void>)
  | ((ctx: Context, err?: unknown) => void | Promise<void>)[]
> = {};

// ? server
export const server = (
  plugs: JetPlugin[],
  options: jetOptions,
): { listen: any; edge: boolean } => {
  let server;
  let server_else;
  const runtimeConfig = options.runtimes;
  if (runtime["node"]) {
    server = fs().createServer(
      {
        keepAliveTimeout: options.keepAliveTimeout || 120_000,
        keepAlive: true,
      },
      (x: unknown, y: unknown) => {
        // @ts-expect-error to avoid the any error
        Jetpath(x, y);
      },
    );
  }
  if (runtime["deno"]) {
    server = {
      listen(port: number) {
        // @ts-expect-error to avoid the Deno keyword
        server_else = Deno.serve({ port: port }, JetpathBunDeno);
      },
      edge: false,
    };
  }
  if (runtime["cloudflare_worker"]) {
    server = {
      listen() {
        // Cloudflare Worker uses `addEventListener("fetch", ...)`
        addEventListener("fetch", (event: FetchEvent) => {
          event.respondWith(JetpathBunDeno(event.request, undefined));
        });
      },
      edge: true,
    };
  }
  if (runtime["aws_lambda"]) {
    server = {
      listen() {
        // AWS Lambda requires exporting a handler function
        // Use globalThis for ESM compatibility
        const awsHandler = async (event: any) => {
          const url = event.rawUrl ||
            `https://${event.requestContext?.domainName || "localhost"}${
              event.rawPath || "/"
            }`;
          const req = new Request(url, {
            method: event.requestContext?.http?.method || "GET",
            headers: event.headers,
            body: event.body,
          });
          const res = await JetpathBunDeno(req, undefined);
          const text = await res.text();
          return {
            statusCode: res.status,
            headers: Object.fromEntries(res.headers),
            body: text,
          };
        };
        (globalThis as any).__jetpath_handler = awsHandler;
        // Also try module.exports for CJS compatibility
        try {
          (module as any).exports.handler = awsHandler;
        } catch {
          // ESM environment — globalThis export is sufficient
        }
      },
      edge: true,
    };
  }
  if (runtime["bun"]) {
    const clusterEnabled = options.cluster?.enabled === true;
    const reusePort = clusterEnabled || runtimeConfig?.bun?.reusePort === true;
    if (options.upgrade && options.upgrade === true) {
      server = {
        listen(port: number) {
          server_else = Bun.serve({
            port,
            reusePort,
            fetch: JetpathBunDeno,
            websocket: {
              message(...p) {
                p[1] = {
                  // @ts-expect-error to avoid the type errorm ensuring we pass the opionated data prop.
                  data: p[1],
                };
                JetSocketInstance.__binder("message", p);
              },
              close(...p) {
                JetSocketInstance.__binder("close", p);
              },
              drain(...p) {
                JetSocketInstance.__binder("drain", p);
              },
              open(...p) {
                JetSocketInstance.__binder("open", p);
              },
            },
          });
        },
        edge: false,
      };
    } else {
      server = {
        listen(port: number) {
          server_else = Bun.serve({
            port,
            reusePort,
            fetch: JetpathBunDeno,
          });
        },
        edge: false,
      };
    }
  }

  // ? yes a plugin can bring it's own server? good for edge

  //? compile plugins
  for (let i = 0; i < plugs.length; i++) {
    const decs = plugs[i].setup({
      server: !runtime["node"] ? server_else! : server!,
      runtime: runtime as any,
      routesObject: _JetPath_paths,
      JetPath_app: Jetpath as any,
    });
    Object.assign(PluginBox.plugins, decs);
  }

  const edgePlugin = plugs.find((plug) => plug.plugin.server);
  LOG.log(
    `${plugs.length} plugins, ${edgePlugin ? "one" : "no"} edge plguin`,
    "info",
  );
  // ? adding ctx plugin bindings
  if (edgePlugin) {
    const edge_server = edgePlugin.plugin.server({
      server: !runtime["node"] ? server_else! : server!,
      runtime: runtime,
      routesObject: _JetPath_paths,
      handler: isNode ? Jetpath : JetpathBunDeno,
      router: _JetPath_paths,
    });
    if (edge_server !== undefined) {
      server = edge_server;
      server.edge = true;
    }
  }
  return server!;
};

let makeRes: (
  res: ServerResponse<IncomingMessage> & {
    req: IncomingMessage;
  },
  ctx: Context,
) => any;

const makeResBunAndDeno = (_res: any, ctx: Context) => {
  // ? Helper: build Headers with Set-Cookie support (RFC 6265 — separate headers)
  const buildHeaders = (base: Record<string, string>, cookies: string[]) => {
    if (!cookies.length) return base;
    const h = new Headers(base);
    for (const c of cookies) h.append("Set-Cookie", c);
    return h;
  };
  // ? fast path: normal response (most common — no stream, no custom response)
  if (ctx.payload !== undefined) {
    const body = ctx.payload;
    const code = ctx.code;
    const rawHeaders = ctx._10 ? _cloneJsonHeaders() : ctx._2;
    const headers = buildHeaders(rawHeaders, ctx._setCookies || []);
    if (ctxPool.length < MAX_POOL_SIZE) ctxPool.push(ctx);
    return new Response(body, { status: code, headers });
  }
  // ? streaming with ctx.sendStream
  if (ctx._3) {
    // handle deno promise.
    // @ts-expect-error to avoid .then error on stream type
    if (runtime["deno"] && ctx._3.then) {
      // @ts-expect-error same
      return ctx._3.then((stream: any) => {
        return new Response(stream?.readable, {
          status: ctx.code,
          headers: buildHeaders(ctx._2, ctx._setCookies || []),
        });
      });
    }
    const stream = ctx._3;
    const code = ctx.code;
    const headers = buildHeaders(ctx._2, ctx._setCookies || []);
    if (ctxPool.length < MAX_POOL_SIZE) ctxPool.push(ctx);
    return new Response(stream as unknown as undefined, {
      status: code,
      headers,
    });
  }
  if (ctx._6 !== false) {
    const customRes = ctx._6;
    if (ctxPool.length < MAX_POOL_SIZE) ctxPool.push(ctx);
    return customRes;
  }
  // ? fallback: empty response
  const code = ctx.code;
  const headers = buildHeaders(ctx._2, ctx._setCookies || []);
  if (ctxPool.length < MAX_POOL_SIZE) ctxPool.push(ctx);
  return new Response(undefined, { status: code, headers });
};
const makeResNode = (
  res: ServerResponse<IncomingMessage> & {
    req: IncomingMessage;
  },
  ctx: Context,
) => {
  if (ctx._3) {
    if (ctx._10) ctx._2["Content-Type"] = "application/json";
    // ? Write Set-Cookie headers individually (RFC 6265 — must not be comma-joined)
    if (ctx._setCookies?.length) {
      for (const cookie of ctx._setCookies) res.setHeader("Set-Cookie", cookie);
    }
    res.writeHead(ctx.code, ctx._2);
    const stream = ctx._3;
    let poolReturned = false;
    const returnToPool = () => {
      if (!poolReturned) {
        poolReturned = true;
        if (ctxPool.length < MAX_POOL_SIZE) ctxPool.push(ctx);
      }
    };
    const errorHandler = () => {
      res.statusCode = 400;
      res.end("not found");
      if (stream) {
        stream.removeAllListeners();
        if (typeof (stream as any).destroy === "function") {
          (stream as any).destroy();
        }
      }
      returnToPool();
    };
    stream.on("error", errorHandler);
    stream.pipe(res);
    stream.on("end", returnToPool);
    return undefined;
  }
  const code = ctx.code;
  // ? for Node, _10 means JSON — need to set Content-Type on _2 since writeHead uses it
  if (ctx._10) ctx._2["Content-Type"] = "application/json";
  const headers = ctx._2;
  const payload = ctx.payload;
  const setCookies = ctx._setCookies;
  if (ctxPool.length < MAX_POOL_SIZE) ctxPool.push(ctx);
  // ? Write Set-Cookie headers individually (RFC 6265 — must not be comma-joined)
  if (setCookies?.length) {
    for (const cookie of setCookies) res.setHeader("Set-Cookie", cookie);
  }
  res.writeHead(code, headers);
  res.end(payload);
  return undefined;
};

if (isNode) {
  makeRes = makeResNode;
} else {
  makeRes = makeResBunAndDeno;
}

// ? Bun/Deno: fully inlined handler — no indirection through makeRes variable
const JetpathBunDeno = (req: Request, res: unknown) => {
  if (req.method === 'OPTIONS') {
    optionsCtx.code = 200;
    return new Response(undefined, {
      status: 200,
      headers: optionsCtx._2 as Record<string, string>,
    });
  }

  const ctx = _JetPath_paths_trie[req.method as methods].get_responder_fast(
    req,
    res
  );
  if (ctx) {
    const r = ctx.handler!;
    // ? fast path: no middleware
    if (!r.jet_middleware?.length) {
      try {
        const result = r(ctx as any);
        // ? most routes are sync and return undefined — skip promise check
        if (
          result !== undefined &&
          typeof (result as any).then === 'function'
        ) {
          return (result as Promise<any>).then(
            () => {
              const body = ctx.payload;
              const code = ctx.code;
              const headers = ctx._10 ? _cloneJsonHeaders() : ctx._2;
              returnScratchCtx(ctx);
              return new Response(body, { status: code, headers });
            },
            (error: unknown) => {
              console.log(error);
              if (ctx.code < 400) ctx.code = 500;
              const code = ctx.code;
              const headers = ctx._2;
              returnScratchCtx(ctx);
              return new Response(undefined, { status: code, headers });
            }
          );
        }
        // ? inline makeRes for sync path — hottest path in benchmarks
        if (ctx.payload !== undefined) {
          const body = ctx.payload;
          const code = ctx.code;
          // ? _10 = true means JSON response (send() skipped _2 mutation)
          // ? use pre-baked JSON headers to avoid per-request object allocation + mutation
          const headers = ctx._10 ? _cloneJsonHeaders() : ctx._2;
          returnScratchCtx(ctx);
          return new Response(body, { status: code, headers });
        }
        if (ctx._3) {
          const stream = ctx._3;
          const code = ctx.code;
          const headers = ctx._2;
          returnScratchCtx(ctx);
          return new Response(stream as unknown as undefined, {
            status: code,
            headers,
          });
        }
        if (ctx._6 !== false) {
          const customRes = ctx._6;
          returnScratchCtx(ctx);
          return customRes as unknown as Response;
        }
        const code = ctx.code;
        const headers = ctx._2;
        returnScratchCtx(ctx);
        return new Response(undefined, { status: code, headers });
      } catch (error) {
        console.log(error);
        if (ctx.code < 400) ctx.code = 500;
        const code = ctx.code;
        const headers = ctx._2;
        returnScratchCtx(ctx);
        return new Response(undefined, { status: code, headers });
      }
    }
    // ? slow path: has middleware
    return _runWithMiddleware(r, ctx, undefined);
  }
  return new Response(undefined, {
    status: 404,
    headers: optionsCtx._2 as Record<string, string>,
  });
};

const Jetpath = (
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage> & {
    req: IncomingMessage;
  },
) => {
  if (req.method === "OPTIONS") {
    optionsCtx.code = 200;
    return makeRes(res, optionsCtx as unknown as Context);
  }

  const ctx = _JetPath_paths_trie[req.method as methods].get_responder(
    req,
    res,
  );
  if (ctx) {
    const r = ctx.handler!;
    // ? fast path: no middleware
    if (!r.jet_middleware?.length) {
      try {
        const result = r(ctx as any);
        // ? most routes are sync and return undefined — skip promise check
        if (
          result !== undefined &&
          typeof (result as any).then === "function"
        ) {
          return (result as Promise<any>).then(
            () => makeRes(res, ctx),
            (error: unknown) => {
              console.log(error);
              if (ctx.code < 400) ctx.code = 500;
              return makeRes(res, ctx);
            },
          );
        }
        return makeRes(res, ctx);
      } catch (error) {
        console.log(error);
        if (ctx.code < 400) ctx.code = 500;
        return makeRes(res, ctx);
      }
    }
    // ? slow path: has middleware
    return _runWithMiddleware(r, ctx, res);
  }
  const notFoundCtx = { ...optionsCtx, code: 404 };
  return makeRes(res, notFoundCtx as unknown as Context);
};

const _runWithMiddleware = async (r: any, ctx: Context, res: any) => {
  const returned: ((ctx: any, error?: unknown) => void | Promise<void>)[] = [];
  try {
    for (let m = 0; m < r.jet_middleware.length; m++) {
      const callback = await r.jet_middleware[m](ctx as any);
      if (typeof callback === "function") {
        returned.unshift(callback);
      }
    }
    if (ctx.payload) return makeRes(res, ctx);
    await r(ctx as any);
    for (let i = 0; i < returned.length; i++) {
      await returned[i](ctx);
    }
    return makeRes(res, ctx);
  } catch (error) {
    try {
      if (returned.length) {
        for (let i = 0; i < returned.length; i++) {
          await returned[i](ctx, error);
        }
      } else {
        console.log(error);
      }
    } catch (error) {
      console.log(error);
    } finally {
      if (!returned.length && ctx.code < 400) {
        ctx.code = 500;
      }
      return makeRes(res, ctx);
    }
  }
};

const handlersPath = (path: string) => {
  path = path.replaceAll("__", "-"); // ? convert __ to -
  const [method, ...segments] = path.split("_");
  let route = "/" + segments.join("/");
  // eslint-disable-next-line no-useless-escape
  route = route
    .replace(/\$0/g, "/*") // Convert wildcard
    .replace(/\$/g, "/:") // Convert params
    .replaceAll(/\/\//g, "/"); // change normalize akk extra /(s) to just /
  return /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|MIDDLEWARE|HEAD|CONNECT|TRACE)$/
      .test(
        method,
      )
    ? ([method, route] as [string, string])
    : undefined;
};

const getModule = async (src: string, name: string) => {
  const absolutePath = fs().resolve(src + "/" + name); //? Gets native OS path
  try {
    const fileUrl = fs().pathToFileURL(absolutePath).href;
    const mod = await import(fileUrl);
    return mod;
  } catch (error) {
    LOG.log("Error at " + absolutePath + " loading failed!", "info");
    LOG.log(String(error), "error");
    return String(error);
  }
};

export async function getHandlers(
  source: string,
  print: boolean,
  errorsCount: { file: string; error: string }[] | undefined = undefined,
  again = false,
) {
  const curr_d = fs().cwd();
  const error_source = source;
  source = source || "";
  if (!again) {
    source = fs().resolve(fs().join(curr_d, source));
    if (!source.includes(curr_d)) {
      LOG.log('source: "' + error_source + '" is invalid', "warn");
      LOG.log("Jetpath source must be within the project directory", "error");
      process.exit(1);
    }
  } else {
    source = fs().resolve(curr_d, source);
  }
  const dir = await fs().opendir(source);
  for await (const dirent of dir) {
    if (
      dirent.isFile() &&
      (dirent.name.endsWith(".jet.js") || dirent.name.endsWith(".jet.ts"))
    ) {
      if (print) {
        LOG.log(
          "Loading " +
            source.replace(curr_d + "/", "") +
            fs().sep +
            dirent.name,
          "info",
        );
      }
      try {
        const module = await getModule(source, dirent.name);
        if (typeof module !== "string") {
          for (const p in module) {
            const params = handlersPath(p);
            if (params) {
              if (p.startsWith("MIDDLEWARE")) {
                _jet_middleware[params[1]] = module[p];
              } else {
                // ! HTTP handler
                if (typeof params !== "string") {
                  try {
                    // ? set the method
                    module[p]!.method = params[0];
                    // ? set the path
                    module[p]!.path = params[1];
                    // Insert into Trie - it will decide whether to store in hashmap or Trie
                    _JetPath_paths_trie[params[0] as methods].insert(
                      params[1],
                      module[p] as JetRoute,
                    );
                    // Also store in _JetPath_paths for backward compatibility and middleware assignment
                    _JetPath_paths[params[0] as methods][params[1]] = module[
                      p
                    ] as JetRoute;
                  } catch (routeError) {
                    // ? Per-route error isolation: one bad route doesn't kill the whole file
                    if (!errorsCount) {
                      errorsCount = [];
                    }
                    errorsCount.push({
                      file: source.replace(curr_d + "/", "") +
                        fs().sep +
                        dirent.name,
                      error: String(routeError),
                    });
                  }
                }
              }
            }
          }
        } else {
          // record errors
          if (!errorsCount) {
            errorsCount = [];
          }
          errorsCount.push({
            file: dirent.path + "/" + dirent.name,
            error: module,
          });
        }
      } catch (error) {
        if (!errorsCount) {
          errorsCount = [];
        }
        errorsCount.push({
          file: dirent.path + "/" + dirent.name,
          error: String(error),
        });
      }
    }
    if (
      dirent.isDirectory() &&
      dirent.name !== "node_modules" &&
      dirent.name !== ".git"
    ) {
      errorsCount = await getHandlers(
        source + "/" + dirent.name,
        print,
        errorsCount,
        true,
      );
    }
  }
  return errorsCount;
}

export async function getHandlersEdge(modules: JetRoute[] & JetMiddleware[]) {
  for (const p in modules) {
    const params = handlersPath(p);
    if (params) {
      if (p.startsWith("MIDDLEWARE")) {
        _jet_middleware[params[1]] = modules[p] as any;
      } else {
        // ! HTTP handler
        if (typeof params !== "string") {
          try {
            // ? set the method
            modules[p]!.method = params[0];
            // ? set the path
            modules[p]!.path = params[1];
            // Insert into Trie - it will decide whether to store in hashmap or Trie
            _JetPath_paths_trie[params[0] as methods].insert(
              params[1],
              modules[p] as JetRoute,
            );
            // Also store in _JetPath_paths for backward compatibility and middleware assignment
            _JetPath_paths[params[0] as methods][params[1]] = modules[
              p
            ] as JetRoute;
          } catch (routeError) {
            LOG.log(
              `Route ${params[0]} ${params[1]} skipped: ${String(routeError)}`,
              "warn",
            );
          }
        }
      }
    }
  }
}

const shiftColor = (hex: string, part: 'red' | 'green' | 'blue', inc = 60) => {
  const i = { red: 1, green: 3, blue: 5 }[part] || 3;
  const val = Math.min(
    255,
    Math.max(0, parseInt(hex.substring(i, i + 2), 16) + inc)
  )
    .toString(16)
    .padStart(2, '0');
  return hex.substring(0, i) + val + hex.substring(i + 2);
};

export const compileUI = (UI: string, options: jetOptions, api: string) => {
  // ? global headers
  const globalHeaders = JSON.stringify(
    options?.globalHeaders || {
      Authorization: "Bearer <jwt token>",
    },
  );
  const apiCOnfig = options?.apiDoc;
  const color = apiCOnfig?.color?.trim() || "#4285f4";
  return UI.replace("{ JETPATH }", api)
    .replaceAll(
      "{ JETENVIRONMENTS }",
      JSON.stringify(options?.apiDoc?.environments || {}),
    )
    .replaceAll("{ JETPATHGH }", globalHeaders)
    .replaceAll("{NAME}", apiCOnfig?.name?.trim() || "Jetpath API Doc")
    .replaceAll("JETPATHCOLORRED", shiftColor(color, "red"))
    .replaceAll("JETPATHCOLORGREEN", shiftColor(color, "green"))
    .replaceAll("JETPATHCOLORBLUE", shiftColor(color, "blue"))
    .replaceAll("JETPATHCOLOR", color)
    .replaceAll(
      "{LOGO}",
      options?.apiDoc?.logo?.trim() ||
        "https://raw.githubusercontent.com/codedynasty-dev/jetpath/main/icon-transparent.png",
    )
    .replaceAll(
      "{INFO}",
      options?.apiDoc?.info?.replaceAll("\n", "<br>") ||
        "This is a Jetpath api preview.",
    );
};

export const compileAPI = (options: jetOptions): [number, string] => {
  let handlersCount = 0;
  const compiledAPIArray: string[] = [];
  const compiledRoutes: string[] = [];
  // ? global headers
  const globalHeaders = options?.globalHeaders || {};
  // ? loop through apis
  for (const method in _JetPath_paths) {
    // ? get all api paths from router for each method;
    const routesOfMethod: JetRoute[] = Object.keys(
      _JetPath_paths[method as methods],
    )
      .map((value) => _JetPath_paths[method as methods][value])
      .filter((value) => value.length > 0);

    if (routesOfMethod && Object.keys(routesOfMethod).length) {
      for (const route of routesOfMethod) {
        // ? Retrieve api handler
        const validator = route;
        // ? Retrieve api body definitions
        const body = validator.body;
        // ? Retrieve api headers definitions
        const initialHeader = {};
        Object.assign(initialHeader, validator?.headers || {}, globalHeaders);
        const headers = [];
        // ? parse headers
        for (const name in initialHeader) {
          headers.push(
            name + ":" + initialHeader[name as keyof typeof initialHeader],
          );
        }
        // ? parse body
        let bodyData: Record<string, any> | undefined = undefined;
        if (body) {
          bodyData = {};
          const processSchema = (schema: any, target: any) => {
            for (const key in schema) {
              const field = schema[key];
              if (field.type === "object" && field.objectSchema) {
                target[key] = {};
                processSchema(field.objectSchema, target[key]);
              } else if (field.type === "array") {
                if (field.arrayType === "object" && field.objectSchema) {
                  target[key] = [{}];
                  processSchema(field.objectSchema, target[key][0]);
                } else {
                  target[key] = [
                    field.arrayType + ":" + (field.arrayDefaultValue || ""),
                  ];
                }
              } else {
                target[key] = field?.inputType + ":" +
                  (field?.inputDefaultValue || "");
              }
            }
          };
          processSchema(body, bodyData);
        }
        // ? combine api infos into .http format
        const api = `\n
${method} ${
          options?.apiDoc?.display === "UI"
            ? "[--host--]"
            : "http://localhost:" + (options?.port || 8080)
        }${route.path} HTTP/1.1
${headers.length ? headers.join("\n") : ""}\n
${body ? JSON.stringify(bodyData) : ""}\n\n${
          validator?.["title"]
            ? "#-JET-TITLE " +
              validator?.["title"].replaceAll("\n", "\n# ") +
              "#-JET-TITLE"
            : ""
        }\n${
          validator?.["description"]
            ? "#-JET-DESCRIPTION\n# " +
              validator?.["description"].replaceAll("\n", "\n# ") +
              "\n#-JET-DESCRIPTION"
            : ""
        }\n
### break ###`;

        // console.log(bodyData);
        // ? combine api(s)
        const low = sorted_insert(compiledRoutes, route.path!);
        compiledRoutes.splice(low, 0, route.path!);
        compiledAPIArray.splice(low, 0, api);
        // ? increment handler count
        handlersCount += 1;
      }
    }
  }
  // sort and join here

  const compileAPIString = compiledAPIArray.join("");
  return [handlersCount, compileAPIString];
};

const sorted_insert = (paths: string[], path: string): number => {
  let low = 0;
  let high = paths.length - 1;
  for (; low <= high;) {
    const mid = Math.floor((low + high) / 2);
    const current = paths[mid];
    if (current < path) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return low;
};

/**
 * Assigns middleware functions to routes while ensuring that each route gets exactly one middleware function.
 * A middleware function can be shared across multiple routes.
 *
 * @param _JetPath_paths - An object mapping HTTP methods to route-handler maps.
 * @param _jet_middleware - An object mapping route paths to an array of middleware functions.
 */
export function assignMiddleware(
  _JetPath_paths: { [method: string]: { [route: string]: any } },
  _jet_middleware: {
    [route: string]:
      | ((
        ctx: any,
        // next: () => Promise<void>,
      ) => Promise<void> | void)
      | ((
        ctx: any,
        // next: () => Promise<void>,
      ) => Promise<void> | void)[];
  },
): void {
  // Iterate over each HTTP method's routes.
  for (const method in _JetPath_paths) {
    const routes: JetRoute[] = Object.keys(_JetPath_paths[method as methods])
      .map((value) => _JetPath_paths[method as methods][value])
      .filter((value) => value.length > 0);

    for (let route of routes) {
      if (!Array.isArray(route.jet_middleware)) {
        route.jet_middleware = [];
      } else {
        route = (...c) => route(...c);
        route.jet_middleware = [];
      }
    }

    for (const route of routes) {
      // If middleware is defined for the route, ensure it has exactly one middleware function.
      const allMiddlewaresSorted = Object.keys(_jet_middleware)
        .filter((m) => route.path!.startsWith(m))
        .sort((a, b) => a.length - b.length);
      for (const key of allMiddlewaresSorted) {
        const middleware = _jet_middleware[key];
        // Assign the middleware function to the route handler.
        if (Array.isArray(middleware)) {
          route.jet_middleware!.push(...middleware.flat());
        } else {
          route.jet_middleware!.push(middleware as any);
        }
      }
    }
    //
  }
}

export const v = {
  string: (options?: ValidationOptions) => new StringSchema(options),
  number: (options?: ValidationOptions) => new NumberSchema(options),
  boolean: () => new BooleanSchema(),
  array: (itemType?: SchemaBuilder) => new ArraySchema(itemType),
  object: (shape?: Record<string, SchemaBuilder>) => new ObjectSchema(shape),
  date: () => new DateSchema(),
  file: (options?: FileOptions) => new FileSchema(options),
};

function createSchema<T extends Record<string, any>>(
  schemaDefinition: (t: typeof v) => Record<string, SchemaBuilder>,
): HTTPBody<T> {
  const rawSchema = schemaDefinition(v);
  return SchemaCompiler.compile(rawSchema);
}

/**
 * Configures the endpoint with API documentation and validation
 * @param endpoint - The endpoint function to configure
 * @returns The current compiler object
 */
export function use<
  JetData extends {
    body?: Record<string, any>;
    params?: Record<string, any>;
    query?: Record<string, any>;
    response?: Record<string, any>;
  },
  JetPluginTypes extends Record<string, unknown>[] = [],
>(
  endpoint: JetRoute<JetData, JetPluginTypes>,
): compilerType<JetData, JetPluginTypes> {
  const compiler = {
    /**
     * Sets the API documentation body for the endpoint
     */
    body: function (
      schemaFn: (
        t: typeof v,
      ) => Partial<
        Record<keyof HTTPBody<NonNullable<JetData["body"]>>, SchemaBuilder>
      >,
    ) {
      endpoint.body = createSchema(schemaFn as any) as any;
      return compiler;
    },
    /**
     * Sets the API documentation body for the endpoint
     */
    response: function (
      schemaFn: (
        t: typeof v,
      ) => Partial<
        Record<keyof HTTPBody<NonNullable<JetData["response"]>>, SchemaBuilder>
      >,
    ) {
      endpoint.response = createSchema(schemaFn as any) as any;
      return compiler;
    },
    /**
     * Sets the API documentation headers for the endpoint
     * @param {Object} headers - The API documentation headers
     */
    headers: function (headers: Record<string, string>) {
      if (typeof endpoint !== "function") {
        throw new Error("Endpoint must be a function");
      }
      endpoint.headers = headers;
      return compiler;
    },
    /**
     * Sets the API documentation title for the endpoint
     * @param {string} title - The API documentation title
     */
    title: function (title: string) {
      if (typeof endpoint !== "function") {
        throw new Error("Endpoint must be a function");
      }
      endpoint.title = title;
      return compiler;
    },
    /**
     * Sets the API documentation description for the endpoint
     * @param {string} description - The API documentation description
     */
    description: function (description: string) {
      if (typeof endpoint !== "function") {
        throw new Error("Endpoint must be a function");
      }
      endpoint.description = description;
      return compiler;
    },
    /**
     * Sets the API documentation params for the endpoint
     */
    params: function (
      schemaFn: (
        t: typeof v,
      ) => Partial<
        Record<keyof HTTPBody<NonNullable<JetData["params"]>>, SchemaBuilder>
      >,
    ) {
      if (typeof endpoint !== "function") {
        throw new Error("Endpoint must be a function");
      }
      endpoint.params = createSchema(schemaFn as any) as any;
      return compiler;
    },

    query: function (
      schemaFn: (
        t: typeof v,
      ) => Partial<
        Record<keyof HTTPBody<NonNullable<JetData["query"]>>, SchemaBuilder>
      >,
    ) {
      if (typeof endpoint !== "function") {
        throw new Error("Endpoint must be a function");
      }
      endpoint.query = createSchema(schemaFn as any) as any;
      return compiler;
    },
  };
  return compiler;
}

//? needs to optimized, does exactly the same as the getModule function
export async function codeGen(
  ROUTES_DIR: string,
  mode: "ON" | "WARN",
  connectionLinks: { local: string; external: string },
  generatedRoutesFilePath?: string,
) {
  //? Regex to find exported const variables
  // ? let's make sure if this line is a comments then it should not be matched!
  const ROUTE_EXPORT_REGEX =
    /^(?!\s*\/\/)export\s+const\s+((?:GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|MIDDLEWARE)_[a-zA-Z0-9$]*\$?[a-zA-Z0-9$_]*)\s*/gm;
  //? let's make sure if this line is a comments then it should not be matched!
  const METHOD_PATH_REGEX =
    /(?:GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|MIDDLEWARE)_[a-zA-Z0-9$_]*$/;
  const OUTPUT_FILE = fs().resolve(
    fs().join(fs().cwd(), "node_modules", "@jetpath", "index.ts"),
  );
  const ROUTE_FILE = fs().resolve(
    generatedRoutesFilePath
      ? generatedRoutesFilePath
      : fs().join(fs().cwd(), "definitions.ts"),
  );

  fs().mkdirSync(fs().dirname(OUTPUT_FILE), { recursive: true });
  const declarations: string[] = [];

  let mIdex = 0;
  async function walkDir(currentDir: string) {
    try {
      const entries = await fs().readdir(currentDir, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        const fullPath = fs().join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (!entry.name.startsWith(".")) {
            await walkDir(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith(".jet.ts")) {
          try {
            const fileContent = await fs().readFile(fullPath, "utf-8");
            const foundExports = [];
            let match;

            while ((match = ROUTE_EXPORT_REGEX.exec(fileContent)) !== null) {
              const exportName = match[1];
              if (METHOD_PATH_REGEX.test(exportName)) {
                foundExports.push(exportName);
              } else {
                LOG.log(
                  ` ${exportName} is not a valid JetRoute export`,
                  "error",
                );
              }
            }

            if (foundExports.length > 0) {
              const moduleName = "m" + mIdex; // only alphanumeric letters;
              //? Generate the declare module block for this file
              let moduleDeclaration =
                `import * as ${moduleName} from '${fullPath}';\n\n\n`;
              //? Add declarations for each found route export
              for (const exportName of foundExports) {
                //? Declare the export with the basic JetRoute<any, any> type
                if (exportName.startsWith("MIDDLEWARE_")) {
                  moduleDeclaration +=
                    `const ${exportName} = ${moduleName}.${exportName} satisfies JetMiddleware<any, any>\n\n `;
                } else {
                  moduleDeclaration +=
                    `const ${exportName} = ${moduleName}.${exportName} satisfies JetRoute<any, any>\n\n `;
                }
              }
              declarations.push(moduleDeclaration);
            }
          } catch (error) {
            console.error(
              `Error reading or parsing file ${fullPath}: ${error}`,
            );
          }
        }
        mIdex++;
      }
    } catch (error) {
      console.error(`Error reading directory ${currentDir}: ${error}`);
    }
  }
  if (mode === "ON") {
    await walkDir(fs().resolve(fs().cwd(), ROUTES_DIR));
  } else {
    await walkDir(fs().resolve(fs().cwd(), ROUTES_DIR));
  }
  const compileObjectStructureFromSchema = (schema: SchemaDefinition) => {
    const obj: Record<string, "string" | Record<string, "string">> = {};
    if (schema.type === "object") {
      for (const key in schema.objectSchema) {
        obj[key] = "string";
        if (schema.objectSchema[key].type === "object") {
          obj[key] = compileObjectStructureFromSchema(
            schema.objectSchema[key] as SchemaDefinition,
          ) as Record<string, "string">;
        }
      }
      return obj;
    }
    const arrayObj: any[] = [];
    if (schema.type === "array") {
      if (schema.arrayType === "object") {
        const obj: Record<string, "string"> = {};
        for (const key in schema.objectSchema) {
          obj[key] = "string";
        }
        arrayObj.push(obj);
      } else {
        arrayObj.push(schema.arrayType);
      }
      return arrayObj;
    }
    return schema.type;
  };
  //? Generate the final .d.ts file content
  let outputContent =
    "//? This file is auto-generated by Jetpath. DO NOT MODIFY!\n\n";
  outputContent +=
    "// @ts-ignore\nimport { type JetRoute, JetMiddleware } from 'jetpath';\n\n";
  if (typeof generatedRoutesFilePath === "string") {
    LOG.log("Generating routes file", "info");
    const connectionInfo = `export const connectionInfo = {
    local: '${connectionLinks.local}',
    external: '${connectionLinks.external}'
};`;
    const outputContent =
      `//This file is autogenerated by Jetpath\n\n${connectionInfo}\n\nexport const routes = {\n ${
        Object.keys(
          _JetPath_paths,
        )
          .reduce((acc: string[], method) => {
            const routes = Object.keys(_JetPath_paths[method as methods]);
            const obj = _JetPath_paths[method as methods];

            if (routes.length > 0) {
              for (const route of routes) {
                let body: Record<string, "string"> | undefined;
                let response: Record<string, "string"> | undefined;
                let params: Record<string, "string"> | undefined;
                let query: Record<string, "string"> | undefined;
                if (obj[route].body) {
                  for (const key in obj[route].body) {
                    if (!body) {
                      body = {};
                    }
                    const type = obj[route].body[key].type;
                    const val = type === "string"
                      ? "string"
                      : type === "number"
                      ? 1
                      : type === "boolean"
                      ? true
                      : type === "object"
                      ? compileObjectStructureFromSchema(
                        obj[route].body[key] as SchemaDefinition,
                      )
                      : type === "array"
                      ? compileObjectStructureFromSchema(
                        obj[route].body[key] as SchemaDefinition,
                      )
                      : type === "file"
                      ? "file"
                      : type;
                    body[key] = val as "string";
                  }
                }
                if (obj[route].query) {
                  for (const key in obj[route].query) {
                    if (!query) {
                      query = {};
                    }
                    const type = obj[route].query[key].type;
                    const val = type === "string"
                      ? "string"
                      : type === "number"
                      ? 1
                      : type === "boolean"
                      ? true
                      : type === "object"
                      ? compileObjectStructureFromSchema(
                        obj[route].query[key] as SchemaDefinition,
                      )
                      : type === "array"
                      ? compileObjectStructureFromSchema(
                        obj[route].query[key] as SchemaDefinition,
                      )
                      : type;
                    query[key] = val as "string";
                  }
                }
                if (obj[route].response) {
                  for (const key in obj[route].response) {
                    if (!response) {
                      response = {};
                    }
                    const type = obj[route].response[key].type;
                    const val = type === "string"
                      ? "string"
                      : type === "number"
                      ? 1
                      : type === "boolean"
                      ? true
                      : type === "object"
                      ? compileObjectStructureFromSchema(
                        obj[route].response[key] as SchemaDefinition,
                      )
                      : type === "array"
                      ? compileObjectStructureFromSchema(
                        obj[route].response[key] as SchemaDefinition,
                      )
                      : type === "file"
                      ? "file"
                      : type;
                    response[key] = val as "string";
                  }
                }
                if (obj[route].params) {
                  for (const key in obj[route].params) {
                    if (!params) {
                      params = {};
                    }
                    params[key] = "string";
                  }
                }
                acc.push(
                  `${
                    obj[route].name
                  }: {\n    path: "${route}",\n    method: "${method.toLowerCase()}",\n${
                    body ? `    body: ${JSON.stringify(body || {})},\n` : ""
                  }${
                    response
                      ? `    response: ${JSON.stringify(response || {})},\n`
                      : ""
                  }${
                    query ? `    query: ${JSON.stringify(query || {})},\n` : ""
                  }    title: "${obj[route].title || ""}",\n${
                    params
                      ? `    params: ${JSON.stringify(params || {})},\n`
                      : ""
                  }}`,
                );
              }
            }
            return acc;
          }, [])
          .join(",\n ")
      } \n} as const;\n\n`;
    try {
      await fs().writeFile(ROUTE_FILE, outputContent, "utf-8");
      LOG.log("Generated routes file successfully: " + ROUTE_FILE, "success");
    } catch (error) {
      LOG.log(
        `Error writing routes file ${generatedRoutesFilePath} ${String(error).split(',')[0]}`,
        'warn'
      );
    }
  }
  //? Add all the generated module declarations
  outputContent += declarations.join("\n");

  try {
    LOG.log("⚙️  StrictMode...\nmode: " + mode, "info");
    await fs().writeFile(OUTPUT_FILE, outputContent, "utf-8");

    const promisifiedExecFile = () =>
      new Promise((resolve) => {
        fs().execFile(
          "tsc",
          [
            "--noEmit",
            "--target",
            "ESNext",
            "--module",
            "NodeNext",
            "--moduleResolution",
            "NodeNext",
            "--lib",
            "ESNext,DOM",
            "--strict",
            "--esModuleInterop",
            "--allowImportingTsExtensions",
            "--skipLibCheck",
            OUTPUT_FILE,
          ],
          { encoding: "utf8" },
          (err, stdout, stderr) => {
            if (err) {
              if (err.toString().includes("Executable not found")) {
                LOG.log(
                  "\n🛠️ StrictMode Can't work: Please install typescript using \n'npm install -g typescript' or \n'yarn global add typescript'\n\n",
                  "error",
                );
              }
              LOG.log("\n🛠️ StrictMode warnings", "warn");
              if (typeof stderr === "string") {
                LOG.log(
                  stderr.replaceAll("\n", "\n\n"),
                  mode === "WARN" ? "warn" : "error",
                );
              }
              if (typeof stdout === "string") {
                LOG.log(
                  stdout.replaceAll("\n", "\n\n"),
                  mode === "WARN" ? "warn" : "error",
                );
                const errors = (stdout?.split("\n") || []).length - 1;
                LOG.log(
                  errors +
                    ` Problem${
                      errors === 1 ? "" : "s"
                    } 🐞\n\nYou are seeing these warnings because you have strict mode enabled\n`,
                  "info",
                );
              }
            }
            resolve(undefined);
          },
        );
      });
    await promisifiedExecFile();
  } catch (error) {
    LOG.log(`Error writing output file apis-types.d.ts: ${error}`, "error");
  }
}

export function getLocalIP() {
  const interfaces: Record<string, any> = fs().networkInterfaces() || [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if ("IPv4" !== iface.family || iface.internal !== false) {
        continue;
      }
      return iface.address;
    }
  }
}
