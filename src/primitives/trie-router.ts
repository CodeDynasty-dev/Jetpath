import type { IncomingMessage } from "http";
import { Context, LOG } from "./classes.js";
import { baseCorsHeaders } from "./cors.js";
import type { JetRoute } from "./types.js";

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
      | 'GET'
      | 'POST'
      | 'PUT'
      | 'DELETE'
      | 'PATCH'
      | 'OPTIONS'
      | 'HEAD'
      | 'CONNECT'
      | 'TRACE'
  ) {
    this.root = new TrieNode();
    this.method = method;
  }

  /**
   * Inserts a route path and its associated handler into the Trie.
   * Exact paths (no parameters or wildcards) go to hashmap for O(1) lookup.
   * Dynamic paths (with : or *) go to Trie for pattern matching.
   */
  insert(path: string, handler: JetRoute): void {
    // Normalize path first
    let normalizedPath = path.trim();
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.slice(1);
    }
    if (normalizedPath.endsWith('/') && normalizedPath.length > 0) {
      normalizedPath = normalizedPath.slice(0, -1);
    }

    // Check if it's an exact path (no parameters or wildcards)
    const isExactPath = !/(\*|:)+/.test(normalizedPath);

    if (isExactPath) {
      // Store exact paths in hashmap for O(1) lookup
      if (this.hashmap[normalizedPath]) {
        throw new Error(
          `Duplicate route: ${this.method} ${path} is already defined. Each route path must be unique per HTTP method.`
        );
      }
      this.hashmap[normalizedPath] = handler;
      return;
    }

    // ? Handle the root path explicitly (dynamic root path)
    if (normalizedPath === '') {
      if (this.root.handler) {
        LOG.log(
          `Warning: Duplicate route definition for path ${this.method} ${path}`,
          'warn'
        );
      }
      this.root.handler = handler;
      return;
    }

    const segments = normalizedPath.split('/');
    let currentNode: TrieNode = this.root;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // ? Check for parameter segment (starts with :)
      if (segment.startsWith(':')) {
        const paramName = segment.slice(1);
        if (!paramName) {
          throw new Error(
            `Invalid route path: Parameter segment in ${this.method} ${path} '${segment}' is missing a name.`
          );
        }

        // ? Check if a parameter node already exists at this level
        if (currentNode.parameterChild) {
          if (currentNode.parameterChild.paramName !== paramName) {
            throw new Error(
              `Route path conflict: Parameter ':${paramName}' in ${this.method} ${path} conflicts with existing parameter ':${currentNode.parameterChild.paramName}' at the same level. ` +
                `Two different parameter names cannot occupy the same path segment. ` +
                `Tip: Use a fixed prefix to disambiguate, e.g. instead of GET_resource_$settings and GET_resource_$stats, ` +
                `use GET_resource_settings_$id and GET_resource_stats_$id.`
            );
          }

          currentNode = currentNode.parameterChild;
          // ? add parameter to same section child handlers.
          if (!handler.params) {
            handler.params = {};
          }
          // @ts-ignore
          handler.params[paramName] = '';
        } else if (currentNode.children.has(segment)) {
          throw new Error(
            `Route path conflict: Fixed segment '${segment}' already exists at this level in ${this.method} ${path}.`
          );
        } else if (currentNode.wildcardChild) {
          throw new Error(
            `Invalid route path: Parameter segment '${segment}' cannot follow a wildcard '*' at the same level in ${this.method} ${path}.`
          );
        } else {
          if (!handler.params) {
            handler.params = {};
          }
          handler.params[paramName as keyof typeof handler.params] = '' as any;
          const newNode = new TrieNode();
          newNode.paramName = paramName;
          currentNode.parameterChild = newNode;
          currentNode = newNode;
        }
      } // ? Check for wildcard segment (*) - typically only allowed at the end
      else if (segment === '*') {
        if (i !== segments.length - 1) {
          throw new Error(
            `Invalid route path: Wildcard '*' is only allowed at the end of a path pattern in ${this.method} ${path}.`
          );
        }
        if (currentNode.wildcardChild) {
          LOG.log(
            `Warning: Duplicate wildcard definition at segment '${segment}' in ${this.method} ${path}.`,
            'warn'
          );
          currentNode = currentNode.wildcardChild;
        } else if (currentNode.parameterChild) {
          throw new Error(
            `Invalid route path: Wildcard '*' cannot follow a parameter at the same level in ${this.method} ${path}.`
          );
        } else if (currentNode.children.has(segment)) {
          throw new Error(
            `Route path conflict: Fixed segment '${segment}' already exists at this level in ${this.method} ${path}.`
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
            `Route path conflict: Fixed segment '${segment}' in ${this.method} ${path} conflicts with existing parameter ':${currentNode.parameterChild.paramName}' at this level. ` +
              `A path segment cannot be both a fixed string and a parameter. ` +
              `Tip: Add a fixed prefix before the parameter, e.g. instead of GET_reviews_$userId and GET_reviews_listing_$listingId, ` +
              `use GET_reviews_user_$userId and GET_reviews_listing_$listingId.`
          );
        }
        if (currentNode.wildcardChild) {
          throw new Error(
            `Route path conflict: Fixed segment '${segment}' conflicts with existing wildcard '*' at this level in ${this.method} ${path}.`
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
      throw new Error(
        `Duplicate route: ${this.method} ${path} is already defined. Each route path must be unique per HTTP method.`
      );
    }
    //? Set the handler and original path
    currentNode.handler = handler;
  }

  get_responder(req: IncomingMessage | Request, res: any): Context | undefined {
    const url = req.url!;
    let normalizedPath: string;

    if (isNode) {
      // ? Node.js: url is already a path like "/" or "/users?q=1"
      // ? Fast path for root
      if (url.length === 1) {
        // url === '/'
        const h = this.hashmap[''];
        if (h) return getCtx(req, res, '', h);
        if (this.root.handler) {
          return getCtx(req, res, '', this.root.handler, undefined);
        }
        return undefined;
      }
      // ? Strip query string and normalize
      const qIdx = url.indexOf('?');
      const end = qIdx > -1 ? qIdx : url.length;
      // ? strip leading '/' and trailing '/'
      const s = 1; // always starts with '/'
      const e = url.charCodeAt(end - 1) === 47 && end > 2 ? end - 1 : end;
      normalizedPath = url.substring(s, e);
    } else {
      // ? Bun/Deno: url is absolute like "http://localhost:3000/" or "http://localhost:3000/users"
      const pathStart = url.indexOf('/', 7); // skip "http://" or "https:/"
      // ? Fast path: root "/" with no query
      if (pathStart >= 0 && pathStart === url.length - 1) {
        const h = this.hashmap[''];
        if (h) return getCtx(req, res, '', h);
        if (this.root.handler) {
          return getCtx(req, res, '', this.root.handler, undefined);
        }
        return undefined;
      }
      if (pathStart < 0) {
        // no path found — treat as root
        const h = this.hashmap[''];
        if (h) return getCtx(req, res, '', h);
        if (this.root.handler) {
          return getCtx(req, res, '', this.root.handler, undefined);
        }
        return undefined;
      }
      // ? Strip query string
      const qIdx = url.indexOf('?', pathStart);
      const end = qIdx > -1 ? qIdx : url.length;
      // ? strip leading '/' and trailing '/'
      const s = pathStart + 1;
      const e = url.charCodeAt(end - 1) === 47 && end > s + 1 ? end - 1 : end;
      if (s >= e) {
        // root path
        const h = this.hashmap[''];
        if (h) return getCtx(req, res, '', h);
        if (this.root.handler) {
          return getCtx(req, res, '', this.root.handler, undefined);
        }
        return undefined;
      }
      normalizedPath = url.substring(s, e);
    }

    // ? O(1) hashmap lookup for exact paths (most common case)
    const exactHandler = this.hashmap[normalizedPath];
    if (exactHandler) {
      return getCtx(req, res, normalizedPath, exactHandler);
    }

    // ? Trie walk for parameterized/wildcard routes
    let currentNode = this.root;
    const params: Record<string, string> = {};
    const segments = normalizedPath.split('/');
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const child = currentNode.children.get(segment);
      if (child) {
        currentNode = child;
      } else if (currentNode.parameterChild) {
        params[currentNode.parameterChild.paramName!] =
          decodeURIComponent(segment);
        currentNode = currentNode.parameterChild;
      } else if (currentNode.wildcardChild) {
        params['*'] = segments.slice(i).join('/');
        currentNode = currentNode.wildcardChild;
        break;
      } else {
        return undefined;
      }
    }
    if (currentNode.handler) {
      return getCtx(req, res, normalizedPath, currentNode.handler, params);
    }
  }

  // ? Bun/Deno optimized responder — uses scratch context to avoid pool overhead
  get_responder_fast(req: Request, res: unknown): Context | undefined {
    const url = req.url!;
    const pathStart = url.indexOf('/', 7);
    // ? Fast path: root "/" with no query
    if (pathStart >= 0 && pathStart === url.length - 1) {
      const h = this.hashmap[''];
      if (h) return getScratchCtx(req, res, '', h);
      if (this.root.handler) {
        return getScratchCtx(req, res, '', this.root.handler, undefined);
      }
      return undefined;
    }
    if (pathStart < 0) {
      const h = this.hashmap[''];
      if (h) return getScratchCtx(req, res, '', h);
      if (this.root.handler) {
        return getScratchCtx(req, res, '', this.root.handler, undefined);
      }
      return undefined;
    }
    const qIdx = url.indexOf('?', pathStart);
    const end = qIdx > -1 ? qIdx : url.length;
    const s = pathStart + 1;
    const e = url.charCodeAt(end - 1) === 47 && end > s + 1 ? end - 1 : end;
    if (s >= e) {
      const h = this.hashmap[''];
      if (h) return getScratchCtx(req, res, '', h);
      if (this.root.handler) {
        return getScratchCtx(req, res, '', this.root.handler, undefined);
      }
      return undefined;
    }
    const normalizedPath = url.substring(s, e);
    const exactHandler = this.hashmap[normalizedPath];
    if (exactHandler) {
      return getScratchCtx(req, res, normalizedPath, exactHandler);
    }
    // ? Trie walk for parameterized/wildcard routes
    let currentNode = this.root;
    const params: Record<string, string> = {};
    const segments = normalizedPath.split('/');
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const child = currentNode.children.get(segment);
      if (child) {
        currentNode = child;
      } else if (currentNode.parameterChild) {
        params[currentNode.parameterChild.paramName!] =
          decodeURIComponent(segment);
        currentNode = currentNode.parameterChild;
      } else if (currentNode.wildcardChild) {
        params['*'] = segments.slice(i).join('/');
        currentNode = currentNode.wildcardChild;
        break;
      } else {
        return undefined;
      }
    }
    if (currentNode.handler) {
      return getScratchCtx(
        req,
        res,
        normalizedPath,
        currentNode.handler,
        params
      );
    }
  }
}

