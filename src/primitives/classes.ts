import { createReadStream } from "node:fs";
import { IncomingMessage } from "node:http";
import { Stream } from "node:stream";
import {
  _JetPath_paths,
  isNode,
  JetSocketInstance,
  parseRequest,
  UTILS,
  validator,
} from "./functions.js";
import type {
  AnyExecutor,
  FileOptions,
  HTTPBody,
  JetFunc,
  JetPluginExecutorInitParams,
  methods,
  SchemaDefinition,
  SchemaType,
  ValidationOptions,
} from "./types.js";
import { resolve } from "node:path";

export class JetPlugin<
  C extends Record<string, unknown> = Record<string, unknown>,
  E extends AnyExecutor = AnyExecutor,
> {
  executor: E;
  JetPathServer?: any;
  hasServer?: boolean;
  config: C = {} as C;
  constructor({ executor }: { executor: E }) {
    this.executor = executor;
  }
  _setup(init: JetPluginExecutorInitParams): any {
    return this.executor.call(this, init, this.config);
  }
  setConfig(config: C): void {
    this.config = config;
  }
}

export class Log {
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
    console.log(`${color}%s${Log.colors.reset}`, `${message}`);
  }

  static info(message: string) {
    Log.print(message, Log.colors.fgBlue);
  }

  static warn(message: string) {
    Log.print(message, Log.colors.fgYellow);
  }

  static error(message: string) {
    Log.print(message, Log.colors.fgRed);
  }

  static success(message: string) {
    Log.print(message, Log.colors.fgGreen);
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
  public get value(): Record<string, any> {
    if (this.state["__state__"] === true) {
      for (const key in this.state) {
        delete this.state[key];
      }
      this.state["__state__"] = false;
    }
    return this.state;
  }
  public set value(value: Record<string, any>) {
    if (this.state["__state__"] === true) {
      for (const key in this.state) {
        delete this.state[key];
      }
      this.state["__state__"] = false;
    }
    this.state = value;
  }
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
  get plugins() {
    return UTILS.plugins;
  }
  // ? state
 get state() : Record<string, any> {
   return this._7.value;
 }
 set state(value: Record<string, any>) {
   this._7.value = value;
  }
  //? load
  _1?: string = undefined;
  // ? header of response
  _2: Record<string, string> = {};
  // //? stream
  _3?: Stream = undefined;
  //? used to know if the request has been offloaded
  _5: JetFunc | null = null;
  //? response
  _6: boolean = false;
  //? original response
  _7: ctxState = new ctxState();
  res?: any;
  send(data: unknown, contentType?: string) {
    if (contentType) {
      this._2["Content-Type"] = contentType;
      this._1 = String(data);
    } else {
      switch (typeof data) {
        case "string":
          this._2["Content-Type"] = "text/plain";
          this._1 = data;
          break;
        case "object":
          this._2["Content-Type"] = "application/json";
          this._1 = JSON.stringify(data);
          break;
        default:
          this._2["Content-Type"] = "text/plain";
          this._1 = data ? String(data) : "";
          break;
      }
    }
  }

  redirect(url: string) {
    this.code = 301;
    this._2["Location"] = url;
  }

  throw(code: unknown = 404, message: unknown = "Not Found"): never {
    if (typeof code !== "number") {
      this.code = 400;
      this.send(code);
    } else {
      this.code = code;
      this.send(message);
    }
    throw new Error(this._1);
  }

  get(field: string) {
    if (field) {
      if (UTILS.runtime["node"]) {
        // @ts-expect-error
        return this.request.headers[field] as string;
      }
      return (this.request as unknown as Request).headers.get(field) as string;
    }
    return undefined;
  }

  set(field: string, value: string) {
    if (field && value) {
      this._2[field] = value;
    }
  }

  getCookie(name: string): string | undefined {
    const cookieHeader = UTILS.runtime["node"]
      ? (this.request as IncomingMessage).headers.cookie
      : (this.request as Request).headers.get("cookie");

    if (cookieHeader) {
      const cookies = Cookie.parse(cookieHeader);
      return cookies[name];
    }
    return undefined;
  }

  getCookies(): Record<string, string> {
    const cookieHeader = UTILS.runtime["node"]
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

  sendStream(stream: Stream | string, ContentType: string) {
    if (typeof stream === "string") {
      this._2["Content-Disposition"] = `inline; filename="${
        stream.split("/").at(-1) || "unnamed.bin"
      }"`;
      if (UTILS.runtime["bun"]) {
        // @ts-expect-error
        stream = Bun.file(stream);
      } else if (UTILS.runtime["deno"]) {
        // @ts-expect-error
        const file = Deno.open(stream).catch(() => {});
        stream = file;
      } else {
        stream = createReadStream(resolve(stream) as string, {
          autoClose: true,
        });
      }
    }

    this._2["Content-Type"] = ContentType;
    this._3 = stream as Stream;
  }

  // Only for deno and bun
  sendResponse(Response?: Response) {
    // @ts-ignore
    this._6 = Response;
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
      if (UTILS.runtime["deno"]) {
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
      if (this.res?.upgrade?.(req)) {
        this.connection = JetSocketInstance;
        return this.sendResponse(undefined);
      }
      this.throw(400);
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
    if (this._5!.body) {
      this.body = validator(this._5!.body, this.body);
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
  handler?: JetFunc;
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
  hashmap: Record<string, JetFunc> = {};
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
  insert(path: string, handler: JetFunc): void {
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
        console.warn(
          `Warning: Duplicate route definition for path ${this.method} ${path}`,
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
            console.warn(
              `Warning: Route path conflict at segment '${segment}' in ${this.method} ${path}. Parameter ': ${currentNode.parameterChild.paramName}' already defined at this level.`,
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
          console.warn(
            `Warning: Duplicate wildcard definition at segment '${segment}' in ${this.method} ${path}.`,
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
      console.warn(
        `Warning: Duplicate route definition for path '${path}'.`,
      );
    }
    //? Set the handler and original path
    currentNode.handler = handler;
  }

  get_responder(path: string):
    | [JetFunc, Record<string, any>, Record<string, any>, string]
    | undefined {
    let normalizedPath = path;
    // ? Handle absolute paths in non-node environments
    if (!isNode) {
      const pathStart = normalizedPath.indexOf("/", 7);
      normalizedPath = pathStart >= 0
        ? normalizedPath.slice(pathStart)
        : normalizedPath;
    }
    // ? Check if route is cached
    if (this.hashmap[normalizedPath]) {
      return [this.hashmap[normalizedPath]!, {}, {}, path];
    }
    const query: Record<string, string> = {};
    //? Handle query parameters
    const queryIndex = normalizedPath.indexOf("?");
    if (queryIndex > -1) {
      // ? Extract query parameters
      const queryParams = new URLSearchParams(normalizedPath.slice(queryIndex));
      queryParams.forEach((value, key) => {
        query[key] = value;
      });
      normalizedPath = normalizedPath.slice(0, queryIndex);
      if (this.hashmap[normalizedPath]) {
        return [this.hashmap[normalizedPath]!, {}, query, path];
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
        return [this.root.handler, {}, query, path];
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
      return [currentNode.handler, params, query, path];
    }
  }
}
