// type imports
import { type IncomingMessage, type ServerResponse } from 'node:http';
import type {
  allowedMethods,
  compilerType,
  FileOptions,
  HTTPBody,
  JetMiddleware,
  jetOptions,
  JetRoute,
  methods,
  SchemaDefinition,
  ValidationOptions,
} from './types.js';
import {
  ArraySchema,
  BooleanSchema,
  Context,
  DateSchema,
  FileSchema,
  JetPlugin,
  JetSocket,
  LOG,
  NumberSchema,
  ObjectSchema,
  SchemaBuilder,
  SchemaCompiler,
  StringSchema,
  Trie,
} from './classes.js';

/**
 * an inbuilt CORS post middleware
 *    @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer/Planned_changes
 *  - {Boolean} privateNetworkAccess handle `Access-Control-Request-Private-Network` request by return `Access-Control-Allow-Private-Network`, default to false
 *    @see https://wicg.github.io/private-network-access/
 */

const optionsCtx = {
  payload: undefined,
  _2: {
    Vary: 'Origin',
    Connection: 'keep-alive',
  },
  _6: false,
  code: 204,
  set(field: string, value: string) {
    if (field && value) {
      (this._2 as Record<string, string>)[field] = value;
    }
  },
  request: { method: 'OPTIONS' },
};
const cachedCorsHeaders: Record<string, string> = {
  Vary: 'Origin',
  Connection: 'keep-alive',
};
export function corsMiddleware(options: {
  exposeHeaders?: string[];
  allowMethods?: allowedMethods;
  allowHeaders?: string[];
  keepHeadersOnError?: boolean;
  maxAge?: string;
  credentials?: boolean;
  secureContext?: {
    'Cross-Origin-Opener-Policy':
      | 'same-origin'
      | 'unsafe-none'
      | 'same-origin-allow-popups';
    'Cross-Origin-Embedder-Policy': 'require-corp' | 'unsafe-none';
  };
  privateNetworkAccess?: any;
  origin?: string[];
}) {
  //
  options.keepHeadersOnError =
    options.keepHeadersOnError === undefined || !!options.keepHeadersOnError;
  //?  pre populate context for Preflight Request
  if (options.maxAge) {
    optionsCtx.set('Access-Control-Max-Age', options.maxAge);
  }
  if (!options.privateNetworkAccess) {
    if (options.allowMethods) {
      optionsCtx.set(
        'Access-Control-Allow-Methods',
        options.allowMethods.join(',')
      );
    }
    if (options.secureContext) {
      optionsCtx.set(
        'Cross-Origin-Opener-Policy',
        options.secureContext['Cross-Origin-Embedder-Policy'] || 'unsafe-none'
      );
      optionsCtx.set(
        'Cross-Origin-Embedder-Policy',
        options.secureContext['Cross-Origin-Embedder-Policy'] || 'unsafe-none'
      );
    }
    if (options.allowHeaders) {
      optionsCtx.set(
        'Access-Control-Allow-Headers',
        options.allowHeaders.join(',')
      );
    }
  }
  optionsCtx.set('Vary', 'Origin');
  if (options.credentials === true) {
    optionsCtx.set('Access-Control-Allow-Credentials', 'true');
  }
  if (Array.isArray(options.origin)) {
    optionsCtx.set('Access-Control-Allow-Origin', options.origin.join(','));
  }
  // ? Pre-popular normal response headers.
  //? Add Vary header to indicate response varies based on the Origin header
  cachedCorsHeaders['Vary'] = 'Origin';
  if (options.credentials === true) {
    cachedCorsHeaders['Access-Control-Allow-Credentials'] = 'true';
  }
  if (Array.isArray(options.origin)) {
    cachedCorsHeaders['Access-Control-Allow-Origin'] = options.origin.join(',');
  }
  if (options.secureContext) {
    cachedCorsHeaders['Cross-Origin-Opener-Policy'] =
      options.secureContext['Cross-Origin-Embedder-Policy'];
    cachedCorsHeaders['Cross-Origin-Embedder-Policy'] =
      options.secureContext['Cross-Origin-Embedder-Policy'];
  }
}

export const JetSocketInstance = new JetSocket();

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
  GET: new Trie('GET'),
  POST: new Trie('POST'),
  HEAD: new Trie('HEAD'),
  PUT: new Trie('PUT'),
  PATCH: new Trie('PATCH'),
  DELETE: new Trie('DELETE'),
  OPTIONS: new Trie('OPTIONS'),
  TRACE: new Trie('TRACE'),
  CONNECT: new Trie('CONNECT'),
};

export const _jet_middleware: Record<
  string,
  | ((ctx: Context, err?: unknown) => void | Promise<void>)
  | ((ctx: Context, err?: unknown) => void | Promise<void>)[]
> = {};

export const ctxPool: Context[] = [];
export let runtime: Record<
  'bun' | 'deno' | 'node' | 'edge' | 'cloudflare_worker' | 'aws_lambda',
  boolean
> = {
  bun: false,
  deno: false,
  node: false,
  edge: false,
  cloudflare_worker: false,
  aws_lambda: false,
};
const plugins: Record<string, Function> = {};

export function abstractPluginCreator(ctx: Context) {
  const abstractPlugin: Record<string, Function> = {};
  for (const key in plugins) {
    abstractPlugin[key] = plugins[key].bind(ctx);
  }
  return abstractPlugin;
}

const ae = (cb: { (): any; (): any; (): void }) => {
  try {
    cb();
    return true;
  } catch (error) {
    return false;
  }
};

