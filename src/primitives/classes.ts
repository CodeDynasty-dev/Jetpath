import { createReadStream, realpathSync } from "node:fs";
import { IncomingMessage } from "node:http";
import { type Stream } from "node:stream";
import {
  _JetPath_paths,
  abstractPluginCreator,
  getCtx,
  isNode,
  JetSocketInstance,
  parseRequest, 
  runtime,
  validator,
} from "./functions.js";
import type {
  FileOptions,
  HTTPBody,
  JetContext,
  jetOptions,
  JetPluginExecutorInitParams,
  JetRoute,
  methods,
  SchemaDefinition,
  SchemaType,
  ValidationOptions,
} from "./types.js";
import { mime } from "../extracts/mimejs-extract.js";
import { resolve, sep } from "node:path";
import type { BunFile } from "bun";

export class JetPlugin {
  plugin: any;
  constructor(plugin: { executor: Function; server?: any }) {
    this.plugin = plugin;
  }
  setup(init: JetPluginExecutorInitParams): any {
    return this.plugin.executor(init);
  }
}

export class LOG {
  // Define ANSI escape codes for colors and styles
  static colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    underscore: "\x1b[4m",
    blink: "\x1b[5m",
    reverse: "\x1b[7m",
    hidden: "\x1b[8m",

    fgBlack: "\x1b[30m",
    fgRed: "\x1b[31m",
    fgGreen: "\x1b[32m",
    fgYellow: "\x1b[33m",
    fgBlue: "\x1b[34m",
    fgMagenta: "\x1b[35m",
    fgCyan: "\x1b[36m",
    fgWhite: "\x1b[37m",

    bgBlack: "\x1b[40m",
    bgRed: "\x1b[41m",
    bgGreen: "\x1b[42m",
    bgYellow: "\x1b[43m",
    bgBlue: "\x1b[44m",
    bgMagenta: "\x1b[45m",
    bgCyan: "\x1b[46m",
    bgWhite: "\x1b[47m",
  };
  static print(message: any, color: string) {
    console.log(`${color}%s${LOG.colors.reset}`, `${message}`);
  }
  static log(message: string, type: "info" | "warn" | "error" | "success") {
    LOG.print(
      message,
      type === "info"
        ? LOG.colors.fgBlue
        : type === "warn"
        ? LOG.colors.fgYellow
        : LOG.colors.fgRed,
    );
  }
}

export interface CookieOptions {
  path?: string;
  domain?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "strict" | "lax" | "none";
  maxAge?: number;
  expires?: Date;
}

class Cookie {
  private static parseCookieHeader(header: string): Record<string, string> {
    return header
      .split("; ")
      .map((pair) => pair.split("="))
      .reduce((acc, [key, value]) => ({
        ...acc,
        [key.trim()]: value ? decodeURIComponent(value) : "",
      }), {});
  }

  private static serializeCookie(
    name: string,
    value: string,
    options: CookieOptions,
  ): string {
    const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

    if (options.path) parts.push(`Path=${encodeURIComponent(options.path)}`);
    if (options.domain) {
      parts.push(`Domain=${encodeURIComponent(options.domain)}`);
    }
    if (options.secure) parts.push("Secure");
    if (options.httpOnly) parts.push("HttpOnly");
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
    if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);

    return parts.join("; ");
  }

  static parse(cookies: string): Record<string, string> {
    return Cookie.parseCookieHeader(cookies);
  }

  static serialize(
    name: string,
    value: string,
    options: CookieOptions = {},
  ): string {
    return Cookie.serializeCookie(name, value, options);
  }
}

class ctxState {
  state: Record<string, any> = {};
}

 

