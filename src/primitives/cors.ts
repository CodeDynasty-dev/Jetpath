import type { allowedMethods } from './types';

/**
 * an inbuilt CORS post middleware
 *    @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer/Planned_changes
 *  - {Boolean} privateNetworkAccess handle `Access-Control-Request-Private-Network` request by return `Access-Control-Allow-Private-Network`, default to false
 *    @see https://wicg.github.io/private-network-access/
 */

export const optionsCtx = {
  payload: undefined,
  _2: {
    Vary: 'Origin',
    Connection: 'keep-alive',
  },
  _6: false,
  code: 204,
  set(field: string, value: string) {
    if (field && value) {
      (this._2 as Record<string, string>)[field] = value;
    }
  },
  request: { method: 'OPTIONS' },
};

// Create immutable CORS headers
export const createCorsHeaders = (): Record<string, string> => ({
  Vary: 'Origin',
  Connection: 'keep-alive',
});

// Base CORS headers - will be frozen after initialization
export let baseCorsHeaders: Record<string, string> = createCorsHeaders();
export function corsMiddleware(options: {
  exposeHeaders?: string[];
  allowMethods?: allowedMethods;
  allowHeaders?: string[];
  keepHeadersOnError?: boolean;
  maxAge?: string;
  credentials?: boolean;
  secureContext?: {
    'Cross-Origin-Opener-Policy':
      | 'same-origin'
      | 'unsafe-none'
      | 'same-origin-allow-popups';
    'Cross-Origin-Embedder-Policy': 'require-corp' | 'unsafe-none';
  };
  privateNetworkAccess?: unknown;
  origin?: string[];
}) {
  //
  options.keepHeadersOnError =
    options.keepHeadersOnError === undefined || !!options.keepHeadersOnError;
  //?  pre populate context for Preflight Request
  if (options.maxAge) {
    optionsCtx.set('Access-Control-Max-Age', options.maxAge);
  }
  if (!options.privateNetworkAccess) {
    if (options.allowMethods) {
      optionsCtx.set(
        'Access-Control-Allow-Methods',
        options.allowMethods.join(',')
      );
    }
    if (options.secureContext) {
      optionsCtx.set(
        'Cross-Origin-Opener-Policy',
        options.secureContext['Cross-Origin-Embedder-Policy'] || 'unsafe-none'
      );
      optionsCtx.set(
        'Cross-Origin-Embedder-Policy',
        options.secureContext['Cross-Origin-Embedder-Policy'] || 'unsafe-none'
      );
    }
    if (options.allowHeaders) {
      optionsCtx.set(
        'Access-Control-Allow-Headers',
        options.allowHeaders.join(',')
      );
    }
  }
  optionsCtx.set('Vary', 'Origin');
  if (options.credentials === true) {
    optionsCtx.set('Access-Control-Allow-Credentials', 'true');
  }
  if (Array.isArray(options.origin)) {
    optionsCtx.set('Access-Control-Allow-Origin', options.origin.join(','));
  }
  // ? Pre-populate normal response headers.
  // Create new base CORS headers to avoid mutation
  baseCorsHeaders = createCorsHeaders();

  //? Add Vary header to indicate response varies based on the Origin header
  baseCorsHeaders['Vary'] = 'Origin';
  if (options.credentials === true) {
    baseCorsHeaders['Access-Control-Allow-Credentials'] = 'true';
  }
  if (Array.isArray(options.origin)) {
    baseCorsHeaders['Access-Control-Allow-Origin'] = options.origin.join(',');
  }
  if (options.secureContext) {
    baseCorsHeaders['Cross-Origin-Opener-Policy'] =
      options.secureContext['Cross-Origin-Embedder-Policy'];
    baseCorsHeaders['Cross-Origin-Embedder-Policy'] =
      options.secureContext['Cross-Origin-Embedder-Policy'];
  }

  // Freeze the headers to prevent mutation
  Object.freeze(baseCorsHeaders);
}