export const getCtx = (
  req: IncomingMessage | Request,
  res: any,
  path: string,
  route: JetRoute,
  params?: Record<string, any>,
): Context => {
  if (ctxPool.length) {
    const ctx = ctxPool.pop()!;
    // ? clear state — only if it was used (check _dirty flag instead of Object.keys)
    if (ctx._8) {
      ctx._7.state = {};
      ctx._8 = false;
    }
    ctx.request = req;
    ctx.res = res;
    ctx.params = params;
    ctx.path = path;
    ctx.payload = undefined;
    // ? reset headers — fresh object is faster than delete-loop (avoids dictionary mode)
    ctx._2 = _cloneCorsHeaders();
    ctx.handler = route;
    ctx.code = 200;
    // ? only reset these if they were actually set (avoid unnecessary writes)
    if (ctx._3) ctx._3 = undefined;
    if (ctx._6 !== false) ctx._6 = false;
    if (ctx.$_internal_body) {
      ctx.$_internal_body = undefined;
      ctx.$_internal_validated_body = undefined;
    }
    if (ctx.$_internal_query) {
      ctx.$_internal_query = undefined;
      ctx._queryValidated = false;
    }
    if (ctx._10) ctx._10 = false;
    if (ctx._setCookies?.length) ctx._setCookies = [];
    return ctx;
  }
  const ctx = new Context();
  ctx.request = req;
  ctx.res = res;
  ctx.method = req.method as "GET";
  ctx.params = params;
  ctx.path = path;
  ctx.handler = route;
  return ctx;
};