export class Context {
  code = 200;
  request: Request | IncomingMessage | undefined;
  params: Record<string, any> | undefined;
  query: Record<string, any> | undefined;
  body?: Record<string, any>;
  path: string | undefined;
  connection?: JetSocket;
  method: methods | undefined;
  handler: JetRoute | null = null;
  __jet_pool = true;
  plugins: Record<string, Function>;
  // ? state
  get state(): Record<string, any> {
    // ? auto clean up state object
    if (this._7.state["__state__"] === true) {
      for (const key in this._7.state) {
        delete this._7.state[key];
      }
    }
    return this._7.state;
  }
  //? load
  payload?: string = undefined;
  // ? header of response
  _2: Record<string, string> = {};
  // //? stream
  _3?: Stream = undefined;
  //? response
  _6: boolean = false;
  //? original response
  res?: any;
  //? state
  _7: ctxState;
  constructor() {
    this.plugins = abstractPluginCreator(this);
    this._7 = new ctxState();
  }
  send(data: unknown, statusCode?: number, contentType?: string) {
    if (this._6 || this._3) {
      throw new Error("Response already set");
    }
    if (contentType) {
      this._2["Content-Type"] = contentType;
      this.payload = String(data);
      this.code = statusCode || 200;
    } else {
      if (typeof data === "object") {
        this._2["Content-Type"] = "application/json";
        this.payload = JSON.stringify(data);
      } else {
        this.payload = data ? String(data) : "";
      }
      this.code = statusCode || 200;
    }
  }

  redirect(url: string) {
    this.code = 301;
    this._2["Location"] = url;
  }

  get(field: string) {
    if (field) {
      if (runtime["node"]) {
        return (this.request as IncomingMessage).headers[field] as string;
      }
      return (this.request as Request).headers.get(field) as string;
    }
    return undefined;
  }

  set(field: string, value: string) {
    if (field && value) {
      this._2[field] = value;
    }
  }

  getCookie(name: string): string | undefined {
    const cookieHeader = runtime["node"]
      ? (this.request as IncomingMessage).headers.cookie
      : (this.request as Request).headers.get("cookie");

    if (cookieHeader) {
      const cookies = Cookie.parse(cookieHeader);
      return cookies[name];
    }
    return undefined;
  }

  getCookies(): Record<string, string> {
    const cookieHeader = runtime["node"]
      ? (this.request as IncomingMessage).headers.cookie
      : (this.request as Request).headers.get("cookie");

    return cookieHeader ? Cookie.parse(cookieHeader) : {};
  }

  setCookie(name: string, value: string, options: CookieOptions = {}): void {
    const cookie = Cookie.serialize(name, value, options);
    const existingCookies = this._2["set-cookie"] || "";
    const cookies = existingCookies
      ? existingCookies.split(",").map((c) => c.trim())
      : [];
    cookies.push(cookie);
    this._2["set-cookie"] = cookies.join(", ");
  }

  clearCookie(name: string, options: CookieOptions = {}): void {
    this.setCookie(name, "", { ...options, maxAge: 0 });
  }

