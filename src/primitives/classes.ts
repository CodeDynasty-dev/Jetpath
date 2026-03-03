import { type IncomingMessage } from 'node:http';
import { type Stream } from 'node:stream';
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
} from './types.js';
import { mime } from '../extracts/mimejs-extract.js';
import type { BunFile } from 'bun';
import { getCtx, runtime, ctxPool } from './trie-router.js';
import { parseRequest } from './parser.js';
import { optionsCtx } from './cors.js';
import { validator } from './validator.js';
import { fs } from './fs.js';
import { abstractPluginCreator } from './plugins.js';

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
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',

    fgBlack: '\x1b[30m',
    fgRed: '\x1b[31m',
    fgGreen: '\x1b[32m',
    fgYellow: '\x1b[33m',
    fgBlue: '\x1b[34m',
    fgMagenta: '\x1b[35m',
    fgCyan: '\x1b[36m',
    fgWhite: '\x1b[37m',

    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m',
  };
  static print(message: any, color: string) {
    console.log(`${color}%s${LOG.colors.reset}`, `${message}`);
  }
  static log(message: string, type: 'info' | 'warn' | 'error' | 'success') {
    LOG.print(
      message,
      type === 'info'
        ? LOG.colors.fgBlue
        : type === 'warn'
          ? LOG.colors.fgYellow
          : type === 'success'
            ? LOG.colors.fgGreen
            : LOG.colors.fgRed
    );
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
      .map((pair) => pair.split('='))
      .reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key.trim()]: value ? decodeURIComponent(value) : '',
        }),
        {}
      );
  }

  private static serializeCookie(
    name: string,
    value: string,
    options: CookieOptions
  ): string {
    const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

    if (options.path) parts.push(`Path=${encodeURIComponent(options.path)}`);
    if (options.domain) {
      parts.push(`Domain=${encodeURIComponent(options.domain)}`);
    }
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

  static serialize(
    name: string,
    value: string,
    options: CookieOptions = {}
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
  /**
   * @internal
   */
  $_internal_query: Record<string, any> | undefined;
  /**
   * @internal
   */
  $_internal_body?: Record<string, any>;
  /**
   * @internal
   * Cached validated body to avoid double validation
   */
  $_internal_validated_body?: any;
  path: string | undefined;
  connection?: JetSocket;
  method: methods | undefined;
  handler: JetRoute | null = null;
  __jet_pool = true;
  plugins: Record<string, Function>;
  // ? state
  get state(): Record<string, any> {
    return this._7.state;
  }
  //? load
  payload?: string = undefined;
  // ? header of response
  _2: Record<string, string> = {};
  // //? stream
  _3?: Stream = undefined;
  //? response
  _6 = false;
  //? original response
  res?: any;
  //? state
  _7: ctxState;
  constructor() {
    this.plugins = abstractPluginCreator(this);
    this._7 = new ctxState();
  }
  send(
    data: unknown,
    statusCode?: number,
    contentType?: string,
    validate = true
  ) {
    if (this._6 || this._3) {
      throw new Error('Response already set');
    }
    if (this.handler!.response && validate) {
      data = validator(this.handler!.response, data || {});
      if (typeof data === 'string') {
        throw new Error(data);
      }
    }
    if (contentType) {
      this._2['Content-Type'] = contentType;
      this.payload = String(data);
      if (statusCode) this.code = statusCode;
    } else {
      if (typeof data === 'object') {
        this._2['Content-Type'] = 'application/json';
        this.payload = JSON.stringify(data);
      } else {
        this.payload = data ? String(data) : '';
      }
      if (statusCode) this.code = statusCode;
    }
  }

  redirect(url: string) {
    this.code = 301;
    this._2['Location'] = url;
  }

  get(field: string) {
    if (field) {
      if (runtime['node']) {
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
    const cookieHeader = runtime['node']
      ? (this.request as IncomingMessage).headers.cookie
      : (this.request as Request).headers.get('cookie');

    if (cookieHeader) {
      const cookies = Cookie.parse(cookieHeader);
      return cookies[name];
    }
    return undefined;
  }

  getCookies(): Record<string, string> {
    const cookieHeader = runtime['node']
      ? (this.request as IncomingMessage).headers.cookie
      : (this.request as Request).headers.get('cookie');

    return cookieHeader ? Cookie.parse(cookieHeader) : {};
  }

  setCookie(name: string, value: string, options: CookieOptions = {}): void {
    const cookie = Cookie.serialize(name, value, options);
    const existingCookies = this._2['set-cookie'] || '';
    const cookies = existingCookies
      ? existingCookies.split(',').map((c) => c.trim())
      : [];
    cookies.push(cookie);
    this._2['set-cookie'] = cookies.join(', ');
  }

  clearCookie(name: string, options: CookieOptions = {}): void {
    this.setCookie(name, '', { ...options, maxAge: 0 });
  }

  sendStream(
    stream: Stream | string | BunFile,
    config: {
      folder?: string;
      ContentType: string;
    } = {
      folder: undefined,
      ContentType: 'application/octet-stream',
    }
  ) {
    if (typeof stream === 'string') {
      const filePath = stream;

      if (config.folder) {
        // Resolve paths
        const resolvedPath = fs().resolve(config.folder, filePath);
        const resolvedBase = fs().resolve(config.folder);

        // Security: Check for path traversal using path resolution
        // This is safer than string comparison
        const relativePath = fs().relative(resolvedBase, resolvedPath);

        if (relativePath.startsWith('..') || fs().isAbsolute(relativePath)) {
          throw new Error('Path traversal detected!');
        }

        stream = resolvedPath;
      } else {
        // If no folder is specified, require absolute path for security
        if (!fs().isAbsolute(filePath)) {
          throw new Error(
            'File path must be absolute when no folder is specified'
          );
        }
        stream = fs().resolve(filePath);
      }

      config.ContentType = mime.getType(stream) || config.ContentType;
      this._2['Content-Disposition'] = `inline; filename="${
        stream.split('/').at(-1) || 'unnamed.bin'
      }"`;

      if (runtime['bun']) {
        stream = Bun.file(stream);
      } else if (runtime['deno']) {
        // @ts-expect-error
        const file = Deno.open(stream).catch(() => {});
        stream = file;
      } else {
        stream = fs().createReadStream(stream as string, {
          autoClose: true,
        });
      }
    }

    this._2['Content-Type'] = config.ContentType;
    this._3 = stream as Stream;
  }
  download(
    stream: string | BunFile,
    config: {
      folder?: string;
      ContentType: string;
    } = {
      folder: undefined,
      ContentType: 'application/octet-stream',
    }
  ) {
    this.sendStream(stream, config);
    this._2['Content-Disposition'] = `attachment; filename="${
      (stream as string).split('/').at(-1) || 'unnamed.bin'
    }"`;
  }
  // Only for deno and bun
  sendResponse(Response?: Response) {
    if (!runtime['node']) {
      // @ts-ignore
      this._6 = Response;
    }
  }
  // Only for deno and bun
  upgrade(): void | never {
    const req = this.request as any;
    const conn =
      req.headers?.['connection'] || req.headers?.get?.('connection');
    if (conn?.includes('Upgrade')) {
      if (this.get('upgrade') !== 'websocket') {
        throw new Error('Invalid upgrade header');
      }
      if (runtime['deno']) {
        // @ts-expect-error
        const { socket, response } = Deno.upgradeWebSocket(req);
        // @ts-expect-error
        socket.addEventListener('open', (...p) => {
          JetSocketInstance.__binder('open', [socket, ...p]);
        });
        // @ts-expect-error
        socket.addEventListener('message', (...p) => {
          JetSocketInstance.__binder('message', [socket, ...p]);
        });
        // @ts-expect-error
        socket.addEventListener('drain', (...p) => {
          JetSocketInstance.__binder('drain', [socket, ...p]);
        });
        // @ts-expect-error
        socket.addEventListener('close', (...p) => {
          JetSocketInstance.__binder('close', [socket, ...p]);
        });
        this.connection = JetSocketInstance;
        return this.sendResponse(response);
      }
      if (runtime['bun']) {
        if (this.res?.upgrade?.(req)) {
          this.connection = JetSocketInstance;
          return this.sendResponse(undefined);
        }
      }
      if (runtime['node']) {
        throw new Error(
          'No current websocket support for Nodejs! run with bun or deno.'
        );
      }
    }
    throw new Error('Invalid upgrade headers');
  }

  async parse<Type extends any = Record<string, any>>(
    options: {
      maxBodySize?: number;
      maxFileSize?: number;
      contentType?: string;
      validate?: boolean;
    } = { validate: true }
  ): Promise<Type> {
    // Return cached validated body if available
    if (this.$_internal_validated_body && options.validate) {
      return this.$_internal_validated_body as Type;
    }

    // Return cached raw body if available and no validation needed
    if (this.$_internal_body && !options.validate) {
      return this.$_internal_body as Type;
    }

    // Parse request if not cached
    if (!this.$_internal_body) {
      this.$_internal_body = (await parseRequest(this.request, options)) as any;
    }

    // Validate body if needed and cache the result
    if (this.handler!.body && options.validate) {
      this.$_internal_validated_body = validator(
        this.handler!.body,
        this.$_internal_body
      ) as Type;
      return this.$_internal_validated_body as Type;
    }

    return this.$_internal_body as Type;
  }
  parseQuery<Type extends any = Record<string, any>>(
    options: {
      validate?: boolean;
    } = { validate: true }
  ): Type {
    // Return cached query if available
    if (this.$_internal_query) {
      return this.$_internal_query as Type;
    }

    const queryIndex = this.request?.url?.indexOf('?');
    if (queryIndex && queryIndex > -1) {
      const queryParams = new URLSearchParams(
        this.request?.url?.slice(queryIndex)
      );
      this.$_internal_query = {};

      for (const [key, value] of queryParams.entries()) {
        const path = key
          .replace(/\]/g, '')
          .split('[')
          .map((k) => k.trim());

        let curr = this.$_internal_query;
        for (let i = 0; i < path.length; i++) {
          const part = path[i];
          if (i === path.length - 1) {
            curr[part] = decodeURIComponent(value);
          } else {
            curr[part] ||= {};
            curr = curr[part];
          }
        }
      }

      if (this.handler?.query && options.validate) {
        this.$_internal_query = validator(
          this.handler.query,
          this.$_internal_query
        );
      }
    }

    return (this.$_internal_query || {}) as Type;
  }
}

export class JetSocket {
  private listeners: Record<string, Function | null> = {
    message: null,
    close: null,
    drain: null,
    open: null,
  };
  addEventListener(
    event: 'message' | 'close' | 'drain' | 'open',
    listener: (...param: any[]) => void
  ): void {
    this.listeners[event] = listener as never;
  }
  /**
   * @internal
   */
  __binder(eventName: 'message' | 'close' | 'drain' | 'open', data: any) {
    if (this.listeners[eventName]) {
      this.listeners[eventName]?.(...data);
    }
  }
}

export const JetSocketInstance = new JetSocket();

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
    options.inputType = 'string';
    super('string', options);
  }

  email(err?: string): this {
    return this.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, err || 'Invalid email');
  }

  min(length: number, err?: string): this {
    return this.validate(
      (value) => value.length >= length || err || `Minimum length is ${length}`
    );
  }

  max(length: number, err?: string): this {
    return this.validate(
      (value) => value.length <= length || err || `Maximum length is ${length}`
    );
  }

  url(err?: string): this {
    return this.regex(
      /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
      err || 'Invalid URL'
    );
  }
}

