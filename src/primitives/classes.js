import { createReadStream, realpathSync } from "node:fs";
import { abstractPluginCreator, getCtx, isNode, JetSocketInstance, parseRequest, runtime, validator, } from "./functions.js";
import { mime } from "../extracts/mimejs-extract.js";
import { resolve, sep } from "node:path";
export class JetPlugin {
    plugin;
    constructor(plugin) {
        this.plugin = plugin;
    }
    setup(init) {
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
    static print(message, color) {
        console.log(`${color}%s${LOG.colors.reset}`, `${message}`);
    }
    static log(message, type) {
        LOG.print(message, type === "info"
            ? LOG.colors.fgBlue
            : type === "warn"
                ? LOG.colors.fgYellow
                : type === "success"
                    ? LOG.colors.fgGreen
                    : LOG.colors.fgRed);
    }
}
class Cookie {
    static parseCookieHeader(header) {
        return header
            .split("; ")
            .map((pair) => pair.split("="))
            .reduce((acc, [key, value]) => ({
            ...acc,
            [key.trim()]: value ? decodeURIComponent(value) : "",
        }), {});
    }
    static serializeCookie(name, value, options) {
        const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
        if (options.path)
            parts.push(`Path=${encodeURIComponent(options.path)}`);
        if (options.domain) {
            parts.push(`Domain=${encodeURIComponent(options.domain)}`);
        }
        if (options.secure)
            parts.push("Secure");
        if (options.httpOnly)
            parts.push("HttpOnly");
        if (options.sameSite)
            parts.push(`SameSite=${options.sameSite}`);
        if (options.maxAge)
            parts.push(`Max-Age=${options.maxAge}`);
        if (options.expires)
            parts.push(`Expires=${options.expires.toUTCString()}`);
        return parts.join("; ");
    }
    static parse(cookies) {
        return Cookie.parseCookieHeader(cookies);
    }
    static serialize(name, value, options = {}) {
        return Cookie.serializeCookie(name, value, options);
    }
}
class ctxState {
    state = {};
}
export class Context {
    code = 200;
    request;
    params;
    query;
    body;
    path;
    connection;
    method;
    handler = null;
    __jet_pool = true;
    plugins;
    // ? state
    get state() {
        // ? auto clean up state object
        if (this._7.state["__state__"] === true) {
            for (const key in this._7.state) {
                delete this._7.state[key];
            }
        }
        return this._7.state;
    }
    //? load
    payload = undefined;
    // ? header of response
    _2 = {};
    // //? stream
    _3 = undefined;
    //? response
    _6 = false;
    //? original response
    res;
    //? state
    _7;
    constructor() {
        this.plugins = abstractPluginCreator(this);
        this._7 = new ctxState();
    }
    send(data, statusCode, contentType) {
        if (this._6 || this._3) {
            throw new Error("Response already set");
        }
        if (contentType) {
            this._2["Content-Type"] = contentType;
            this.payload = String(data);
            if (statusCode)
                this.code = statusCode;
        }
        else {
            if (typeof data === "object") {
                this._2["Content-Type"] = "application/json";
                this.payload = JSON.stringify(data);
            }
            else {
                this.payload = data ? String(data) : "";
            }
            if (statusCode)
                this.code = statusCode;
        }
    }
    redirect(url) {
        this.code = 301;
        this._2["Location"] = url;
    }
    get(field) {
        if (field) {
            if (runtime["node"]) {
                return this.request.headers[field];
            }
            return this.request.headers.get(field);
        }
        return undefined;
    }
    set(field, value) {
        if (field && value) {
            this._2[field] = value;
        }
    }
    getCookie(name) {
        const cookieHeader = runtime["node"]
            ? this.request.headers.cookie
            : this.request.headers.get("cookie");
        if (cookieHeader) {
            const cookies = Cookie.parse(cookieHeader);
            return cookies[name];
        }
        return undefined;
    }
    getCookies() {
        const cookieHeader = runtime["node"]
            ? this.request.headers.cookie
            : this.request.headers.get("cookie");
        return cookieHeader ? Cookie.parse(cookieHeader) : {};
    }
    setCookie(name, value, options = {}) {
        const cookie = Cookie.serialize(name, value, options);
        const existingCookies = this._2["set-cookie"] || "";
        const cookies = existingCookies
            ? existingCookies.split(",").map((c) => c.trim())
            : [];
        cookies.push(cookie);
        this._2["set-cookie"] = cookies.join(", ");
    }
    clearCookie(name, options = {}) {
        this.setCookie(name, "", { ...options, maxAge: 0 });
    }
    sendStream(stream, config = {
        folder: undefined,
        ContentType: "application/octet-stream",
    }) {
        if (typeof stream === "string") {
            if (config.folder) {
                let normalizedTarget;
                let normalizedBase;
                try {
                    stream = resolve(config.folder, stream);
                    normalizedTarget = realpathSync(stream);
                    normalizedBase = realpathSync(config.folder);
                }
                catch (error) {
                    throw new Error("File not found!");
                }
                // ? prevent path traversal
                if (!normalizedTarget.startsWith(normalizedBase + sep)) {
                    throw new Error("Path traversal detected!");
                }
            }
            else {
                stream = resolve(stream);
            }
            config.ContentType = mime.getType(stream) || config.ContentType;
            this._2["Content-Disposition"] = `inline; filename="${stream.split("/").at(-1) || "unnamed.bin"}"`;
            if (runtime["bun"]) {
                stream = Bun.file(stream);
            }
            else if (runtime["deno"]) {
                // @ts-expect-error
                const file = Deno.open(stream).catch(() => { });
                stream = file;
            }
            else {
                stream = createReadStream(resolve(stream), {
                    autoClose: true,
                });
            }
        }
        this._2["Content-Type"] = config.ContentType;
        this._3 = stream;
    }
    download(stream, config = {
        folder: undefined,
        ContentType: "application/octet-stream",
    }) {
        this.sendStream(stream, config);
        this._2["Content-Disposition"] = `attachment; filename="${stream.split("/").at(-1) || "unnamed.bin"}"`;
    }
    // Only for deno and bun
    sendResponse(Response) {
        if (!runtime["node"]) {
            // @ts-ignore
            this._6 = Response;
        }
    }
    // Only for deno and bun
    upgrade() {
        const req = this.request;
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
                throw new Error("No current websocket support for Nodejs! run with bun or deno.");
            }
        }
        throw new Error("Invalid upgrade headers");
    }
    async parse(options) {
        if (this.body) {
            return this.body;
        }
        this.body = await parseRequest(this.request, options);
        //? validate body
        if (this.handler.body) {
            this.body = validator(this.handler.body, this.body);
        }
        //? validate query
        if (this.handler.query && this.query) {
            this.query = validator(this.handler.query, this.query);
        }
        return this.body;
    }
}
export class JetSocket {
    listeners = {
        "message": null,
        "close": null,
        "drain": null,
        "open": null,
    };
    addEventListener(event, listener) {
        this.listeners[event] = listener;
    }
    /**
     * @internal
     */
    __binder(eventName, data) {
        if (this.listeners[eventName]) {
            this.listeners[eventName]?.(...data);
        }
    }
}
/**
 * Schema builder classes
 */