  sendStream(
    stream: Stream | string | BunFile,
    config: {
      folder?: string;
      ContentType: string;
    } = {
      folder: undefined,
      ContentType: "application/octet-stream",
    },
  ) {
    if (typeof stream === "string") {
      if (config.folder) {
        let normalizedTarget: string;
        let normalizedBase: string;
        try {
          stream = resolve(config.folder, stream);
          normalizedTarget = realpathSync(stream);
          normalizedBase = realpathSync(config.folder);
        } catch (error) {
          throw new Error("File not found!");
        }
        // ? prevent path traversal
        if (!normalizedTarget.startsWith(normalizedBase + sep)) {
          throw new Error("Path traversal detected!");
        }
      } else {
        stream = resolve(stream);
      }
      config.ContentType = mime.getType(stream) || config.ContentType;
      this._2["Content-Disposition"] = `inline; filename="${
        stream.split("/").at(-1) || "unnamed.bin"
      }"`;
      if (runtime["bun"]) {
        stream = Bun.file(stream);
      } else if (runtime["deno"]) {
        // @ts-expect-error
        const file = Deno.open(stream).catch(() => {});
        stream = file;
      } else {
        stream = createReadStream(resolve(stream) as string, {
          autoClose: true,
        });
      }
    }

    this._2["Content-Type"] = config.ContentType;
    this._3 = stream as Stream;
  }
  download(
    stream: string | BunFile,
    config: {
      folder?: string;
      ContentType: string;
    } = {
      folder: undefined,
      ContentType: "application/octet-stream",
    },
  ) {
    this.sendStream(stream, config);
    this._2["Content-Disposition"] = `attachment; filename="${
      (stream as string).split("/").at(-1) || "unnamed.bin"
    }"`;
  }
  // Only for deno and bun
  sendResponse(Response?: Response) {
    if (!runtime["node"]) {
      // @ts-ignore
      this._6 = Response;
    }
  }
  // Only for deno and bun
  upgrade(): void | never {
    const req = this.request as any;
    const conn = req.headers?.["connection"] ||
      req.headers?.get?.("connection");
    if (conn?.includes("Upgrade")) {
      if (this.get("upgrade") != "websocket") {
        throw new Error("Invalid upgrade header");
      }
      if (runtime["deno"]) {
        // @ts-expect-error
        const { socket, response } = Deno.upgradeWebSocket(req);
        // @ts-expect-error
        socket.addEventListener("open", (...p) => {
          JetSocketInstance.__binder("open", [socket, ...p]);
        });
        // @ts-expect-error
        socket.addEventListener("message", (...p) => {
          JetSocketInstance.__binder("message", [socket, ...p]);
        });
        // @ts-expect-error
        socket.addEventListener("drain", (...p) => {
          JetSocketInstance.__binder("drain", [socket, ...p]);
        });
        // @ts-expect-error
        socket.addEventListener("close", (...p) => {
          JetSocketInstance.__binder("close", [socket, ...p]);
        });
        this.connection = JetSocketInstance;
        return this.sendResponse(response);
      }
      if (runtime["bun"]) {
        if (this.res?.upgrade?.(req)) {
          this.connection = JetSocketInstance;
          return this.sendResponse(undefined);
        }
      }
      if (runtime["node"]) {
        throw new Error(
          "No current websocket support for Nodejs! run with bun or deno.",
        );
      }
    }
    throw new Error("Invalid upgrade headers");
  }

  async parse<Type extends any = Record<string, any>>(options?: {
    maxBodySize?: number;
    contentType?: string;
  }): Promise<Type> {
    if (this.body) {
      return this.body as Promise<Type>;
    }
    this.body = await parseRequest(this.request, options) as Promise<Type>;
    //? validate body
    if (this.handler!.body) {
      this.body = validator(this.handler!.body, this.body);
    }
    //? validate query
    if (this.handler!.query && this.query) {
      this.query = validator(this.handler!.query, this.query);
    }
    return this.body as Promise<Type>;
  }
}

export class JetSocket {
  private listeners: Record<string, Function | null> = {
    "message": null,
    "close": null,
    "drain": null,
    "open": null,
  };
  addEventListener(
    event: "message" | "close" | "drain" | "open",
    listener: (...param: any[]) => void,
  ): void {
    this.listeners[event] = listener as never;
  }
  /**
   * @internal
   */
  __binder(eventName: "message" | "close" | "drain" | "open", data: any) {
    if (this.listeners[eventName]) {
      this.listeners[eventName]?.(...data);
    }
  }
}

/**
 * Schema builder classes
 */
export class SchemaBuilder {
  protected def: SchemaDefinition;

  constructor(type: SchemaType, options: ValidationOptions = {}) {
    this.def = { type, required: false, ...options };
  }

  required(err?: string): this {
    this.def.required = true;
    if (err) this.def.err = err;
    return this;
  }

  optional(err?: string): this {
    this.def.required = false;
    if (err) this.def.err = err;
    return this;
  }