(() => {
  //? check for bun runtime
  const bun = ae(() => Bun);
  //? check for deno runtime
  // @ts-expect-error
  const deno = ae(() => Deno);
  let cloudflare_worker = false;
  let aws_lambda = false;
  //? check if running in Cloudflare Worker
  if (
    typeof (globalThis as any).WebSocketPair !== 'undefined' &&
    typeof (globalThis as any).caches !== 'undefined' &&
    typeof (globalThis as any).Response !== 'undefined'
  ) {
    cloudflare_worker = true;
  }
  // AWS Lambda
  if (
    typeof process !== 'undefined' &&
    process.env?.['AWS_LAMBDA_FUNCTION_NAME']
  ) {
    aws_lambda = true;
  }
  runtime = {
    bun,
    deno,
    node: !bun && !deno,
    aws_lambda,
    cloudflare_worker,
    edge: cloudflare_worker || aws_lambda,
  };
})();

// ? isNode
export const isNode = runtime['node'];
// ? server
export const server = (
  plugs: JetPlugin[],
  options: jetOptions
): { listen: any; edge: boolean } => {
  let server;
  let server_else;
  if (runtime['node']) {
    server = fs().createServer(
      {
        keepAliveTimeout: options.keepAliveTimeout || 120_000,
        keepAlive: true,
      },
      (x: any, y: any) => {
        Jetpath(x, y);
      }
    );
  }
  if (runtime['deno']) {
    server = {
      listen(port: number) {
        // @ts-expect-error
        server_else = Deno.serve({ port: port }, Jetpath);
      },
      edge: false,
    };
  }
  if (runtime['cloudflare_worker']) {
    server = {
      listen() {
        // Cloudflare Worker uses `addEventListener("fetch", ...)`
        addEventListener('fetch', (event: FetchEvent) => {
          // @ts-expect-error
          event.respondWith(Jetpath(event.request));
        });
      },
      edge: true,
    };
  }
  if (runtime['aws_lambda']) {
    server = {
      listen() {
        // AWS Lambda requires exporting a handler function
        // We'll wrap to Lambda-compatible handler
        const awsHandler = async (event: any) => {
          const req = new Request(event.rawPath || '/', {
            method: event.requestContext?.http?.method || 'GET',
            headers: event.headers,
            body: event.body,
          });
          // @ts-expect-error
          const res = await Jetpath(req);
          const text = await res.text();
          return {
            statusCode: res.status,
            headers: Object.fromEntries(res.headers),
            body: text,
          };
        };
        (module as any).exports.handler = awsHandler;
      },
      edge: true,
    };
  }
  if (runtime['bun']) {
    if (options.upgrade && options.upgrade === true) {
      server = {
        listen(port: number) {
          server_else = Bun.serve({
            port,
            // @ts-expect-error
            fetch: Jetpath,
            websocket: {
              message(...p) {
                p[1] = {
                  // @ts-expect-error
                  data: p[1],
                };
                JetSocketInstance.__binder('message', p);
              },
              close(...p) {
                JetSocketInstance.__binder('close', p);
              },
              drain(...p) {
                JetSocketInstance.__binder('drain', p);
              },
              open(...p) {
                JetSocketInstance.__binder('open', p);
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
            // @ts-expect-error
            fetch: Jetpath,
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
      server: !runtime['node'] ? server_else! : server!,
      runtime: runtime as any,
      routesObject: _JetPath_paths,
      JetPath_app: Jetpath as any,
    });
    Object.assign(plugins, decs);
  }
  const edgePlugin = plugs.find((plug) => plug.plugin.server);
  // ? adding ctx plugin bindings
  if (edgePlugin) {
    const edge_server = edgePlugin.plugin.server({
      server: !runtime['node'] ? server_else! : server!,
      runtime: runtime,
      routesObject: _JetPath_paths,
      handler: Jetpath,
      router: _JetPath_paths,
    });
    if (edge_server !== undefined) {
      server = edge_server;
      server.edge = true;
    }
  }
  return server!;
};

export const getCtx = (
  req: IncomingMessage | Request,
  res: any,
  path: string,
  route: JetRoute,
  params?: Record<string, any>
): Context => {
  if (ctxPool.length) {
    const ctx = ctxPool.shift()!;
    // ? reset the CContext to default state
    ctx.state['__state__'] = true;
    ctx.request = req;
    ctx.res = res;
    ctx.method = req.method as 'GET';
    ctx.params = params;
    ctx.$_internal_query = undefined;
    ctx.$_internal_body = undefined; // ? very important.
    ctx.path = path;
    //? load
    ctx.payload = undefined;
    // ? header of response
    ctx._2 = cachedCorsHeaders;
    // //? stream
    ctx._3 = undefined;
    //? the route handler
    ctx.handler = route;
    //? custom response
    ctx._6 = false;
    // ? code
    ctx.code = 200;
    return ctx;
  }
  const ctx = new Context();
  // ? add middlewares to the plugins object
  ctx.request = req;
  ctx.res = res;
  ctx._2 = cachedCorsHeaders;
  ctx.method = req.method as 'GET';
  ctx.params = params;
  ctx.path = path;
  ctx.handler = route;
  return ctx;
};

let makeRes: (
  res: ServerResponse<IncomingMessage> & {
    req: IncomingMessage;
  },
  ctx: Context
) => any;

const makeResBunAndDeno = (_res: any, ctx: Context) => {
  // ? prepare response
  // redirect
  // if (ctx?.code === 301 && ctx._2?.["Location"]) {
  //   ctxPool.push(ctx);
  //   // @ts-ignore
  //   return Response.redirect(ctx._2?.["Location"]);
  // }
  // ? streaming with ctx.sendStream
  if (ctx?._3) {
    // handle deno promise.
    // @ts-expect-error
    if (runtime['deno'] && ctx._3.then) {
      ctxPool.push(ctx);
      // @ts-expect-error
      return ctx._3.then((stream: any) => {
        return new Response(stream?.readable, {
          status: ctx.code,
          headers: ctx?._2,
        });
      });
    }
    ctxPool.push(ctx);
    return new Response(ctx?._3 as unknown as undefined, {
      status: ctx.code,
      headers: ctx?._2,
    });
  }
  if (ctx._6 !== false) {
    ctxPool.push(ctx);
    return ctx?._6;
  }
  // normal response
  ctx.__jet_pool && ctxPool.push(ctx);

  return new Response(ctx?.payload, {
    status: ctx.code,
    headers: ctx?._2,
  });
};
const makeResNode = (
  res: ServerResponse<IncomingMessage> & {
    req: IncomingMessage;
  },
  ctx: Context
) => {
  // ? prepare response
  if (ctx?._3) {
    res.writeHead(ctx?.code, ctx?._2);
    ctx?._3.on('error', (_err) => {
      res.statusCode;
      res.end('File not found');
    });
    ctx._3.pipe(res);
    ctxPool.push(ctx);
    return undefined;
  }

  res.writeHead(ctx.code, ctx?._2 || { 'Content-Type': 'text/plain' });
  res.end(ctx?.payload);
  ctx.__jet_pool && ctxPool.push(ctx);
  return undefined;
};

if (isNode) {
  makeRes = makeResNode;
} else {
  makeRes = makeResBunAndDeno;
}

const Jetpath = async (
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage> & {
    req: IncomingMessage;
  }
) => {
  if (req.method === 'OPTIONS') {
    optionsCtx.code = 200;
    return makeRes(res, optionsCtx as unknown as Context);
  }
  const ctx = _JetPath_paths_trie[req.method as methods]?.get_responder(
    req,
    res
  );
  const returned: Function[] = [];
  if (ctx) {
    const r = ctx.handler!;
    try {
      //? pre-request middlewares here
      if (r.jet_middleware?.length) {
        for (let m = 0; m < r.jet_middleware.length; m++) {
          const callback = await r.jet_middleware[m](ctx as any);
          if (typeof callback === 'function') {
            returned.unshift(callback);
          }
        }
      }
      //? check if the payload is already set by middleware chain;
      if (ctx.payload) return makeRes(res, ctx);
      //? route handler call
      await r(ctx as any);
      //? post-request middlewares here
      for (let r = 0; r < returned.length; r++) {
        await returned[r](ctx);
      }
      return makeRes(res, ctx);
    } catch (error) {
      try {
        //? report error to error middleware
        if (returned.length) {
          for (let r = 0; r < returned.length; r++) {
            await returned[r](ctx, error);
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
  }
  const ctx404 = optionsCtx;
  ctx404.code = 404;
  return makeRes(res, ctx404 as unknown as Context);
};

const handlersPath = (path: string) => {
  path = path.replaceAll('__', '-'); // ? convert __ to -
  const [method, ...segments] = path.split('_');
  let route = '/' + segments.join('/');
  // eslint-disable-next-line no-useless-escape
  route = route
    .replace(/\$0/g, '/*') // Convert wildcard
    .replace(/\$/g, '/:') // Convert params
    .replaceAll(/\/\//g, '/'); // change normalize akk extra /(s) to just /
  return /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|MIDDLEWARE|HEAD|CONNECT|TRACE)$/.test(
    method
  )
    ? ([method, route] as [string, string])
    : undefined;
};

const getModule = async (src: string, name: string) => {
  const absolutePath = fs().resolve(src + '/' + name); //? Gets native OS path
  try {
    const fileUrl = fs().pathToFileURL(absolutePath).href;
    const mod = await import(fileUrl);
    return mod;
  } catch (error) {
    LOG.log('Error at ' + absolutePath + ' loading failed!', 'info');
    LOG.log(String(error), 'error');
    return String(error);
  }
};

export async function getHandlers(
  source: string,
  print: boolean,
  errorsCount: { file: string; error: string }[] | undefined = undefined,
  again = false
) {
  const curr_d = fs().cwd();
  const error_source = source;
  source = source || '';
  if (!again) {
    source = fs().resolve(fs().join(curr_d, source));
    if (!source.includes(curr_d)) {
      LOG.log('source: "' + error_source + '" is invalid', 'warn');
      LOG.log('Jetpath source must be within the project directory', 'error');
      process.exit(1);
    }
  } else {
    source = fs().resolve(curr_d, source);
  }
  const dir = await fs().opendir(source);
  for await (const dirent of dir) {
    if (
      dirent.isFile() &&
      (dirent.name.endsWith('.jet.js') || dirent.name.endsWith('.jet.ts'))
    ) {
      if (print) {
        LOG.log(
          'Loading ' +
            source.replace(curr_d + '/', '') +
            fs().sep +
            dirent.name,
          'info'
        );
      }
      try {
        const module = await getModule(source, dirent.name);
        if (typeof module !== 'string') {
          for (const p in module) {
            const params = handlersPath(p);
            if (params) {
              if (p.startsWith('MIDDLEWARE')) {
                _jet_middleware[params[1]] = module[p];
              } else {
                // ! HTTP handler
                if (typeof params !== 'string') {
                  // ? set the method
                  module[p]!.method = params[0];
                  // ? set the path
                  module[p]!.path = params[1];
                  _JetPath_paths[params[0] as methods][params[1]] = module[
                    p
                  ] as JetRoute;
                  _JetPath_paths_trie[params[0] as methods].insert(
                    params[1],
                    module[p] as JetRoute
                  );
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
            file: dirent.path + '/' + dirent.name,
            error: module,
          });
        }
      } catch (error) {
        if (!errorsCount) {
          errorsCount = [];
        }
        errorsCount.push({
          file: dirent.path + '/' + dirent.name,
          error: String(error),
        });
      }
    }
    if (
      dirent.isDirectory() &&
      dirent.name !== 'node_modules' &&
      dirent.name !== '.git'
    ) {
      errorsCount = await getHandlers(
        source + '/' + dirent.name,
        print,
        errorsCount,
        true
      );
    }
  }
  return errorsCount;
}

export async function getHandlersEdge(modules: JetRoute[] & JetMiddleware[]) {
  for (const p in modules) {
    const params = handlersPath(p);
    if (params) {
      if (p.startsWith('MIDDLEWARE')) {
        _jet_middleware[params[1]] = modules[p] as any;
      } else {
        // ! HTTP handler
        if (typeof params !== 'string') {
          // ? set the method
          modules[p]!.method = params[0];
          // ? set the path
          modules[p]!.path = params[1];
          _JetPath_paths[params[0] as methods][params[1]] = modules[
            p
          ] as JetRoute;
          _JetPath_paths_trie[params[0] as methods].insert(
            params[1],
            modules[p] as JetRoute
          );
        }
      }
    }
  }
}

export function validator<T extends Record<string, any>>(
  schema: HTTPBody<T> | undefined,
  data: any
): T {
  if (!schema || typeof data !== 'object') {
    throw new Error('Invalid schema or data');
  }

  const errors: string[] = [];
  const out: Partial<T> = {};

  for (const [key, defs] of Object.entries(schema)) {
    const {
      RegExp,
      arrayType,
      err,
      objectSchema,
      required,
      type,
      validator: validate,
    } = defs;
    const value = data[key];

    // Required check
    // eslint-disable-next-line eqeqeq
    if (required && value == null) {
      errors.push(`${key} is required`);
      continue;
    }

    // Skip if optional and undefined
    // eslint-disable-next-line eqeqeq
    if (!required && value == null) {
      continue;
    }

    // Type validation
    if (type) {
      if (type === 'array') {
        if (!Array.isArray(value)) {
          errors.push(`${key} must be an array`);
          continue;
        }
        if (arrayType === 'object' && objectSchema) {
          try {
            const validatedArray = value.map((item) =>
              validator(objectSchema, item)
            );
            out[key as keyof T] = validatedArray as T[keyof T];
            continue;
          } catch (e) {
            errors.push(`${key}: ${String(e)}`);
            continue;
          }
        } else if (
          arrayType &&
          !value.every((item) => typeof item === arrayType)
        ) {
          errors.push(`${key} must be an array of ${arrayType}`);
          continue;
        }
      } else if (type === 'object') {
        if (typeof value !== 'object' || Array.isArray(value)) {
          errors.push(`${key} must be an object`);
          continue;
        }
        // Handle objectSchema validation
        if (objectSchema) {
          try {
            out[key as keyof T] = validator(objectSchema, value) as T[keyof T];
            continue;
          } catch (e) {
            errors.push(`${key}: ${String(e)}`);
            continue;
          }
        }
      } else {
        if (typeof value !== type) {
          if (type === 'file' && typeof value === 'object') {
            out[key as keyof T] = value;
            continue;
          }
          errors.push(`${key} must be of type ${type}`);
          continue;
        }
      }
    }

    // Regex validation
    if (RegExp && !RegExp.test(value)) {
      errors.push(err || `${key} is incorrect`);
      continue;
    }

    // Custom validator
    if (validate) {
      const result = validate(value);
      if (result !== true) {
        errors.push(
          typeof result === 'string'
            ? result
            : err || `${key} validation failed`
        );
        continue;
      }
    }

    out[key as keyof T] = value;
  }

  if (errors.length > 0) {
    throw new Error(errors.join(', '));
  }

  return out as T;
}

export const compileUI = (UI: string, options: jetOptions, api: string) => {
  // ? global headers
  const globalHeaders = JSON.stringify(
    options?.globalHeaders || {
      Authorization: 'Bearer <jwt token>',
    }
  );

  return UI.replace('"{ JETPATH }"', `\`${api}\``)
    .replaceAll(
      '"{ JETENVIRONMENTS }"',
      JSON.stringify(options?.apiDoc?.environments!)
    )
    .replaceAll('"{ JETPATHGH }"', `${JSON.stringify(globalHeaders)}`)
    .replaceAll('{NAME}', options?.apiDoc?.name || 'Jetpath API Doc')
    .replaceAll('JETPATHCOLOR', options?.apiDoc?.color || '#4285f4')
    .replaceAll(
      '{LOGO}',
      options?.apiDoc?.logo ||
        'https://raw.githubusercontent.com/codedynasty-dev/jetpath/main/icon-transparent.png'
    )
    .replaceAll(
      '{INFO}',
      options?.apiDoc?.info?.replaceAll('\n', '<br>') ||
        'This is a Jetpath api preview.'
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
      _JetPath_paths[method as methods]
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
            name + ':' + initialHeader[name as keyof typeof initialHeader]
          );
        }
        // ? parse body
        let bodyData: Record<string, any> | undefined = undefined;
        if (body) {
          bodyData = {};
          const processSchema = (schema: any, target: any) => {
            for (const key in schema) {
              const field = schema[key];
              if (field.type === 'object' && field.objectSchema) {
                target[key] = {};
                processSchema(field.objectSchema, target[key]);
              } else if (field.type === 'array') {
                if (field.arrayType === 'object' && field.objectSchema) {
                  target[key] = [{}];
                  processSchema(field.objectSchema, target[key][0]);
                } else {
                  target[key] = [
                    field.arrayType + ':' + (field.arrayDefaultValue || ''),
                  ];
                }
              } else {
                target[key] =
                  field?.inputType + ':' + (field?.inputDefaultValue || '');
              }
            }
          };
          processSchema(body, bodyData);
        }
        // ? combine api infos into .http format
        const api = `\n
${method} ${
          options?.apiDoc?.display === 'UI'
            ? '[--host--]'
            : 'http://localhost:' + (options?.port || 8080)
        }${route.path} HTTP/1.1
${headers.length ? headers.join('\n') : ''}\n
${
  (body && method !== 'GET' ? method : '') ? JSON.stringify(bodyData) : ''
}\n\n${
          validator?.['title']
            ? '#-JET-TITLE ' +
              validator?.['title'].replaceAll('\n', '\n# ') +
              '#-JET-TITLE'
            : ''
        }\n${
          validator?.['description']
            ? '#-JET-DESCRIPTION\n# ' +
              validator?.['description'].replaceAll('\n', '\n# ') +
              '\n#-JET-DESCRIPTION'
            : ''
        }\n
### break ###`;

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

  const compileAPIString = compiledAPIArray.join('');
  return [handlersCount, compileAPIString];
};

const sorted_insert = (paths: string[], path: string): number => {
  let low = 0;
  let high = paths.length - 1;
  for (; low <= high; ) {
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
          ctx: any
          // next: () => Promise<void>,
        ) => Promise<void> | void)
      | ((
          ctx: any
          // next: () => Promise<void>,
        ) => Promise<void> | void)[];
  }
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

export function parseFormData(
  rawBody: Uint8Array,
  contentType: string,
  options: { maxBodySize?: number } = {}
) {
  const { maxBodySize } = options;
  if (maxBodySize && rawBody.byteLength > maxBodySize) {
    throw new Error(
      `Body exceeds max size: ${rawBody.byteLength} > ${maxBodySize}`
    );
  }

  const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/i);
  if (!boundaryMatch) throw new Error('Invalid multipart boundary');

  const boundary = `--${boundaryMatch[1]}`;
  const boundaryBytes = new TextEncoder().encode(boundary);

  const decoder = new TextDecoder('utf-8');
  const fields: Record<string, string | string[]> = {};
  const files: Record<
    string,
    { fileName: string; content: Uint8Array; mimeType: string; size: number }
  > = {};

  const parts = splitBuffer(rawBody, boundaryBytes).slice(1, -1); // remove preamble and epilogue

  for (const part of parts) {
    const headerEndIndex = indexOfDoubleCRLF(part);
    if (headerEndIndex === -1) continue;

    const headerBytes = part.slice(0, headerEndIndex);
    let body = part.slice(headerEndIndex + 4); // Skip \r\n\r\n
    // 2) Strip leading CRLF
    if (body[0] === 13 && body[1] === 10) {
      body = body.slice(2);
    }
    // 3) Strip trailing CRLF
    if (body[body.length - 2] === 13 && body[body.length - 1] === 10) {
      body = body.slice(0, body.length - 2);
    }
    const headerText = decoder.decode(headerBytes);
    const headers = parseHeaders(headerText);

    const disposition = headers['content-disposition'];
    if (!disposition) continue;

    const nameMatch = disposition.match(/name="([^"]+)"/);
    if (!nameMatch) continue;

    const fieldName = nameMatch[1];
    const fileNameMatch = disposition.match(/filename="([^"]*)"/);
    const fileName = fileNameMatch?.[1] || null;

    if (fileName) {
      const mimeType = headers['content-type'] || 'application/octet-stream';
      files[fieldName] = {
        fileName,
        content: body,
        mimeType,
        size: body.length,
      };
    } else {
      const value = decoder.decode(body);
      if (fieldName in fields) {
        const existing = fields[fieldName];
        fields[fieldName] = Array.isArray(existing)
          ? [...existing, value]
          : [existing, value];
      } else {
        try {
          fields[fieldName] = JSON.parse(value.toString());
        } catch (error) {
          fields[fieldName] = value;
        }
      }
    }
  }

  return { ...fields, ...files };
}

function parseHeaders(headerText: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = headerText.split(/\r\n/);
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    headers[key] = val;
  }
  return headers;
}

function indexOfDoubleCRLF(buffer: Uint8Array): number {
  for (let i = 0; i < buffer.length - 3; i++) {
    if (
      buffer[i] === 13 &&
      buffer[i + 1] === 10 &&
      buffer[i + 2] === 13 &&
      buffer[i + 3] === 10
    ) {
      return i;
    }
  }
  return -1;
}

function splitBuffer(buffer: Uint8Array, delimiter: Uint8Array): Uint8Array[] {
  const parts: Uint8Array[] = [];
  let start = 0;

  while (start < buffer.length) {
    const idx = indexOf(buffer, delimiter, start);
    if (idx === -1) break;
    parts.push(buffer.slice(start, idx));
    start = idx + delimiter.length;
  }

  if (start <= buffer.length) {
    parts.push(buffer.slice(start));
  }

  return parts;
}

function indexOf(buffer: Uint8Array, search: Uint8Array, from = 0): number {
  outer: for (let i = from; i <= buffer.length - search.length; i++) {
    for (let j = 0; j < search.length; j++) {
      if (buffer[i + j] !== search[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export function parseUrlEncoded(
  bodyText: string
): Record<string, string | string[]> {
  const params = new URLSearchParams(bodyText);
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of params.entries()) {
    // eslint-disable-next-line no-prototype-builtins
    if (result.hasOwnProperty(key)) {
      if (Array.isArray(result[key])) {
        result[key].push(value);
      } else {
        result[key] = [result[key], value];
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Helper for Node.js: Reads the IncomingMessage stream, collecting chunks and checking size.
 */
function collectRequestBody(
  req: any,
  maxBodySize: number
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (maxBodySize && size > maxBodySize) {
        reject(new Error('Payload Too Large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(new Uint8Array(Buffer.concat(chunks)));
    });
    req.on('error', (err: any) => reject(err));
  });
}

/**
 * Reads the request/stream and returns a Promise that resolves to the parsed body.
 */
export async function parseRequest(
  req: any,
  options: { maxBodySize?: number; contentType?: string } = {}
): Promise<Record<string, any>> {
  const { maxBodySize = 5 * 1024 * 1024 } = options;
  let contentType = options.contentType || '';
  let rawBody: Uint8Array;

  if (typeof req.arrayBuffer === 'function') {
    if (!contentType && req.headers && typeof req.headers.get === 'function') {
      contentType = req.headers.get('content-type') || '';
    }
    const arrayBuffer = await req.arrayBuffer();
    rawBody = new Uint8Array(arrayBuffer);
    if (rawBody.byteLength > maxBodySize) {
      throw new Error('Payload Too Large');
    }
  } else if (typeof req.on === 'function') {
    if (!contentType && req.headers) {
      contentType = req.headers['content-type'] || '';
    }
    rawBody = await collectRequestBody(req, maxBodySize);
  } else {
    throw new Error('Unsupported request object type');
  }

  const ct = contentType.toLowerCase();
  const decoder = new TextDecoder('utf-8');
  let bodyText: string;

  if (ct.includes('application/json')) {
    bodyText = decoder.decode(rawBody);
    return JSON.parse(bodyText || '{}');
  } else if (ct.includes('application/x-www-form-urlencoded')) {
    bodyText = decoder.decode(rawBody);
    return parseUrlEncoded(bodyText);
  } else if (ct.includes('multipart/form-data')) {
    return parseFormData(rawBody, contentType, { maxBodySize });
  } else {
    bodyText = decoder.decode(rawBody);
    return { parsed: bodyText };
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
  schemaDefinition: (t: typeof v) => Record<string, SchemaBuilder>
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
  endpoint: JetRoute<JetData, JetPluginTypes>
): compilerType<JetData, JetPluginTypes> {
  const compiler = {
    /**
     * Sets the API documentation body for the endpoint
     */
    body: function (
      schemaFn: (
        t: typeof v
      ) => Partial<
        Record<keyof HTTPBody<NonNullable<JetData['body']>>, SchemaBuilder>
      >
    ) {
      endpoint.body = createSchema(schemaFn as any) as any;
      return compiler;
    },
    /**
     * Sets the API documentation body for the endpoint
     */
    response: function (
      schemaFn: (
        t: typeof v
      ) => Partial<
        Record<keyof HTTPBody<NonNullable<JetData['response']>>, SchemaBuilder>
      >
    ) {
      endpoint.response = createSchema(schemaFn as any) as any;
      return compiler;
    },
    /**
     * Sets the API documentation headers for the endpoint
     * @param {Object} headers - The API documentation headers
     */
    headers: function (headers: Record<string, string>) {
      if (typeof endpoint !== 'function') {
        throw new Error('Endpoint must be a function');
      }
      endpoint.headers = headers;
      return compiler;
    },
    /**
     * Sets the API documentation title for the endpoint
     * @param {string} title - The API documentation title
     */
    title: function (title: string) {
      if (typeof endpoint !== 'function') {
        throw new Error('Endpoint must be a function');
      }
      endpoint.title = title;
      return compiler;
    },
    /**
     * Sets the API documentation description for the endpoint
     * @param {string} description - The API documentation description
     */
    description: function (description: string) {
      if (typeof endpoint !== 'function') {
        throw new Error('Endpoint must be a function');
      }
      endpoint.description = description;
      return compiler;
    },
    /**
     * Sets the API documentation params for the endpoint
     */
    params: function (
      schemaFn: (
        t: typeof v
      ) => Partial<
        Record<keyof HTTPBody<NonNullable<JetData['params']>>, SchemaBuilder>
      >
    ) {
      if (typeof endpoint !== 'function') {
        throw new Error('Endpoint must be a function');
      }
      endpoint.params = createSchema(schemaFn as any) as any;
      return compiler;
    },

    query: function (
      schemaFn: (
        t: typeof v
      ) => Partial<
        Record<keyof HTTPBody<NonNullable<JetData['query']>>, SchemaBuilder>
      >
    ) {
      if (typeof endpoint !== 'function') {
        throw new Error('Endpoint must be a function');
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
  mode: 'ON' | 'WARN',
  generatedRoutesFilePath?: string
) {
  //? Regex to find exported const variables
  // ? let's make sure if this line is a comments then it should not be matched!
  const ROUTE_EXPORT_REGEX =
    /^(?!\s*\/\/)export\s+const\s+((?:GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|MIDDLEWARE)_[a-zA-Z0-9$]*\$?[a-zA-Z0-9$_]*)\s*/gm;
  //? let's make sure if this line is a comments then it should not be matched!
  const METHOD_PATH_REGEX =
    /(?:GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|MIDDLEWARE)_[a-zA-Z0-9$_]*$/;
  const OUTPUT_FILE = fs().resolve(
    fs().join(fs().cwd(), 'node_modules', '@jetpath', 'index.ts')
  );
  const ROUTE_FILE = fs().resolve(
    generatedRoutesFilePath
      ? generatedRoutesFilePath
      : fs().join(fs().cwd(), 'definitions.ts')
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
          if (!entry.name.startsWith('.')) {
            await walkDir(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith('.jet.ts')) {
          try {
            const fileContent = await fs().readFile(fullPath, 'utf-8');
            const foundExports = [];
            let match;

            while ((match = ROUTE_EXPORT_REGEX.exec(fileContent)) !== null) {
              const exportName = match[1];
              if (METHOD_PATH_REGEX.test(exportName)) {
                foundExports.push(exportName);
              } else {
                LOG.log(
                  ` ${exportName} is not a valid JetRoute export`,
                  'error'
                );
              }
            }

            if (foundExports.length > 0) {
              const moduleName = 'm' + mIdex; // only alphanumeric letters;
              //? Generate the declare module block for this file
              let moduleDeclaration = `import * as ${moduleName} from '${fullPath}';\n\n\n`;
              //? Add declarations for each found route export
              for (const exportName of foundExports) {
                //? Declare the export with the basic JetRoute<any, any> type
                if (exportName.startsWith('MIDDLEWARE_')) {
                  moduleDeclaration += `const ${exportName} = ${moduleName}.${exportName} satisfies JetMiddleware<any, any>\n\n `;
                } else {
                  moduleDeclaration += `const ${exportName} = ${moduleName}.${exportName} satisfies JetRoute<any, any>\n\n `;
                }
              }
              declarations.push(moduleDeclaration);
            }
          } catch (error) {
            console.error(
              `Error reading or parsing file ${fullPath}: ${error}`
            );
          }
        }
        mIdex++;
      }
    } catch (error) {
      console.error(`Error reading directory ${currentDir}: ${error}`);
    }
  }
  if (mode === 'ON') {
    await walkDir(fs().resolve(fs().cwd(), ROUTES_DIR));
  } else {
    walkDir(fs().resolve(fs().cwd(), ROUTES_DIR));
  }
  const compileObjectStructureFromSchema = (schema: SchemaDefinition) => {
    const obj: Record<string, 'string' | Record<string, 'string'>> = {};
    if (schema.type === 'object') {
      for (const key in schema.objectSchema) {
        obj[key] = 'string';
        if (schema.objectSchema[key].type === 'object') {
          // @ts-ignore
          obj[key] = compileObjectStructureFromSchema(
            schema.objectSchema[key] as SchemaDefinition
          );
        }
      }
      return obj;
    }
    const arrayObj: any[] = [];
    if (schema.type === 'array') {
      if (schema.arrayType === 'object') {
        const obj: Record<string, 'string'> = {};
        for (const key in schema.objectSchema) {
          obj[key] = 'string';
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
    '//? This file is auto-generated by Jetpath. DO NOT MODIFY!\n\n';
  outputContent +=
    "// @ts-ignore\nimport { type JetRoute, JetMiddleware } from 'jetpath';\n\n";
  if (typeof generatedRoutesFilePath === 'string') {
    LOG.log('Generating routes file', 'info');
    const outputContent = `export const routes = {\n ${Object.keys(
      _JetPath_paths
    )
      .reduce((acc: string[], method) => {
        const routes = Object.keys(_JetPath_paths[method as methods]);
        const obj = _JetPath_paths[method as methods];

        if (routes.length > 0) {
          for (const route of routes) {
            let body: Record<string, 'string'> | undefined;
            let response: Record<string, 'string'> | undefined;
            let params: Record<string, 'string'> | undefined;
            let query: Record<string, 'string'> | undefined;
            if (obj[route].body) {
              for (const key in obj[route].body) {
                if (!body) {
                  body = {};
                }
                const type = obj[route].body[key].type;
                const val =
                  type === 'string'
                    ? 'string'
                    : type === 'number'
                      ? 1
                      : type === 'boolean'
                        ? true
                        : type === 'object'
                          ? compileObjectStructureFromSchema(
                              obj[route].body[key] as SchemaDefinition
                            )
                          : type === 'array'
                            ? compileObjectStructureFromSchema(
                                obj[route].body[key] as SchemaDefinition
                              )
                            : type === 'file'
                              ? 'file'
                              : type;
                body[key] = val as 'string';
              }
            }
            if (obj[route].query) {
              for (const key in obj[route].query) {
                if (!query) {
                  query = {};
                }
                const type = obj[route].query[key].type;
                const val =
                  type === 'string'
                    ? 'string'
                    : type === 'number'
                      ? 1
                      : type === 'boolean'
                        ? true
                        : type === 'object'
                          ? compileObjectStructureFromSchema(
                              obj[route].query[key] as SchemaDefinition
                            )
                          : type === 'array'
                            ? compileObjectStructureFromSchema(
                                obj[route].query[key] as SchemaDefinition
                              )
                            : type;
                query[key] = val as 'string';
              }
            }
            if (obj[route].response) {
              for (const key in obj[route].response) {
                if (!response) {
                  response = {};
                }
                const type = obj[route].response[key].type;
                const val =
                  type === 'string'
                    ? 'string'
                    : type === 'number'
                      ? 1
                      : type === 'boolean'
                        ? true
                        : type === 'object'
                          ? compileObjectStructureFromSchema(
                              obj[route].response[key] as SchemaDefinition
                            )
                          : type === 'array'
                            ? compileObjectStructureFromSchema(
                                obj[route].response[key] as SchemaDefinition
                              )
                            : type === 'file'
                              ? 'file'
                              : type;
                response[key] = val as 'string';
              }
            }
            if (obj[route].params) {
              for (const key in obj[route].params) {
                if (!params) {
                  params = {};
                }
                params[key] = 'string';
              }
            }
            acc.push(
              `${
                obj[route].name
              }: {\n    path: "${route}",\n    method: "${method.toLowerCase()}",\n${
                body ? `    body: ${JSON.stringify(body || {})},\n` : ''
              }${
                response
                  ? `    response: ${JSON.stringify(response || {})},\n`
                  : ''
              }${
                query ? `    query: ${JSON.stringify(query || {})},\n` : ''
              }    title: "${obj[route].title || ''}",\n${
                params ? `    params: ${JSON.stringify(params || {})},\n` : ''
              }}`
            );
          }
        }
        return acc;
      }, [])
      .join(',\n ')} \n} as const;\n\n`;
    try {
      await fs().writeFile(ROUTE_FILE, outputContent, 'utf-8');
      LOG.log('Generated routes file successfully: ' + ROUTE_FILE, 'success');
    } catch (error) {
      LOG.log(`Error writing routes file ${ROUTE_FILE}: ${error}`, 'error');
    }
  }
  //? Add all the generated module declarations
  outputContent += declarations.join('\n');

  try {
    LOG.log('⚙️  StrictMode...\nmode: ' + mode, 'info');
    await fs().writeFile(OUTPUT_FILE, outputContent, 'utf-8');

    const promisifiedExecFile = () =>
      new Promise((resolve) => {
        fs().execFile(
          'tsc',
          [
            '--noEmit',
            '--target',
            'ESNext',
            '--module',
            'NodeNext',
            '--moduleResolution',
            'NodeNext',
            '--lib',
            'ESNext,DOM',
            '--strict',
            '--esModuleInterop',
            '--allowImportingTsExtensions',
            '--skipLibCheck',
            OUTPUT_FILE,
          ],
          { encoding: 'utf8' },
          (err, stdout, stderr) => {
            if (err) {
              if (err.toString().includes('Executable not found')) {
                LOG.log(
                  "\n🛠️ StrictMode Can't work: Please install typescript using \n'npm install -g typescript' or \n'yarn global add typescript'\n\n",
                  'error'
                );
              }
              LOG.log('\n🛠️ StrictMode warnings', 'warn');
              if (typeof stderr === 'string') {
                LOG.log(
                  stderr.replaceAll('\n', '\n\n'),
                  mode === 'WARN' ? 'warn' : 'error'
                );
              }
              if (typeof stdout === 'string') {
                LOG.log(
                  stdout.replaceAll('\n', '\n\n'),
                  mode === 'WARN' ? 'warn' : 'error'
                );
                const errors = (stdout?.split('\n') || []).length - 1;
                LOG.log(
                  errors +
                    ` Problem${
                      errors === 1 ? '' : 's'
                    } 🐞\n\nYou are seeing these warnings because you have strict mode enabled\n`,
                  'info'
                );
              }
            }
            resolve(undefined);
          }
        );
      });
    await promisifiedExecFile();
  } catch (error) {
    LOG.log(`Error writing output file apis-types.d.ts: ${error}`, 'error');
  }
}

export function getLocalIP() {
  const interfaces: Record<string, any> = fs().networkInterfaces() || [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if ('IPv4' !== iface.family || iface.internal !== false) {
        continue;
      }
      return iface.address;
    }
  }
}

export const fs = await (async () => {
  try {
    // detect edge;
    const { opendir, readdir, readFile, writeFile } = await import(
      'node:fs/promises'
    );
    // import { opendir, readdir, readFile, writeFile } from "node:fs/promises";
    const { dirname, join, resolve, sep } = await import('node:path');
    // import { dirname, join, resolve, sep } from "node:path";
    const { cwd } = await import('node:process');
    // import { cwd } from "node:process";

    const { createReadStream, realpathSync } = await import('node:fs');
    // import { createReadStream, realpathSync } from "node:fs";

    const { createServer } = await import('node:http');
    const { networkInterfaces } = await import('node:os');
    const { execFile } = await import('node:child_process');
    const { mkdirSync } = await import('node:fs');
    const { pathToFileURL } = await import('node:url');

    const fils_system_apis = {
      opendir,
      readdir,
      readFile,
      writeFile,
      dirname,
      join,
      resolve,
      sep,
      cwd,
      createReadStream,
      realpathSync,
      createServer,
      networkInterfaces,
      execFile,
      mkdirSync,
      pathToFileURL,
    };
    return () => fils_system_apis;
  } catch (error) {
    return () => {
      throw new Error(
        'Node.js APIs are not available in this environment. Please ensure you are using edgeGrabber for edge environment, check the edge docs for more information.'
      );
    };
  }
})();
