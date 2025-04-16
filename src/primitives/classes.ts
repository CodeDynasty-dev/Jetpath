import { createReadStream } from "node:fs";
import { IncomingMessage } from "node:http";
import { Stream } from "node:stream";
import { _DONE, _JetPath_paths, _OFF, parseRequest, UTILS, validator } from "./functions.js";
import type {
  JetPluginExecutor,
  JetPluginExecutorInitParams,
  methods,
} from "./types.js";

export class JetPlugin {
  JetPathServer?: any;
  hasServer?: boolean;
  executor: JetPluginExecutor;
  constructor({ executor }: { executor: JetPluginExecutor }) {
    this.executor = executor;
  }
  _setup(init: JetPluginExecutorInitParams): any {
    return this.executor.call(this, init);
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
  _2?: Record<string, string> = {};
  // //? stream
  _3?: Stream = undefined;
  //? used to know if the request has ended
  _4 = false;
  //? used to know if the request has been offloaded
  _5: any = false;
  //? response
  _6 = false;
  method: methods | undefined;
  // ? reset the COntext to default state
  _7(
    req: Request,
    path: string,
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
    //? used to know if the request has ended
    this._4 = false;
    //? used to know if the request has been offloaded
    this._5 = false;
    //? custom response
    this._6 = false;
    // ? code
    this.code = 200;
  }

  send(data: unknown, contentType?: string) {
    let ctype;
    switch (typeof data) {
      case "string":
        ctype = "text/plain";
        this._1 = data;
        break;
      case "object":
        ctype = "application/json";
        this._1 = JSON.stringify(data);
        break;
      default:
        ctype = "text/plain";
        this._1 = data ? String(data) : "";
        break;
    }
    if (contentType) {
      ctype = contentType;
    }
    if (!this._2) {
      this._2 = {};
    }
    this._2["Content-Type"] = ctype;
    this._4 = true;
    if (!this._5) throw _DONE;
    this._5();
    return undefined as never;
  }

  validate(data: any = this.body || {}) {
    return validator(
      _JetPath_paths[this.method!].direct[this.path!]?.body ||
        _JetPath_paths[this.method!].parameter[this.path!]?.body ||
        _JetPath_paths[this.method!].wildcard[this.path!]?.body ||
        _JetPath_paths[this.method!].query[this.path!]?.body,
      data,
    );
  }

  redirect(url: string) {
    this.code = 301;
    if (!this._2) {
      this._2 = {};
    }
    this._2["Location"] = url;
    this._1 = undefined;
    this._4 = true;
    if (!this._5) throw _DONE;
    this._5();
    return undefined as never;
  }

  throw(code: unknown = 404, message: unknown = "Not Found") {
    // ? could be a success but a wrong throw, so we check
    if (!this._2) {
      this._2 = {};
    }
    if (!this._4) {
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
    this._4 = true;
    if (!this._5) throw _DONE;
    this._5();
    return undefined as never;
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
    if (!this._2) {
      this._2 = {};
    }
    if (field && value) {
      this._2[field] = value;
    }
  }

  eject(): never {
    throw _OFF;
  }

  sendStream(stream: Stream | string, ContentType: string) {
    if (!this._2) {
      this._2 = {};
    }
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
        stream = createReadStream(stream as string, { autoClose: true });
      }
    }

    this._2["Content-Type"] = ContentType;
    this._3 = stream as Stream;
    this._4 = true;
    if (!this._5) throw _DONE;
    this._5();
    return undefined as never;
  }
  // Only for deno and bun
  sendResponse(Response?: Response) {
    // @ts-ignore
    this._6 = Response;
    this._4 = true;
    if (!this._5) throw _DONE;
    this._5();
    return undefined as never;
  }

  async parse<Type extends any = Record<string, any>>(): Promise<Type> {
    if (this.body) {
      return this.body as Promise<Type>;
    }
    return parseRequest(this.request, {}) as Promise<Type>; 
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