  default(value: any): this {
    this.def.inputDefaultValue = value;
    return this;
  }

  validate(fn: (value: any) => boolean | string): this {
    this.def.validator = fn;
    return this;
  }

  regex(pattern: RegExp, err?: string): this {
    this.def.RegExp = pattern;
    if (err) this.def.err = err;
    return this;
  }

  getDefinition(): SchemaDefinition {
    return this.def;
  }
}

export class StringSchema extends SchemaBuilder {
  constructor(options: ValidationOptions = {}) {
    // @ts-expect-error
    options.inputType = "string";
    super("string", options);
  }

  email(err?: string): this {
    return this.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, err || "Invalid email");
  }

  min(length: number, err?: string): this {
    return this.validate(
      (value) => value.length >= length || err || `Minimum length is ${length}`,
    );
  }

  max(length: number, err?: string): this {
    return this.validate(
      (value) => value.length <= length || err || `Maximum length is ${length}`,
    );
  }

  url(err?: string): this {
    return this.regex(
      /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
      err || "Invalid URL",
    );
  }
}

export class NumberSchema extends SchemaBuilder {
  constructor(options: ValidationOptions = {}) {
    // @ts-expect-error
    options.inputType = "number";
    super("number", options);
  }

  min(value: number, err?: string): this {
    return this.validate(
      (val) => val >= value || err || `Minimum value is ${value}`,
    );
  }

  max(value: number, err?: string): this {
    return this.validate(
      (val) => val <= value || err || `Maximum value is ${value}`,
    );
  }

  integer(err?: string): this {
    return this.validate(
      (val) => Number.isInteger(val) || err || "Must be an integer",
    );
  }

  positive(err?: string): this {
    return this.validate((val) => val > 0 || err || "Must be positive");
  }

  negative(err?: string): this {
    return this.validate((val) => val < 0 || err || "Must be negative");
  }
}

export class BooleanSchema extends SchemaBuilder {
  constructor() {
    super("boolean");
  }
}

export class ArraySchema extends SchemaBuilder {
  constructor(elementSchema?: SchemaBuilder) {
    super("array");
    if (elementSchema) {
      const elementDef = elementSchema.getDefinition();
      if (elementDef.type === "object" && elementDef.objectSchema) {
        this.def.arrayType = "object";
        this.def.objectSchema = elementDef.objectSchema;
      } else {
        this.def.arrayType = elementDef.type;
      }
    }
  }

  min(length: number, err?: string): this {
    return this.validate(
      (value) =>
        (Array.isArray(value) && value.length >= length) ||
        err ||
        `Minimum length is ${length}`,
    );
  }

  max(length: number, err?: string): this {
    return this.validate(
      (value) =>
        (Array.isArray(value) && value.length <= length) ||
        err ||
        `Maximum length is ${length}`,
    );
  }

  nonempty(err?: string): this {
    return this.min(1, err || "Array cannot be empty");
  }
}

export class ObjectSchema extends SchemaBuilder {
  constructor(shape?: Record<string, SchemaBuilder>) {
    super("object");
    if (shape) {
      this.def.objectSchema = {};
      for (const [key, builder] of Object.entries(shape)) {
        this.def.objectSchema[key] = builder.getDefinition();
      }
    }
  }

  shape(shape: Record<string, SchemaBuilder>): this {
    this.def.objectSchema = {};
    for (const [key, builder] of Object.entries(shape)) {
      this.def.objectSchema[key] = builder.getDefinition();
    }
    return this;
  }
}

export class DateSchema extends SchemaBuilder {
  constructor() {
    super("date");
  }

  min(date: Date | string, err?: string): this {
    const minDate = new Date(date);
    return this.validate(
      (value) =>
        new Date(value) >= minDate || err || `Date must be after ${minDate}`,
    );
  }

  max(date: Date | string, err?: string): this {
    const maxDate = new Date(date);
    return this.validate(
      (value) =>
        new Date(value) <= maxDate || err || `Date must be before ${maxDate}`,
    );
  }

