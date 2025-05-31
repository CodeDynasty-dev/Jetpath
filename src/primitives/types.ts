import { IncomingMessage, Server, ServerResponse } from "node:http";
import type { _JetPath_paths, v } from "./functions.js";
import { type CookieOptions, SchemaBuilder } from "./classes.js";
import type { BunFile } from "bun";
import type Stream from "node:stream";

export type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends (
    x: infer I,
  ) => void ? I
    : never;

export interface JetContext<
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
  state: Record<string, any>;
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
   * @param stream - The stream or file path to send
   * @param folder - The folder to save the stream to
   * @param ContentType - The content type of the stream
   *
   * PLEASE PROVIDE A VALID FOLDER PATH FOR SECURITY REASONS
   */
  sendStream(
    stream: Stream | string | BunFile,
    folder?: string,
    ContentType?: string,
  ): void | never;
  /**
   * send a file for download
   * @param stream - The file path to send
   * @param folder - The folder to save the stream to
   * @param ContentType - The content type of the stream
   *
   * PLEASE PROVIDE A VALID FOLDER PATH FOR SECURITY REASONS
   */
  download(
    stream: string | BunFile,
    folder?: string,
    ContentType?: string,
  ): void;
  /**
   * send a direct response
   * *Only for deno and bun
   */
  sendResponse(response?: Response): void;
  /**
   * reply the request
   */
  send(data: unknown, statusCode?: number, ContentType?: string): void;
  /**
   * redirect the request
   */
  redirect(url: string): void;
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
   * Upgrade the request to a WebSocket connection
   */
  upgrade(): void | never;
  /**
   * get original request
   */
  path: string;
  payload?: string;
  _2?: Record<string, string>;
  _3?: any; //Stream | undefined; // Stream
  _4?: boolean | undefined;
  _5?: JetRoute | undefined;
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
  | "CONNECT"
  | "TRACE"
  | "PATCH";

export type allowedMethods = methods[];

export type jetOptions = {
  upgrade?: boolean;
  source?: string;
  globalHeaders?: Record<string, string>;
  strictMode?: "ON" | "OFF" | "WARN";
  generateRoutes?: boolean;
  keepAliveTimeout?: number;
  apiDoc?: {
    display?: "UI" | "HTTP" | false;
    environments?: Record<string, string>;
    name?: string;
    info?: string;
    color?: string;
    logo?: string;
    path?: string;
    password?: string;
    username?: string;
  };
  credentials?: {
    cert: string;
    key: string;
  };
  port?: number;
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
};

export type HTTPBody<Obj extends Record<string, any>> = {
  [x in keyof Obj]: {
    err?: string;
    type?:
      | "string"
      | "number"
      | "file"
      | "object"
      | "boolean"
      | "array"
      | "date";
    arrayType?:
      | "string"
      | "number"
      | "file"
      | "object"
      | "boolean"
      | "array"
      | "date";
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
    validator?: (value: any) => boolean | string;
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
  ctx: JetContext<JetData, JetPluginTypes>,
) =>
  | void
  | Promise<void>
  | ((
    ctx: JetContext<JetData, JetPluginTypes>,
    error: unknown,
  ) => void | Promise<void>)
  | Promise<
    ((
      ctx: JetContext<JetData, JetPluginTypes>,
      error: unknown,
    ) => void | Promise<void>) | undefined
  >
  | undefined;

export type JetRoute<
  JetData extends {
    body?: Record<string, any>;
    params?: Record<string, any>;
    query?: Record<string, any>;
    response?: Record<string, any>;
  } = {
    body: {};
    params: {};
    query: {};
    response: {};
    title: "";
    description: "";
    method: "";
    path: "";
    jet_middleware: [];
  },
  JetPluginTypes extends Record<string, unknown>[] = [],
> = {
  (ctx: JetContext<JetData, JetPluginTypes>): Promise<void> | void;
  body?: HTTPBody<JetData["body"] & Record<string, any>>;
  headers?: Record<string, string>;
  title?: string;
  description?: string;
  method?: string;
  path?: string;
  jet_middleware?: JetMiddleware[];
  params?: HTTPBody<JetData["params"] & Record<string, any>>;
  query?: HTTPBody<JetData["query"] & Record<string, any>>;
  response?: HTTPBody<JetData["response"] & Record<string, any>>;
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

export type SchemaType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "date"
  | "file";

export interface ValidationOptions {
  err?: string;
  RegExp?: RegExp;
  validator?: (value: any) => boolean | string;
  inputDefaultValue?: any;
  required?: boolean;
}
export interface FileOptions {
  inputAccept?: string;
  inputMultiple?: boolean;
  err?: string;
}

export interface ArrayOptions extends ValidationOptions {
  arrayType?: SchemaType | "object";
  objectSchema?: HTTPBody<any>;
}

export interface ObjectOptions extends ValidationOptions {
  objectSchema?: HTTPBody<any>;
}

export type SchemaDefinition =
  & {
    type: SchemaType;
  }
  & ValidationOptions
  & ArrayOptions
  & ObjectOptions;

export type compilerType<
  JetData extends {
    body?: Record<string, any>;
    params?: Record<string, any>;
    query?: Record<string, any>;
    response?: Record<string, any>;
  },
  JetPluginTypes extends Record<string, unknown>[] = [],
> = {
  //? docs and validation
  /**
   * Sets the API body validation and documentation body for the endpoint
   */
  body: (
    schemaFn: (
      t: typeof v,
    ) => Partial<
      Record<keyof HTTPBody<NonNullable<JetData["body"]>>, SchemaBuilder>
    >,
  ) => compilerType<JetData, JetPluginTypes>;
  //? docs and validation
  /**
   * Sets the API documentation query for the endpoint
   */
  query: (
    schemaFn: (
      t: typeof v,
    ) => Partial<
      Record<keyof HTTPBody<NonNullable<JetData["query"]>>, SchemaBuilder>
    >,
  ) => compilerType<JetData, JetPluginTypes>;
  //? docs only
  /**
   * Sets the API documentation title for the endpoint
   */
  title: (title: string) => compilerType<JetData, JetPluginTypes>;
  //? docs only
  /**
   * Sets the API documentation description for the endpoint
   */
  description: (description: string) => compilerType<JetData, JetPluginTypes>;
};
