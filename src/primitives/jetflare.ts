/**
 * Jet - A beautiful, type-safe API client that's better than tRPC
 * Features: Smart caching, file uploads, WebSocket support, interceptors, and more!
 */


// Enhanced payload types
interface ApiFunctionPayload  {
    body?: any;
    query?: Record<string, any>;
    params?: Record<string, any>;
    headers?: Record<string, string>;
    files?: FileList | File[] | File;
    cache?: boolean | { ttl?: number; key?: string };
    timeout?: number;
    retry?: boolean | { attempts?: number; delay?: number };
    onUploadProgress?: (progress: { loaded: number; total: number; percentage: number }) => void;
    onDownloadProgress?: (progress: { loaded: number; total: number; percentage: number }) => void;
}

// Cache system
class CacheManager {
    private cache = new Map<string, { data: any; expires: number }>();
    private maxSize = 100;

    set(key: string, data: any, ttl: number = 300000) {
        // Cleanup old entries if cache is full
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) {
                this.cache.delete(oldestKey);
            }
        }

        this.cache.set(key, {
            data: structuredClone(data), // Deep clone to prevent mutations
            expires: Date.now() + ttl
        });
    }

    get(key: string) {
        const entry = this.cache.get(key);
        if (!entry) return null;
        
        if (Date.now() > entry.expires) {
            this.cache.delete(key);
            return null;
        }
        
        return structuredClone(entry.data);
    }

    invalidate(pattern: string | string[]) {
        const patterns = Array.isArray(pattern) ? pattern : [pattern];
        
        for (const key of this.cache.keys()) {
            if (patterns.some(p => key.includes(p) || key.match(new RegExp(p.replace(/\*/g, '.*'))))) {
                this.cache.delete(key);
            }
        }
    }

    clear() {
        this.cache.clear();
    }
}

// WebSocket manager
class WebSocketManager {
    private connections = new Map<string, WebSocket>();
    private eventHandlers = new Map<string, Set<Function>>();

    connect(url: string, protocols?: string | string[]) {
        if (this.connections.has(url)) {
            return this.connections.get(url)!;
        }

        const ws = new WebSocket(url, protocols);
        this.connections.set(url, ws);

        ws.onclose = () => {
            this.connections.delete(url);
            this.eventHandlers.delete(url);
        };

        return ws;
    }

    on(url: string, event: string, handler: Function) {
        const key = `${url}:${event}`;
        if (!this.eventHandlers.has(key)) {
            this.eventHandlers.set(key, new Set());
        }
        this.eventHandlers.get(key)!.add(handler);

        const ws = this.connections.get(url);
        if (ws) {
            ws.addEventListener(event as any, handler as any);
        }
    }

    off(url: string, event: string, handler: Function) {
        const key = `${url}:${event}`;
        const handlers = this.eventHandlers.get(key);
        if (handlers) {
            handlers.delete(handler);
            const ws = this.connections.get(url);
            if (ws) {
                ws.removeEventListener(event as any, handler as any);
            }
        }
    }

    send(url: string, data: any) {
        const ws = this.connections.get(url);
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(typeof data === 'string' ? data : JSON.stringify(data));
        } else {
            throw new Error(`WebSocket connection to ${url} is not open`);
        }
    }

    close(url: string) {
        const ws = this.connections.get(url);
        if (ws) {
            ws.close();
        }
    }
}

// Enhanced API response
class JetResponse {
    constructor(
        public response: Response,
        public cached: boolean = false,
        public fromCache: boolean = false
    ) {}

    get ok() { return this.response.ok; }
    get status() { return this.response.status; }
    get statusText() { return this.response.statusText; }
    get headers() { return this.response.headers; }
    get url() { return this.response.url; }

    async json<T = any>(): Promise<T> {
        return this.response.json();
    }

    async text(): Promise<string> {
        return this.response.text();
    }

    async blob(): Promise<Blob> {
        return this.response.blob();
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        return this.response.arrayBuffer();
    }

    async formData(): Promise<FormData> {
        return this.response.formData();
    }
}

// Enhanced API function types


// The amazing Jet class
export class Jetflare {
    origin: string;
    cache = new CacheManager();
    wsManager = new WebSocketManager();
    private defaultHeaders: Record<string, string> = {};
    private defaultTimeout = 30000;
    