// ? Scratch context for sync fast path — avoids pool push/pop overhead
let _scratchCtx: Context | null = null;

export const getScratchCtx = (
  req: Request,
  res: unknown,
  path: string,
  route: JetRoute,
  params?: Record<string, any>
): Context => {
  const ctx = _scratchCtx;
  if (ctx) {
    // ? mark as in-use so async fallback knows to allocate from pool
    _scratchCtx = null;
    // ? minimal reset — only what the handler needs
    if (ctx._8) {
      ctx._7.state = {};
      ctx._8 = false;
    }
    ctx.request = req;
    ctx.res = res;
    ctx.params = params;
    ctx.path = path;
    ctx.payload = undefined;
    ctx._10 = false;
    ctx.handler = route;
    ctx.code = 200;
    if (ctx._setCookies?.length) ctx._setCookies = [];
    if (ctx._3) ctx._3 = undefined;
    if (ctx._6 !== false) ctx._6 = false;
    if (ctx.$_internal_body) {
      ctx.$_internal_body = undefined;
      ctx.$_internal_validated_body = undefined;
    }
    if (ctx.$_internal_query) {
      ctx.$_internal_query = undefined;
      ctx._queryValidated = false;
    }
    return ctx;
  }
  // ? scratch is in use (async handler) — fall back to pool
  return getCtx(req, undefined, path, route, params);
};

