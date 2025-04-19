import { IncomingMessage, Server, ServerResponse } from "node:http";
import type { _JetPath_paths } from "./functions.js";
import { CookieOptions } from "./classes.js";

type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (
  x: infer I,
) => void ? I
  : never;

export interface ContextType<
  JetData extends {
    body?: Record<string, any>;
    params?: Record<string, any>;
    query?: Record<string, any>;
  } = { body: {}; params: {}; query: {} },
  JetPluginTypes extends Record<string, unknown>[] = [],
> {
  /**
   * an object you can set values to per request
   */
  app: Record<string, any>;
  /**
   * an object you can set values to per request
   */
  plugins: UnionToIntersection<JetPluginTypes[number]> & Record<string, any>;
  /**
   * get body params after /?
   */
  body: JetData["body"];
  /**
   * get query params after /?
   */
  query: JetData["query"];
  /**
   * get route params in /:thing
   */
  params: JetData["params"];
  /**
   * websocket socket event class
   */
  connection: jet_socket;
  /**
   * reply the request
   */
  request: Request;
  /**
   * API status
   */
  code: number;
  /**
   * send a stream
   */
  // sendStream(stream: Stream | string, ContentType: string): never;
  sendStream(stream: any | string, ContentType: string): never;
  /**
   * send a direct response
   * *Only for deno and bun
   */
  // sendStream(stream: Stream | string, ContentType: string): never;
  sendResponse(response?: Response): never;
  /**
   * reply the request
   */
  send(data: unknown, ContentType?: string): never;
  /**
   * end the request with an error
   */
  throw(
    code?: number | string | Record<string, any> | unknown,
    message?: string | Record<string, any>,
  ): never;
  /**
   * redirect the request
   */
  redirect(url: string): never;
  /**
   * get request header values
   */
  get(field: string): string | undefined;
  /**
   * set request header values
   */
  set(field: string, value: string): void;
  /**
   * Parses the request body
   */
  getCookie(name: string): string | undefined;
  getCookies(): Record<string, string>;
  setCookie(name: string, value: string, options: CookieOptions): void;
  clearCookie(name: string, options: CookieOptions): void;
  parse(options?: {
    maxBodySize?: number;
    contentType?: string;
  }): Promise<JetData["body"]>;

  /**
   * get original request
   */
  path: string;
  _1?: string | undefined;
  _2?: Record<string, string>;
  _3?: any; //Stream | undefined; // Stream
  _4?: boolean | undefined;
  _5?: (() => never) | undefined;
  _6?: Response | false;
}

export type JetPluginExecutorInitParams = {
  runtime: {
    node: boolean;
    bun: boolean;
    deno: boolean;
  };
  server: Server<typeof IncomingMessage, typeof ServerResponse>;
  routesObject: typeof _JetPath_paths;
  JetPath_app: (req: Request) => Response;
};

// A helper type for “any function of the right shape”
export type AnyExecutor = (
  this: any,
  init: JetPluginExecutorInitParams,
  config: Record<string, unknown>,
) => any;

export type contentType =
  | "application/x-www-form-urlencoded"
  | "multipart/form-data"
  | "application/json";

export type methods =
  | "GET"
  | "POST"
  | "OPTIONS"
  | "DELETE"
  | "HEAD"
  | "PUT"
  | "PATCH";

export type allowedMethods = methods[];

export type jetOptions = {
  globalHeaders?: Record<string, string>;
  apiDoc?: {
    name?: string;
    info?: string;
    color?: string;
    logo?: string;
    path?: string;
    password?: string;
    username?: string;
  };
  source?: string;
  credentials?: {
    cert: string;
    key: string;
  };
  APIdisplay?: "UI" | "HTTP" | false;
  port?: number;
  static?: { route: string; dir: string };
  cors?:
    | {
      allowMethods?: allowedMethods;
      secureContext?: {
        "Cross-Origin-Opener-Policy":
          | "same-origin"
          | "unsafe-none"
          | "same-origin-allow-popups";
        "Cross-Origin-Embedder-Policy": "require-corp" | "unsafe-none";
      };
      allowHeaders?: string[];
      exposeHeaders?: string[];
      keepHeadersOnError?: boolean;
      maxAge?: string;
      credentials?: boolean;
      privateNetworkAccess?: any;
      origin?: string[];
    }
    | boolean;
  websocket?:
    | {
      idleTimeout?: number;
    }
    | boolean;
};

export type HTTPBody<Obj extends Record<string, any>> = {
  [x in keyof Obj]: {
    err?: string;
    type?: "string" | "number" | "file" | "object" | "boolean" | "array";
    arrayType?:
      | "string"
      | "number"
      | "file"
      | "object"
      | "boolean"
      | "object"
      | "array";
    RegExp?: RegExp;
    inputAccept?: string;
    inputType?:
      | "date"
      | "email"
      | "file"
      | "password"
      | "number"
      | "time"
      | "tel"
      | "datetime"
      | "url";
    inputDefaultValue?: string | number | boolean;
    required?: boolean;
    validator?: (value: any) => boolean;
    objectSchema?: HTTPBody<Record<string, any>>;
  };
};

export type JetMiddleware<
  JetData extends {
    body?: Record<string, any>;
    params?: Record<string, any>;
    query?: Record<string, any>;
  } = { body: {}; params: {}; query: {} },
  JetPluginTypes extends Record<string, unknown>[] = [],
> = (
  ctx: ContextType<JetData, JetPluginTypes>,
) =>
  | Promise<void>
  | void
  | Promise<
    (
      ctx: ContextType<JetData, JetPluginTypes>,
      error: unknown,
    ) => Promise<any> | any
  >
  | ((
    ctx: ContextType<JetData, JetPluginTypes>,
    error: unknown,
  ) => Promise<any> | any)
  | undefined
  | Promise<void>
  | void;

export type JetFunc<
  JetData extends {
    body?: Record<string, any>;
    params?: Record<string, any>;
    query?: Record<string, any>;
  } = { body: {}; params: {}; query: {} },
  JetPluginTypes extends Record<string, unknown>[] = [],
> = {
  (ctx: ContextType<JetData, JetPluginTypes>): Promise<void> | void;
  body?: HTTPBody<JetData["body"] & Record<string, any>>;
  headers?: Record<string, string>;
  info?: string;
  method?: string;
  path?: string;
  jet_middleware?: JetMiddleware[];
};

interface jet_socket {
  addEventListener(
    event: "message" | "close" | "drain" | "open",
    listener: (socket: WebSocket, ...params: any[]) => void,
  ): void;
}

export type JetFile = {
  fileName: string;
  content: Uint8Array;
  mimeType: string;
};