  future(err?: string): this {
    return this.validate(
      (value) =>
        new Date(value) > new Date() || err || "Date must be in the future",
    );
  }

  past(err?: string): this {
    return this.validate(
      (value) =>
        new Date(value) < new Date() || err || "Date must be in the past",
    );
  }
}

export class FileSchema extends SchemaBuilder {
  constructor(options: FileOptions = {}) {
    // @ts-expect-error
    options.inputType = "file";
    super("file", options as ValidationOptions);
  }

  maxSize(bytes: number, err?: string): this {
    return this.validate(
      (value) =>
        value.size <= bytes ||
        err ||
        `File size must be less than ${bytes} bytes`,
    );
  }

  mimeType(types: string | string[], err?: string): this {
    const allowedTypes = Array.isArray(types) ? types : [types];
    return this.validate(
      (value) =>
        allowedTypes.includes(value.mimeType) ||
        err ||
        `File type must be one of: ${allowedTypes.join(", ")}`,
    );
  }
}

export class SchemaCompiler {
  static compile(
    schema: Record<string, SchemaBuilder>,
  ): HTTPBody<any> {
    const compiled: Record<string, SchemaDefinition> = {};
    for (const [key, builder] of Object.entries(schema)) {
      compiled[key] = builder.getDefinition();
    }
    return compiled as HTTPBody<any>;
  }
}

class TrieNode {
  // ? child nodes
  children: Map<any, any> = new Map();
  // ? parameter node
  parameterChild?: TrieNode;
  paramName?: string;
  // ? wildcard node
  wildcardChild?: TrieNode;
  // ? route handler
  handler?: JetRoute;
  constructor() {
    this.parameterChild = undefined;
    this.paramName = undefined;
    this.wildcardChild = undefined;
    this.handler = undefined;
  }
}

/**
 * Represents the Trie data structure for storing and matching URL routes.
 */
export class Trie {
  root: TrieNode;
  method: string;
  hashmap: Record<string, JetRoute> = {};
  constructor(
    method:
      | "GET"
      | "POST"
      | "PUT"
      | "DELETE"
      | "PATCH"
      | "OPTIONS"
      | "HEAD"
      | "CONNECT"
      | "TRACE",
  ) {
    this.root = new TrieNode();
    this.method = method;
  }