export const returnScratchCtx = (ctx: Context) => {
  // ? return scratch context for reuse
  // ? if scratch slot is empty, reclaim it; otherwise push to pool
  if (!_scratchCtx) {
    _scratchCtx = ctx;
  } else if (ctxPool.length < MAX_POOL_SIZE) {
    ctxPool.push(ctx);
  }
};

// ? Pre-seed the context pool at module load to avoid cold-start allocations
export function preSeedPool(count: number) {
  // ? Initialize scratch context for sync fast path
  if (!_scratchCtx) {
    _scratchCtx = new Context();
  }
  for (let i = 0; i < count; i++) {
    ctxPool.push(new Context());
  }
}

// ? Pre-baked clone function — avoids spread operator overhead
// ? Built once at startup, called per-request
let _cloneCorsHeaders: () => Record<string, string> = () => ({
  Vary: "Origin",
  Connection: "keep-alive",
});

// ? Pre-baked JSON headers clone — includes Content-Type: application/json
// ? Used by send() fast path to swap headers instead of mutating
export let _cloneJsonHeaders: () => Record<string, string> = () => ({
  Vary: "Origin",
  Connection: "keep-alive",
  "Content-Type": "application/json",
});

export function _rebuildCorsCloner() {
  // ? Rebuild clone functions from current baseCorsHeaders
  // ? Uses closure capture instead of new Function() for CSP compatibility and security
  const keys = Object.keys(baseCorsHeaders);
  const vals = keys.map((k) => baseCorsHeaders[k]);
  _cloneCorsHeaders = () => {
    const h: Record<string, string> = {};
    for (let i = 0; i < keys.length; i++) h[keys[i]] = vals[i];
    return h;
  };
  // ? Also build the JSON variant with Content-Type pre-included
  _cloneJsonHeaders = () => {
    const h: Record<string, string> = {};
    for (let i = 0; i < keys.length; i++) h[keys[i]] = vals[i];
    h["Content-Type"] = "application/json";
    return h;
  };
}

export const ctxPool: Context[] = [];
export const MAX_POOL_SIZE = 500;

export let runtime: Record<
  "bun" | "deno" | "node" | "edge" | "cloudflare_worker" | "aws_lambda",
  boolean
> = {
  bun: false,
  deno: false,
  node: false,
  edge: false,
  cloudflare_worker: false,
  aws_lambda: false,
};

const ae = (cb: { (): unknown; (): unknown; (): void }) => {
  try {
    cb();
    return true;
  } catch {
    return false;
  }
};

(() => {
  //? check for bun runtime
  const bun = ae(() => Bun);
  //? check for deno runtime
  // @ts-expect-error to avoid the Deno keyword
  const deno = ae(() => Deno);
  let cloudflare_worker = false;
  let aws_lambda = false;
  //? check if running in Cloudflare Worker
  if (
    typeof (globalThis as unknown as { WebSocketPair: unknown })
        .WebSocketPair !== "undefined" &&
    typeof (globalThis as unknown as { caches: unknown }).caches !==
      "undefined" &&
    typeof (globalThis as unknown as { Response: unknown }).Response !==
      "undefined"
  ) {
    cloudflare_worker = true;
  }
  // AWS Lambda
  if (
    typeof process !== "undefined" &&
    process.env?.["AWS_LAMBDA_FUNCTION_NAME"]
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
export const isNode = runtime["node"];
