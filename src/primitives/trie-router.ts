import type { IncomingMessage } from 'http';
import { Context, LOG } from './classes.js';
import { baseCorsHeaders } from './cors.js';
import type { JetRoute } from './types.js';

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
        LOG.log(
          `Warning: Duplicate route definition for path ${this.method} ${path}`,
          'warn'
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
            LOG.log(
              `Warning: Route path conflict at segment '${segment}' in ${this.method} ${path}. Parameter ': ${currentNode.parameterChild.paramName}' already defined at this level.`,
              'warn'
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
            `Route path conflict: Fixed segment '${segment}' conflicts with existing parameter ': ${currentNode.parameterChild.paramName}' at this level in ${this.method} ${path}.`
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
      LOG.log(
        `Warning: Duplicate route definition for path '${path}'.`,
        'warn'
      );
    }
    //? Set the handler and original path
    currentNode.handler = handler;
  }

  get_responder(req: IncomingMessage | Request, res: any): Context | undefined {
    let normalizedPath = req.url!;
    // ? Handle absolute paths in non-node environments
    if (!isNode) {
      const pathStart = normalizedPath.indexOf('/', 7);
      normalizedPath =
        pathStart >= 0 ? normalizedPath.slice(pathStart) : normalizedPath;
    }
    //? Handle query parameters first
    const queryIndex = normalizedPath.indexOf('?');
    if (queryIndex > -1) {
      // ? Extract query parameters
      normalizedPath = normalizedPath.slice(0, queryIndex);
    }
    // ? Handle leading and trailing slashes
    if (normalizedPath.startsWith('/')) {
      normalizedPath = normalizedPath.slice(1);
    }
    // ? Handle trailing slash
    if (normalizedPath.endsWith('/') && normalizedPath.length > 0) {
      normalizedPath = normalizedPath.slice(0, -1);
    }
    // ? Check if route is cached in hashmap (after normalization)
    if (this.hashmap[normalizedPath]) {
      return getCtx(req, res, normalizedPath, this.hashmap[normalizedPath]!);
    }
    // ? Handle empty path
    if (normalizedPath === '') {
      if (this.root.handler) {
        return getCtx(req, res, normalizedPath, this.root.handler, undefined);
      }
    }
    let currentNode = this.root;
    const params: Record<string, string> = {};
    const segments = normalizedPath.split('/');
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (currentNode.children.has(segment)) {
        // ? fixed segment match
        currentNode = currentNode.children.get(segment)!;
      } else if (currentNode.parameterChild) {
        // ? parameter segment match
        const name = currentNode.parameterChild.paramName!;
        params[name] = decodeURIComponent(segment);
        currentNode = currentNode.parameterChild;
      } else if (currentNode.wildcardChild) {
        // ? wildcard segment match
        params['*'] = segments.slice(i).join('/');
        currentNode = currentNode.wildcardChild;
        break;
      } else {
        // ? No match
        return undefined;
      }
    }
    if (currentNode.handler) {
      // ? Route found
      return getCtx(req, res, normalizedPath, currentNode.handler, params);
    }
  }
}

export const getCtx = (
  req: IncomingMessage | Request,
  res: any,
  path: string,
  route: JetRoute,
  params?: Record<string, any>
): Context => {
  if (ctxPool.length) {
    const ctx = ctxPool.shift()!;
    // ? reset the Context to default state
    ctx._7.state = {}; // Clear state completely
    ctx.request = req;
    ctx.res = res;
    ctx.method = req.method as 'GET';
    ctx.params = params;
    ctx.$_internal_query = undefined;
    ctx.$_internal_body = undefined; // ? very important.
    ctx.path = path;
    //? load
    ctx.payload = undefined;
    // ? header of response - create fresh copy to avoid mutation
    ctx._2 = { ...baseCorsHeaders };
    // //? stream
    ctx._3 = undefined;
    //? the route handler
    ctx.handler = route;
    //? custom response
    ctx._6 = false;
    // ? code
    ctx.code = 200;
    // ? clear any cached validation
    ctx.$_internal_validated_body = undefined;
    return ctx;
  }
  const ctx = new Context();
  // ? add middlewares to the plugins object
  ctx.request = req;
  ctx.res = res;
  ctx._2 = { ...baseCorsHeaders }; // Fresh copy
  ctx.method = req.method as 'GET';
  ctx.params = params;
  ctx.path = path;
  ctx.handler = route;
  return ctx;
};

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
      .WebSocketPair !== 'undefined' &&
    typeof (globalThis as unknown as { caches: unknown }).caches !==
      'undefined' &&
    typeof (globalThis as unknown as { Response: unknown }).Response !==
      'undefined'
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