  /**
   * Inserts a route path and its associated handler into the Trie.
   */
  insert(path: string, handler: JetRoute): void {
    // ? remove leading/trailing slashes, handle empty path
    if (!/(\*|:)+/.test(path)) {
      this.hashmap[path] = handler;
      return;
    }
    let normalizedPath = path.trim();
    if (normalizedPath.startsWith("/")) {
      normalizedPath = normalizedPath.slice(1);
    }
    if (normalizedPath.endsWith("/") && normalizedPath.length > 0) {
      normalizedPath = normalizedPath.slice(0, -1);
    }

    // ? Handle the root path explicitly
    if (normalizedPath === "") {
      if (this.root.handler) {
        LOG.log(
          `Warning: Duplicate route definition for path ${this.method} ${path}`,
          "warn",
        );
      }
      this.root.handler = handler;
      return;
    }

    const segments = normalizedPath.split("/");
    let currentNode: TrieNode = this.root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // ? Check for parameter segment (starts with :)
      if (segment.startsWith(":")) {
        const paramName = segment.slice(1);
        if (!paramName) {
          throw new Error(
            `Invalid route path: Parameter segment in ${this.method} ${path} '${segment}' is missing a name.`,
          );
        }

        // ? Check if a parameter node already exists at this level
        if (currentNode.parameterChild) {
          if (currentNode.parameterChild.paramName !== paramName) {
            LOG.log(
              `Warning: Route path conflict at segment '${segment}' in ${this.method} ${path}. Parameter ': ${currentNode.parameterChild.paramName}' already defined at this level.`,
              "warn",
            );
          }
          currentNode = currentNode.parameterChild;
        } else if (currentNode.children.has(segment)) {
          throw new Error(
            `Route path conflict: Fixed segment '${segment}' already exists at this level in ${this.method} ${path}.`,
          );
        } else if (currentNode.wildcardChild) {
          throw new Error(
            `Invalid route path: Parameter segment '${segment}' cannot follow a wildcard '*' at the same level in ${this.method} ${path}.`,
          );
        } else {
          const newNode = new TrieNode();
          newNode.paramName = paramName;
          currentNode.parameterChild = newNode;
          currentNode = newNode;
        }
      } // ? Check for wildcard segment (*) - typically only allowed at the end
      else if (segment === "*") {
        if (i !== segments.length - 1) {
          throw new Error(
            `Invalid route path: Wildcard '*' is only allowed at the end of a path pattern in ${this.method} ${path}.`,
          );
        }
        if (currentNode.wildcardChild) {
          LOG.log(
            `Warning: Duplicate wildcard definition at segment '${segment}' in ${this.method} ${path}.`,
            "warn",
          );
          currentNode = currentNode.wildcardChild;
        } else if (currentNode.parameterChild) {
          throw new Error(
            `Invalid route path: Wildcard '*' cannot follow a parameter at the same level in ${this.method} ${path}.`,
          );
        } else if (currentNode.children.has(segment)) {
          throw new Error(
            `Route path conflict: Fixed segment '${segment}' already exists at this level in ${this.method} ${path}.`,
          );
        } else {
          const newNode = new TrieNode();
          currentNode.wildcardChild = newNode;
          currentNode = newNode;
        }
        //? No need to process further segments after a wildcard
        break;
      } //? Handle fixed segment
      else {
        if (currentNode.parameterChild) {
          throw new Error(
            `Route path conflict: Fixed segment '${segment}' conflicts with existing parameter ': ${currentNode.parameterChild.paramName}' at this level in ${this.method} ${path}.`,
          );
        }
        if (currentNode.wildcardChild) {
          throw new Error(
            `Route path conflict: Fixed segment '${segment}' conflicts with existing wildcard '*' at this level in ${this.method} ${path}.`,
          );
        }

        // Check if the fixed child node already exists
        if (!currentNode.children.has(segment)) {
          // Create a new node for the fixed segment
          currentNode.children.set(segment, new TrieNode());
        }
        // Move to the next node
        currentNode = currentNode.children.get(segment)!;
      }
    }
    if (currentNode.handler) {
      LOG.log(
        `Warning: Duplicate route definition for path '${path}'.`,
        "warn",
      );
    }
    //? Set the handler and original path
    currentNode.handler = handler;
  }

  get_responder(req: IncomingMessage | Request, res: any):
    | Context
    | undefined {
    let normalizedPath = req.url!;
    // ? Handle absolute paths in non-node environments
    if (!isNode) {
      const pathStart = normalizedPath.indexOf("/", 7);
      normalizedPath = pathStart >= 0
        ? normalizedPath.slice(pathStart)
        : normalizedPath;
    }
    // ? Check if route is cached
    if (this.hashmap[normalizedPath]) {
      return getCtx(
        req,
        res,
        normalizedPath,
        this.hashmap[normalizedPath]!,
      );
    }
    let query: Record<string, string> | undefined;
    //? Handle query parameters
    const queryIndex = normalizedPath.indexOf("?");
    if (queryIndex > -1) {
      // ? Extract query parameters
      const queryParams = new URLSearchParams(normalizedPath.slice(queryIndex));
      query = {};
      queryParams.forEach((value, key) => {
        query![key] = value;
      });
      normalizedPath = normalizedPath.slice(0, queryIndex);
      if (this.hashmap[normalizedPath]) {
        return getCtx(
          req,
          res,
          normalizedPath,
          this.hashmap[normalizedPath]!,
          undefined,
          query,
        );
      }
    }
    // ? Handle leading and trailing slashes
    if (normalizedPath.startsWith("/")) {
      normalizedPath = normalizedPath.slice(1);
    }
    // ? Handle trailing slash
    if (normalizedPath.endsWith("/") && normalizedPath.length > 0) {
      normalizedPath = normalizedPath.slice(0, -1);
    }
    // ? Handle empty path
    if (normalizedPath === "") {
      if (this.root.handler) {
        return getCtx(
          req,
          res,
          normalizedPath,
          this.root.handler,
          undefined,
          query,
        );
      }
    }
    let currentNode = this.root;
    const params: Record<string, string> = {};
    const segments = normalizedPath.split("/");
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (currentNode.children.has(segment)) {
        // ? fixed segment match
        currentNode = currentNode.children.get(segment)!;
      } else if (currentNode.parameterChild) {
        // ? parameter segment match
        const name = currentNode.parameterChild.paramName!;
        params[name] = segment;
        currentNode = currentNode.parameterChild;
      } else if (currentNode.wildcardChild) {
        // ? wildcard segment match
        params["*"] = segments.slice(i).join("/");
        currentNode = currentNode.wildcardChild;
        break;
      } else {
        // ? No match
        return undefined;
      }
    }
    if (currentNode.handler) {
      // ? Route found
      return getCtx(
        req,
        res,
        normalizedPath,
        currentNode.handler,
        params,
        query,
      );
    }
  }
}