export class NumberSchema extends SchemaBuilder {
  constructor(options: ValidationOptions = {}) {
    // @ts-expect-error here inputType defaults to number
    options.inputType = 'number';
    super('number', options);
  }

  min(value: number, err?: string): this {
    return this.validate(
      (val) => val >= value || err || `Minimum value is ${value}`
    );
  }

  max(value: number, err?: string): this {
    return this.validate(
      (val) => val <= value || err || `Maximum value is ${value}`
    );
  }

  integer(err?: string): this {
    return this.validate(
      (val) => Number.isInteger(val) || err || 'Must be an integer'
    );
  }

  positive(err?: string): this {
    return this.validate((val) => val > 0 || err || 'Must be positive');
  }

  negative(err?: string): this {
    return this.validate((val) => val < 0 || err || 'Must be negative');
  }
}

export class BooleanSchema extends SchemaBuilder {
  constructor() {
    super('boolean');
  }
}

export class ArraySchema extends SchemaBuilder {
  constructor(elementSchema?: SchemaBuilder) {
    super('array');
    if (elementSchema) {
      const elementDef = elementSchema.getDefinition();
      if (elementDef.type === 'object' && elementDef.objectSchema) {
        this.def.arrayType = 'object';
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
        `Minimum length is ${length}`
    );
  }

  max(length: number, err?: string): this {
    return this.validate(
      (value) =>
        (Array.isArray(value) && value.length <= length) ||
        err ||
        `Maximum length is ${length}`
    );
  }

  nonempty(err?: string): this {
    return this.min(1, err || 'Array cannot be empty');
  }
}

export class ObjectSchema extends SchemaBuilder {
  constructor(shape?: Record<string, SchemaBuilder>) {
    super('object');
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
    super('date');
  }

