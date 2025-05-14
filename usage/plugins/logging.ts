import { appendFileSync } from "node:fs";
import { JetPlugin } from "../../dist/index.js";
import { resolve } from "node:path";


/**
 * Supported log levels
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';
const levelRank: Record<LogLevel, number> = {
    trace: 10,
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
};

/**
 * Configuration options for the logging plugin
 */
export interface LoggingConfig {
    level?: LogLevel;                            // minimum level to emit
    format?: 'json' | 'text';                    // format of log entries
    filename?: string;                           // file to write logs to
    getRequestId?: (req: Request) => string;     // extract or generate a request ID
    transports?: Transport[];                    // custom transports (overrides filename/format defaults)
}

/**
 * Structure of a log entry
 */
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message?: string;
    method: string;
    url: string;
    requestId?: string;
    meta?: Record<string, unknown>;
}

/** Transport interface for log targets */
export interface Transport {
    log(entry: LogEntry): Promise<void> | void;
}

/** Default console transport, respects JSON or text */
export class ConsoleTransport implements Transport {
    private format: 'json' | 'text' = 'json';
    constructor(format: 'json' | 'text' = 'json') {
        this.format = format;
    }
    log(entry: LogEntry) {
        const line = this.format === 'json'
            ? JSON.stringify(entry)
            : `${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.method} ${entry.url} - ${entry.message}${Object.keys(entry.meta || {}).length ? ' ' + JSON.stringify(entry.meta) : ''}`;
        console.log(line);
    }
}

/** File transport for Node/Bun/Deno, appends to given filename */
export class FileTransport implements Transport {
    private filename: string;
    private format: 'json' | 'text' = 'json';
    constructor(
        filename: string,
        format: 'json' | 'text' = 'json'
    ) {
        this.filename = filename;
        this.format = format;
    }
    log(entry: LogEntry) {
        const line = this.format === 'json'
            ? JSON.stringify(entry)
            : `${entry.timestamp} [${entry.level.toUpperCase()}] ${entry.method} ${entry.url} - ${entry.message}${Object.keys(entry.meta || {}).length ? ' ' + JSON.stringify(entry.meta) : ''}`;
        // Cross-runtime append
        appendFileSync(resolve(this.filename), line + '\n');
    }
}

/**
 * Creates a JetPlugin with structured logging capabilities
 */
export const jetLogger = new JetPlugin<{
    level?: LogLevel;
    format?: 'json' | 'text';
    filename?: string;
    getRequestId?: (req: Request) => string;
    transports?: Transport[];
}>({
    executor() {        
        const { level = 'info', format = 'json', filename, getRequestId, transports: customTransports } = this.config;
        // Determine transports: custom, or build from filename/console defaults
        const transports: Transport[] = customTransports
            ? customTransports
            : filename
                ? [new FileTransport(filename, format)]
                : [new ConsoleTransport(format)];
        // Send entry to all configured transports
        async function emit(entry: LogEntry) {
            for (const t of transports) {
                try { await t.log(entry); }
                catch (err) { console.error('Logging transport error:', err); }
            }
        }

        // Level filtering
        function shouldLog(entryLevel: LogLevel) {
            return levelRank[entryLevel] >= levelRank[level];
        }

        // Build the entry object
        function buildEntry(
            entryLevel: LogLevel,
            ctx: { request: Request },
            message?: string,
            meta?: Record<string, unknown>
        ): LogEntry {
            const { request } = ctx;
            return {
                timestamp: new Date().toISOString(),
                level: entryLevel,
                message: typeof message === 'string' ? message : JSON.stringify(message),
                method: request.method,
                url: request.url,
                requestId: getRequestId?.(request),
                meta,
            };
        }

        // Exposed log methods
        return {
            trace(ctx: { request: Request }, message: any, meta?: Record<string, unknown>) {
                if (!shouldLog('trace')) return;
                emit(buildEntry('trace', ctx, message, meta));
            },
            debug(ctx: { request: Request }, message: any, meta?: Record<string, unknown>) {
                if (!shouldLog('debug')) return;
                emit(buildEntry('debug', ctx, message, meta));
            },
            info(ctx: { request: Request }, message?: any, meta?: Record<string, unknown>) {
                if (!shouldLog('info')) return;
                emit(buildEntry('info', ctx, message, meta));
            },
            warn(ctx: { request: Request }, message: any, meta?: Record<string, unknown>) {
                if (!shouldLog('warn')) return;
                emit(buildEntry('warn', ctx, message, meta));
            },
            error(ctx: { request: Request }, message: any, meta?: Record<string, unknown>) {
                if (!shouldLog('error')) return;
                emit(buildEntry('error', ctx, message, meta));
            },
        };
    },
});


export type jetLoggerType = ReturnType<typeof jetLogger.executor>