class MockRequest {
  method: string;
  url: string;
  headers: Map<string, string>;
  body: string | null;
  statusCode: number;
  statusMessage: string;
  bodyUsed: boolean;

  constructor(
    options: {
      method?: string;
      url?: string;
      headers?: any;
      body?: string | null;
    } = {},
  ) {
    this.method = options.method || "GET";
    this.url = options.url || "/";
    this.headers = options.headers || new Map();
    this.body = options.body || null;
    this.statusCode = 200;
    this.statusMessage = "OK";
    this.bodyUsed = false;
  }
}

export class JetMockServer {
  options: jetOptions = {};
  constructor(options?: jetOptions) {
    Object.assign(this.options, options || {});
  }
  /*
  internal method
  */
  async _run(
    func: JetRoute,
    ctx?: JetContext<any, any>,
  ): Promise<{ code: number; body: any; headers: Record<string, string> }> {
    let returned: (Function | void)[] | undefined;
    const r = func;
    if (!ctx) {
      ctx = getCtx(
        new MockRequest({
          method: r.method!,
          url: r.path!,
          headers: new Map(),
          body: null,
        }) as any,
        {},
        r.path!,
        r,
        {},
        {},
      ) as any;
    }
    try {
      //? pre-request middlewares here
      returned = r.jet_middleware?.length
        ? await Promise.all(r.jet_middleware.map((m) => m(ctx as any)))
        : undefined;
      //? route handler call
      await r(ctx as any);
      //? post-request middlewares here
      returned && await Promise.all(returned.map((m) => m?.(ctx, null)));
      //
    } catch (error) {
      console.log(error);
      try {
        //? report error to error middleware
        returned && await Promise.all(returned.map((m) => m?.(ctx, error)));
      } finally {
        if (!returned && ctx!.code < 400) {
          ctx!.code = 500;
        }
        //
      }
    }
    return {
      code: ctx!.code,
      body: typeof ctx!.payload !== "string"
        ? ctx!.payload
        : JSON.parse(ctx!.payload),
      headers: ctx!._2!,
    };
  }
  runBare(
    func: JetRoute,
  ): Promise<{ code: number; body: any; headers: Record<string, string> }> {
    return this._run(func);
  }
  runWithCtx(
    func: JetRoute,
    ctx: JetContext<any, any>,
  ): Promise<{ code: number; body: any; headers: Record<string, string> }> {
    return this._run(func, ctx);
  }
}