  min(date: Date | string, err?: string): this {
    const minDate = new Date(date);
    return this.validate(
      (value) =>
        new Date(value) >= minDate || err || `Date must be after ${minDate}`
    );
  }

  max(date: Date | string, err?: string): this {
    const maxDate = new Date(date);
    return this.validate(
      (value) =>
        new Date(value) <= maxDate || err || `Date must be before ${maxDate}`
    );
  }

  future(err?: string): this {
    return this.validate(
      (value) =>
        new Date(value) > new Date() || err || 'Date must be in the future'
    );
  }

  past(err?: string): this {
    return this.validate(
      (value) =>
        new Date(value) < new Date() || err || 'Date must be in the past'
    );
  }
}

export class FileSchema extends SchemaBuilder {
  constructor(options: FileOptions = {}) {
    // @ts-expect-error
    options.inputType = 'file';
    super('file', options as ValidationOptions);
  }

  maxSize(bytes: number, err?: string): this {
    return this.validate(
      (value) =>
        value.size <= bytes ||
        err ||
        `File size must be less than ${bytes} bytes`
    );
  }

  mimeType(types: string | string[], err?: string): this {
    const allowedTypes = Array.isArray(types) ? types : [types];
    return this.validate(
      (value) =>
        allowedTypes.includes(value.mimeType) ||
        err ||
        `File type must be one of: ${allowedTypes.join(', ')}`
    );
  }
}

export class SchemaCompiler {
  static compile(schema: Record<string, SchemaBuilder>): HTTPBody<any> {
    const compiled: Record<string, SchemaDefinition> = {};
    for (const [key, builder] of Object.entries(schema)) {
      compiled[key] = builder.getDefinition();
    }
    return compiled as HTTPBody<any>;
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
    } = {}
  ) {
    this.method = options.method || 'GET';
    this.url = options.url || '/';
    this.headers = options.headers || new Map();
    this.body = options.body || null;
    this.statusCode = 200;
    this.statusMessage = 'OK';
    this.bodyUsed = false;
  }
}