    interceptors = {
        request: new Set<(config: any) => any>(),
        response: new Set<(response: JetResponse) => JetResponse>(),
        error: new Set<(error: Error) => Error>()
    };

    [key: string]: any;

    constructor(options: { origin: string, routes: Record<string, {
     path: string;
     method: string;
     query: Record<string, any>;
     title: string;
        params: Record<string, any>;
        headers?: Record<string, string>;
    }>
    }) {
        if (!options.origin) {
            throw new Error('Origin URL is required');
        }
        if (!options.routes) {
            throw new Error('Routes are required');
        }
        if (typeof options.routes !== 'object') {
            throw new Error('Routes must be an object');
        }
        try {
            new URL(options.origin);
            this.origin = options.origin.replace(/\/$/, '');
        } catch {
            throw new Error(`Invalid origin URL: ${options.origin}`);
        }

        this.setupRoutes(options.routes);
    }

    private setupRoutes(routes: Record<string, { path: string; method: string; query: Record<string, any>; title: string; params: Record<string, any>; headers?: Record<string, string>; }>) {
        for (const routeKey in routes) {
            if (Object.prototype.hasOwnProperty.call(routes, routeKey)) {
                const currentRouteKey = routeKey as keyof typeof routes;
                const routeDef = routes[currentRouteKey];

                if (routeDef.method === 'websocket') {
                    this[currentRouteKey] = this.createWebSocketFunction(routeDef);
                } else if (routeDef.method === 'sse') {
                    this[currentRouteKey] = this.createSSEFunction(routeDef);
                } else {
                    this[currentRouteKey] = this.createHttpFunction(routeDef, currentRouteKey);
                }
            }
        }
    }

    private createWebSocketFunction(routeDef: any) {
        return (payload: { protocols?: string | string[] } = {}) => {
            const wsUrl = this.origin.replace(/^http/, 'ws') + routeDef.path;
            
            return {
                connect: () => this.wsManager.connect(wsUrl, payload.protocols),
                on: (event: string, handler: Function) => this.wsManager.on(wsUrl, event, handler),
                off: (event: string, handler: Function) => this.wsManager.off(wsUrl, event, handler),
                send: (data: any) => this.wsManager.send(wsUrl, data),
                close: () => this.wsManager.close(wsUrl)
            };
        };
    }

    private createSSEFunction(routeDef: any) {
        return (payload: ApiFunctionPayload = {}) => {
            let eventSource: EventSource | null = null;
            const url = this.buildUrl(routeDef, payload);
            
            return {
                connect: () => {
                    eventSource = new EventSource(url);
                    return eventSource;
                },
                on: (event: string, handler: Function) => {
                    if (eventSource) {
                        eventSource.addEventListener(event, handler as any);
                    }
                },
                close: () => {
                    if (eventSource) {
                        eventSource.close();
                    }
                }
            };
        };
    }

    private createHttpFunction(routeDef: any, routeKey: string) {
        return async (payload: ApiFunctionPayload = {}): Promise<JetResponse> => {
            try {
                // Apply request interceptors
                let config = { ...payload, route: routeDef };
                for (const interceptor of this.interceptors.request) {
                    config = interceptor(config);
                }

                // Check cache first
                const cacheConfig = payload.cache !== false ? (routeDef.cache || payload.cache) : false;
                if (cacheConfig && routeDef.method.toLowerCase() === 'get') {
                    const cacheKey = this.buildCacheKey(routeDef, payload, cacheConfig);
                    const cached = this.cache.get(cacheKey);
                    if (cached) {
                        const response = new Response(JSON.stringify(cached), {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' }
                        });
                        return new JetResponse(response, true, true);
                    }
                }

                const response = await this.makeRequest(routeDef, config, routeKey);
                let jetResponse = new JetResponse(response, !!cacheConfig);

                // Apply response interceptors
                for (const interceptor of this.interceptors.response) {
                    jetResponse = interceptor(jetResponse);
                }

                // Cache successful responses
                if (cacheConfig && response.ok && routeDef.method.toLowerCase() === 'get') {
                    const cacheKey = this.buildCacheKey(routeDef, payload, cacheConfig);
                    const data = await response.clone().json().catch(() => response.clone().text());
                    this.cache.set(cacheKey, data, cacheConfig.ttl || 300000);
                }

                // Invalidate cache for mutations
                if (routeDef.invalidates && response.ok) {
                    this.cache.invalidate(routeDef.invalidates);
                }

                return jetResponse;

            } catch (error) {
                let processedError = error as Error;
                for (const interceptor of this.interceptors.error) {
                    processedError = interceptor(processedError);
                }
                throw processedError;
            }
        };
    }

