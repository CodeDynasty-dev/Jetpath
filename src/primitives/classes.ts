import { createReadStream } from "node:fs";
import { IncomingMessage } from "node:http";
import { Stream } from "node:stream";
import { _JetPath_paths, parseRequest, UTILS, validator } from "./functions.js";
import type {
  AnyExecutor,
  JetFunc,
  JetPluginExecutorInitParams,
  methods,
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
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  expires?: Date;
}

class Cookie {
  private static parseCookieHeader(header: string): Record<string, string> {
    return header
      .split('; ')
      .map(pair => pair.split('='))
      .reduce((acc, [key, value]) => ({
        ...acc,
        [key.trim()]: value ? decodeURIComponent(value) : '',
      }), {});
  }

  private static serializeCookie(name: string, value: string, options: CookieOptions): string {
    const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

    if (options.path) parts.push(`Path=${encodeURIComponent(options.path)}`);
    if (options.domain) parts.push(`Domain=${encodeURIComponent(options.domain)}`);
    if (options.secure) parts.push('Secure');
    if (options.httpOnly) parts.push('HttpOnly');
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
    if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
    if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);

    return parts.join('; ');
  }

  static parse(cookies: string): Record<string, string> {
    return Cookie.parseCookieHeader(cookies);
  }

  static serialize(name: string, value: string, options: CookieOptions = {}): string {
    return Cookie.serializeCookie(name, value, options);
  }
}

export class Context {
  code = 200;
  request: Request | IncomingMessage | undefined;
  params: Record<string, any> | undefined;
  query: Record<string, any> | undefined;
  body: Record<string, any> | undefined;
  path: string | undefined;
  connection?: JetSocket;
  plugins = {};
  // ?
  app: Record<string, any> = {};
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
  method: methods | undefined;
  // ? reset the COntext to default state
  _7(
    req: Request,
    path: string,
    route: JetFunc,
    params?: Record<string, any>,
    query?: Record<string, any>,
  ) {
    this.request = req;
    this.method = req.method as "GET";
    this.params = params || {};
    this.query = query || {};
    this.path = path;
    this.body = undefined;
    //? load
    this._1 = undefined;
    // ? header of response
    this._2 = {};
    // //? stream
    this._3 = undefined;
    //? the route handler
    this._5 = route;
    //? custom response
    this._6 = false;
    // ? code
    this.code = 200;
  }

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

  throw(code: unknown = 404, message: unknown = "Not Found") {
    this.code = 400;
    switch (typeof code) {
      case "number":
        this.code = code;
        if (typeof message === "object") {
          this._2["Content-Type"] = "application/json";
          this._1 = JSON.stringify(message);
        } else if (typeof message === "string") {
          this._2["Content-Type"] = "text/plain";
          this._1 = message;
        }
        break;
      case "string":
        this._2["Content-Type"] = "text/plain";
        this._1 = code;
        break;
      case "object":
        this._2["Content-Type"] = "application/json";
        this._1 = JSON.stringify(code);
        break;
    } 
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
      : (this.request as Request).headers.get('cookie');
    
    if (cookieHeader) {
      const cookies = Cookie.parse(cookieHeader);
      return cookies[name];
    }
    return undefined;
  }

  getCookies(): Record<string, string> {
    const cookieHeader = UTILS.runtime["node"] 
      ? (this.request as IncomingMessage).headers.cookie 
      : (this.request as Request).headers.get('cookie');
    
    return cookieHeader ? Cookie.parse(cookieHeader) : {};
  }

  setCookie(name: string, value: string, options: CookieOptions = {}): void {
    const cookie = Cookie.serialize(name, value, options);
    const existingCookies = this._2['set-cookie'] || '';
    const cookies = existingCookies ? existingCookies.split(',').map(c => c.trim()) : [];
    cookies.push(cookie);
    this._2['set-cookie'] = cookies.join(', ');
  }

  clearCookie(name: string, options: CookieOptions = {}): void {
    this.setCookie(name, '', { ...options, maxAge: 0 });
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
    // validate here;
    return this.body as Promise<Type>;
  }
}

export class JetSocket {
  private listeners = { "message": [], "close": [], "drain": [], "open": [] };
  addEventListener(
    event: "message" | "close" | "drain" | "open",
    listener: (...param: any[]) => void,
  ): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener as never);
  }
  /**
   * @internal
   */
  __binder(eventName: "message" | "close" | "drain" | "open", data: any) {
    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach((listener: any) => {
        listener(...data);
      });
    }
  }
}