export class JetServer {
  /*
  internal method
  */
  private options: jetOptions = {};
  constructor(options?: jetOptions) {
    Object.assign(this.options, options || {});
  }
  makeRes(ctx: any) {
    const result = {
      code: ctx!.code,
      body:
        typeof ctx!.payload !== 'string'
          ? ctx!.payload
          : JSON.parse(ctx!.payload),
      headers: ctx!._2!,
    };

    // Return context to pool for test environments
    if (ctx.__jet_pool) {
      queueMicrotask(() => {
        ctxPool.push(ctx);
      });
    }

    return result;
  }
  private async run1(func: JetRoute, ctx?: JetContext<any, any>) {
    if (func.method === 'OPTIONS') {
      optionsCtx.code = 200;
      return this.makeRes(optionsCtx as unknown as Context);
    }

    const returned: ((ctx: any, error?: unknown) => void | Promise<void>)[] =
      [];
    if (ctx) {
      const r = func!;
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
        if (ctx.payload) return this.makeRes(ctx);
        //? route handler call
        await r(ctx as any);
        //? post-request middlewares here
        for (let r = 0; r < returned.length; r++) {
          await returned[r](ctx);
        }
        return this.makeRes(ctx);
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
          return this.makeRes(ctx);
        }
      }
    }
    const ctx404 = optionsCtx;
    ctx404.code = 404;
    return this.makeRes(ctx404 as unknown as Context);
  }
  /*
  internal method
  */
  private async run2(
    func: JetRoute,
    ctx?: JetContext<any, any>
  ): Promise<{ code: number; body: any; headers: Record<string, string> }> {
    if (!ctx) {
      ctx = getCtx(
        new MockRequest({
          method: func.method!,
          url: func.path!,
          headers: new Map(),
          body: null,
        }) as any,
        {},
        func.path!,
        func,
        {}
      ) as any;
    }

    return this.run1(func, ctx);
  }
  runWithCTX(
    func: JetRoute,
    ctx: JetContext<any, any>
  ): Promise<{ code: number; body: any; headers: Record<string, string> }> {
    return this.run1(func, ctx);
  }
  runBare(
    func: JetRoute
  ): Promise<{ code: number; body: any; headers: Record<string, string> }> {
    return this.run2(func);
  }
  createCTX(
    req: Request,
    res: Response,
    path: string,
    handler: JetRoute,
    params: Record<string, any>
  ): JetContext {
    return getCtx(req, res, path, handler, params) as any;
  }
}