export class SchemaBuilder {
    def;
    constructor(type, options = {}) {
        this.def = { type, required: false, ...options };
    }
    required(err) {
        this.def.required = true;
        if (err)
            this.def.err = err;
        return this;
    }
    optional(err) {
        this.def.required = false;
        if (err)
            this.def.err = err;
        return this;
    }
    default(value) {
        this.def.inputDefaultValue = value;
        return this;
    }
    validate(fn) {
        this.def.validator = fn;
        return this;
    }
    regex(pattern, err) {
        this.def.RegExp = pattern;
        if (err)
            this.def.err = err;
        return this;
    }
    getDefinition() {
        return this.def;
    }
}
export class StringSchema extends SchemaBuilder {
    constructor(options = {}) {
        // @ts-expect-error
        options.inputType = "string";
        super("string", options);
    }
    email(err) {
        return this.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, err || "Invalid email");
    }
    min(length, err) {
        return this.validate((value) => value.length >= length || err || `Minimum length is ${length}`);
    }
    max(length, err) {
        return this.validate((value) => value.length <= length || err || `Maximum length is ${length}`);
    }
    url(err) {
        return this.regex(/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/, err || "Invalid URL");
    }
}
export class NumberSchema extends SchemaBuilder {
    constructor(options = {}) {
        // @ts-expect-error
        options.inputType = "number";
        super("number", options);
    }
    min(value, err) {
        return this.validate((val) => val >= value || err || `Minimum value is ${value}`);
    }
    max(value, err) {
        return this.validate((val) => val <= value || err || `Maximum value is ${value}`);
    }
    integer(err) {
        return this.validate((val) => Number.isInteger(val) || err || "Must be an integer");
    }
    positive(err) {
        return this.validate((val) => val > 0 || err || "Must be positive");
    }
    negative(err) {
        return this.validate((val) => val < 0 || err || "Must be negative");
    }
}
export class BooleanSchema extends SchemaBuilder {
    constructor() {
        super("boolean");
    }
}
export class ArraySchema extends SchemaBuilder {
    constructor(elementSchema) {
        super("array");
        if (elementSchema) {
            const elementDef = elementSchema.getDefinition();
            if (elementDef.type === "object" && elementDef.objectSchema) {
                this.def.arrayType = "object";
                this.def.objectSchema = elementDef.objectSchema;
            }
            else {
                this.def.arrayType = elementDef.type;
            }
        }
    }
    min(length, err) {
        return this.validate((value) => (Array.isArray(value) && value.length >= length) ||
            err ||
            `Minimum length is ${length}`);
    }
    max(length, err) {
        return this.validate((value) => (Array.isArray(value) && value.length <= length) ||
            err ||
            `Maximum length is ${length}`);
    }
    nonempty(err) {
        return this.min(1, err || "Array cannot be empty");
    }
}
export class ObjectSchema extends SchemaBuilder {
    constructor(shape) {
        super("object");
        if (shape) {
            this.def.objectSchema = {};
            for (const [key, builder] of Object.entries(shape)) {
                this.def.objectSchema[key] = builder.getDefinition();
            }
        }
    }
    shape(shape) {
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
    min(date, err) {
        const minDate = new Date(date);
        return this.validate((value) => new Date(value) >= minDate || err || `Date must be after ${minDate}`);
    }
    max(date, err) {
        const maxDate = new Date(date);
        return this.validate((value) => new Date(value) <= maxDate || err || `Date must be before ${maxDate}`);
    }
    future(err) {
        return this.validate((value) => new Date(value) > new Date() || err || "Date must be in the future");
    }
    past(err) {
        return this.validate((value) => new Date(value) < new Date() || err || "Date must be in the past");
    }
}
export class FileSchema extends SchemaBuilder {
    constructor(options = {}) {
        // @ts-expect-error
        options.inputType = "file";
        super("file", options);
    }
    maxSize(bytes, err) {
        return this.validate((value) => value.size <= bytes ||
            err ||
            `File size must be less than ${bytes} bytes`);
    }
    mimeType(types, err) {
        const allowedTypes = Array.isArray(types) ? types : [types];
        return this.validate((value) => allowedTypes.includes(value.mimeType) ||
            err ||
            `File type must be one of: ${allowedTypes.join(", ")}`);
    }
}
export class SchemaCompiler {
    static compile(schema) {
        const compiled = {};
        for (const [key, builder] of Object.entries(schema)) {
            compiled[key] = builder.getDefinition();
        }
        return compiled;
    }
}
class TrieNode {
    // ? child nodes
    children = new Map();
    // ? parameter node
    parameterChild;
    paramName;
    // ? wildcard node
    wildcardChild;
    // ? route handler
    handler;
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
    root;
    method;
    hashmap = {};
    constructor(method) {
        this.root = new TrieNode();
        this.method = method;
    }
    /**
     * Inserts a route path and its associated handler into the Trie.
     */
    insert(path, handler) {
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
                LOG.log(`Warning: Duplicate route definition for path ${this.method} ${path}`, "warn");
            }
            this.root.handler = handler;
            return;
        }
        const segments = normalizedPath.split("/");
        let currentNode = this.root;
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            // ? Check for parameter segment (starts with :)
            if (segment.startsWith(":")) {
                const paramName = segment.slice(1);
                if (!paramName) {
                    throw new Error(`Invalid route path: Parameter segment in ${this.method} ${path} '${segment}' is missing a name.`);
                }
                // ? Check if a parameter node already exists at this level
                if (currentNode.parameterChild) {
                    if (currentNode.parameterChild.paramName !== paramName) {
                        LOG.log(`Warning: Route path conflict at segment '${segment}' in ${this.method} ${path}. Parameter ': ${currentNode.parameterChild.paramName}' already defined at this level.`, "warn");
                    }
                    currentNode = currentNode.parameterChild;
                }
                else if (currentNode.children.has(segment)) {
                    throw new Error(`Route path conflict: Fixed segment '${segment}' already exists at this level in ${this.method} ${path}.`);
                }
                else if (currentNode.wildcardChild) {
                    throw new Error(`Invalid route path: Parameter segment '${segment}' cannot follow a wildcard '*' at the same level in ${this.method} ${path}.`);
                }
                else {
                    const newNode = new TrieNode();
                    newNode.paramName = paramName;
                    currentNode.parameterChild = newNode;
                    currentNode = newNode;
                }
            } // ? Check for wildcard segment (*) - typically only allowed at the end
            else if (segment === "*") {
                if (i !== segments.length - 1) {
                    throw new Error(`Invalid route path: Wildcard '*' is only allowed at the end of a path pattern in ${this.method} ${path}.`);
                }
                if (currentNode.wildcardChild) {
                    LOG.log(`Warning: Duplicate wildcard definition at segment '${segment}' in ${this.method} ${path}.`, "warn");
                    currentNode = currentNode.wildcardChild;
                }
                else if (currentNode.parameterChild) {
                    throw new Error(`Invalid route path: Wildcard '*' cannot follow a parameter at the same level in ${this.method} ${path}.`);
                }
                else if (currentNode.children.has(segment)) {
                    throw new Error(`Route path conflict: Fixed segment '${segment}' already exists at this level in ${this.method} ${path}.`);
                }
                else {
                    const newNode = new TrieNode();
                    currentNode.wildcardChild = newNode;
                    currentNode = newNode;
                }
                //? No need to process further segments after a wildcard
                break;
            } //? Handle fixed segment
            else {
                if (currentNode.parameterChild) {
                    throw new Error(`Route path conflict: Fixed segment '${segment}' conflicts with existing parameter ': ${currentNode.parameterChild.paramName}' at this level in ${this.method} ${path}.`);
                }
                if (currentNode.wildcardChild) {
                    throw new Error(`Route path conflict: Fixed segment '${segment}' conflicts with existing wildcard '*' at this level in ${this.method} ${path}.`);
                }
                // Check if the fixed child node already exists
                if (!currentNode.children.has(segment)) {
                    // Create a new node for the fixed segment
                    currentNode.children.set(segment, new TrieNode());
                }
                // Move to the next node
                currentNode = currentNode.children.get(segment);
            }
        }
        if (currentNode.handler) {
            LOG.log(`Warning: Duplicate route definition for path '${path}'.`, "warn");
        }
        //? Set the handler and original path
        currentNode.handler = handler;
    }
    get_responder(req, res) {
        let normalizedPath = req.url;
        // ? Handle absolute paths in non-node environments
        if (!isNode) {
            const pathStart = normalizedPath.indexOf("/", 7);
            normalizedPath = pathStart >= 0
                ? normalizedPath.slice(pathStart)
                : normalizedPath;
        }
        // ? Check if route is cached
        if (this.hashmap[normalizedPath]) {
            return getCtx(req, res, normalizedPath, this.hashmap[normalizedPath]);
        }
        let query;
        //? Handle query parameters
        const queryIndex = normalizedPath.indexOf("?");
        if (queryIndex > -1) {
            // ? Extract query parameters
            const queryParams = new URLSearchParams(normalizedPath.slice(queryIndex));
            query = {};
            queryParams.forEach((value, key) => {
                query[key] = decodeURIComponent(value);
            });
            normalizedPath = normalizedPath.slice(0, queryIndex);
            if (this.hashmap[normalizedPath]) {
                return getCtx(req, res, normalizedPath, this.hashmap[normalizedPath], undefined, query);
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
                return getCtx(req, res, normalizedPath, this.root.handler, undefined, query);
            }
        }
        let currentNode = this.root;
        const params = {};
        const segments = normalizedPath.split("/");
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            if (currentNode.children.has(segment)) {
                // ? fixed segment match
                currentNode = currentNode.children.get(segment);
            }
            else if (currentNode.parameterChild) {
                // ? parameter segment match
                const name = currentNode.parameterChild.paramName;
                params[name] = decodeURIComponent(segment);
                currentNode = currentNode.parameterChild;
            }
            else if (currentNode.wildcardChild) {
                // ? wildcard segment match
                params["*"] = segments.slice(i).join("/");
                currentNode = currentNode.wildcardChild;
                break;
            }
            else {
                // ? No match
                return undefined;
            }
        }
        if (currentNode.handler) {
            // ? Route found
            return getCtx(req, res, normalizedPath, currentNode.handler, params, query);
        }
    }
}
class MockRequest {
    method;
    url;
    headers;
    body;
    statusCode;
    statusMessage;
    bodyUsed;
    constructor(options = {}) {
        this.method = options.method || "GET";
        this.url = options.url || "/";
        this.headers = options.headers || new Map();
        this.body = options.body || null;
        this.statusCode = 200;
        this.statusMessage = "OK";
        this.bodyUsed = false;
    }
}
export class JetServer {
    /*
    internal method
    */
    options = {};
    constructor(options) {
        Object.assign(this.options, options || {});
    }
    /*
    internal method
    */
    async _run(func, ctx) {
        let returned;
        const r = func;
        if (!ctx) {
            ctx = getCtx(new MockRequest({
                method: r.method,
                url: r.path,
                headers: new Map(),
                body: null,
            }), {}, r.path, r, {}, {});
        }
        try {
            //? pre-request middlewares here
            returned = r.jet_middleware?.length
                ? await Promise.all(r.jet_middleware.map((m) => m(ctx)))
                : undefined;
            //? route handler call
            await r(ctx);
            //? post-request middlewares here
            returned && await Promise.all(returned.map((m) => m?.(ctx, null)));
            //
        }
        catch (error) {
            console.log(error);
            try {
                //? report error to error middleware
                returned && await Promise.all(returned.map((m) => m?.(ctx, error)));
            }
            finally {
                if (!returned && ctx.code < 400) {
                    ctx.code = 500;
                }
                //
            }
        }
        return {
            code: ctx.code,
            body: typeof ctx.payload !== "string"
                ? ctx.payload
                : JSON.parse(ctx.payload),
            headers: ctx._2,
        };
    }
    runBare(func) {
        return this._run(func);
    }
    runWithCTX(func, ctx) {
        return this._run(func, ctx);
    }
    createCTX(req, res, path, handler, params, query) {
        return getCtx(req, res, path, handler, params, query);
    }
}