    private buildUrl(routeDef: any, payload: ApiFunctionPayload): string {
        let actualPath = routeDef.path;

        // Replace path parameters
        if (payload.params) {
            for (const [paramKey, paramValue] of Object.entries(payload.params)) {
                if (paramValue == null) {
                    throw new Error(`Missing required parameter: ${paramKey}`);
                }
                actualPath = actualPath.replace(`:${paramKey}`, encodeURIComponent(String(paramValue)));
            }
        }

        const url = new URL(`${this.origin}${actualPath}`);

        // Add query parameters
        if (payload.query) {
            for (const [key, value] of Object.entries(payload.query)) {
                if (value != null) {
                    if (Array.isArray(value)) {
                        value.forEach(item => url.searchParams.append(key, String(item)));
                    } else {
                        url.searchParams.append(key, String(value));
                    }
                }
            }
        }

        return url.toString();
    }

    private buildCacheKey(routeDef: any, payload: ApiFunctionPayload, cacheConfig: any): string {
        let key = cacheConfig.key || routeDef.path;
        
        // Replace dynamic parts
        if (payload.params) {
            for (const [paramKey, paramValue] of Object.entries(payload.params)) {
                key = key.replace(`:${paramKey}`, String(paramValue));
            }
        }

        // Add query string to cache key
        if (payload.query) {
            const queryString = new URLSearchParams(payload.query).toString();
            if (queryString) {
                key += `?${queryString}`;
            }
        }

        return key;
    }

    private async makeRequest(routeDef: any, payload: ApiFunctionPayload, _routeKey: string): Promise<Response> {
        const url = this.buildUrl(routeDef, payload);
        const method = routeDef.method.toUpperCase();
        
        // Prepare headers
        const headers = {
            ...this.defaultHeaders,
            ...routeDef.headers,
            ...payload.headers
        };

        const isBodyMethod = ['POST', 'PUT', 'PATCH'].includes(method);
        let body: any = null;

        // Handle file uploads
        if (routeDef.upload && payload.files) {
            const formData = new FormData();
            
            const files = Array.isArray(payload.files) ? payload.files : 
                         payload.files instanceof FileList ? Array.from(payload.files) : [payload.files];
            
            files.forEach((file, index) => {
                formData.append(`file${index}`, file);
            });

            // Add other body data to FormData
            if (payload.body) {
                for (const [key, value] of Object.entries(payload.body)) {
                    formData.append(key, String(value));
                }
            }

            body = formData;
            // Don't set Content-Type for FormData, let browser set it with boundary
            delete headers['Content-Type'];
        } else if (payload.body && isBodyMethod) {
            if (!headers['Content-Type']) {
                headers['Content-Type'] = 'application/json';
            }
            
            body = headers['Content-Type'] === 'application/json' 
                ? JSON.stringify(payload.body) 
                : payload.body;
        }

        // Setup AbortController for timeout and cancellation
        const controller = new AbortController();
        const timeout = payload.timeout || this.defaultTimeout;
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                method,
                headers,
                body,
                signal: controller.signal,
                // ...payload
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${timeout}ms`);
            }
            throw error;
        }
    }

    // Public API methods
    setBaseURL(url: string) {
        this.origin = url.replace(/\/$/, '');
    }

    setDefaultHeaders(headers: Record<string, string>) {
        Object.assign(this.defaultHeaders, headers);
    }

    setDefaultTimeout(timeout: number) {
        this.defaultTimeout = timeout;
    }

    // Fluent API for common patterns
    withAuth(token: string) {
        this.setDefaultHeaders({ Authorization: `Bearer ${token}` });
        return this;
    }

    withTimeout(timeout: number) {
        this.setDefaultTimeout(timeout);
        return this;
    }

    withBaseURL(url: string) {
        this.setBaseURL(url);
        return this;
    }
}
