import {
  _jet_middleware,
  _JetPath_paths,
  _JetPath_paths_trie,
  assignMiddleware,
  codeGen,
  compileAPI,
  compileUI,
  corsMiddleware,
  fs,
  getHandlers,
  getHandlersEdge,
  getLocalIP,
  server,
} from './primitives/functions.js';
import type { jetOptions, UnionToIntersection } from './primitives/types.js';
import { JetPlugin, LOG } from './primitives/classes.js';
import { readFile } from 'node:fs/promises';
import { cwd } from 'node:process';
import path from 'node:path';

const html_path = path.join(cwd(),"/node_modules/jetpath/dist/jetpath-doc.html");
export class Jetpath {
  public server: {
    listen: any;
    edge: boolean;
  } = { listen: () => {}, edge: false };
  private listening = false;
  /**
   * an object you can set values to per request
   */
  plugins: any[] = [];
  private options: jetOptions = {
    port: 8080,
    apiDoc: { display: 'UI' },
    cors: true,
    strictMode: 'OFF',
    source: '.',
  };
  private plugs: JetPlugin[] = [];
  constructor(options: jetOptions = {}) {
    //? setting up default values
    Object.assign(this.options, options);
    // ? setting up app configs
    corsMiddleware({
      exposeHeaders: [],
      allowMethods: ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT'],
      origin: ['*'],
      allowHeaders: ['*'],
      maxAge: '86400',
      keepHeadersOnError: true,
      ...(typeof options?.cors === 'object' ? options.cors : {}),
    });
    //?
    if (!this.options.port) this.options.port = 8080;
  }
  derivePlugins<
    JetPluginTypes extends {
      executor: (init: any) => Record<string, Function>;
      server?: any;
      name: string;
    }[] = [],
  >(...plugins: JetPluginTypes) {
    if (this.listening) {
      throw new Error("Your app is listening new plugins can't be added.");
    }
    plugins.forEach((plugin) => {
      if (
        typeof plugin.executor === 'function' ||
        typeof plugin.name === 'string'
      ) {
        // ? add plugin to the server
        this.plugs.push(new JetPlugin(plugin));
      } else {
        throw new Error('Plugin executor and name is required');
      }
    });
    return this as unknown as UnionToIntersection<JetPluginTypes[number]> &
      Record<string, any>;
  }
  async listen(): Promise<void> {
    // ? {-view-} here is replaced at build time to html
    const UI = await readFile(html_path, {
      encoding: "utf-8",
    });
    
    if (!this.options.source) {
      LOG.log(
        'Jetpath: Provide a source directory to avoid scanning the root directory',
        'warn'
      );
    }
    LOG.log('Compiling...', 'info');
    const startTime = performance.now();
    const localIP = getLocalIP();
    // ? Load all jetpath functions described in user code
    const errorsCount = await getHandlers(this.options?.source || '.', true);
    const endTime = performance.now();
    // LOG.log("Compiled!");
    //? compile API
    const [handlersCount, compiledAPI] = compileAPI(this.options);
    // ? render API in UI
    if (this.options?.apiDoc?.display === 'UI') {
      this.api_UI_req(UI);
      LOG.log(
        `Compiled ${handlersCount} Functions\nTime: ${Math.round(
          endTime - startTime
        )}ms`,
        'info'
      );
      //? generate types
      if (/(ON|WARN)/.test(this.options?.strictMode || 'OFF')) {
        await codeGen(
          this.options.source || '.',
          this.options.strictMode as 'ON' | 'WARN',
          { local: `http://localhost:${this.options.port}`, external: `http://${localIP}:${this.options.port}` },
          this.options.generatedRoutesFilePath
        );
      }
      LOG.log(
        `APIs: Viewable at http://localhost:${this.options.port}${
          this.options?.apiDoc?.path || '/api-doc'
        }`,
        'info'
      );
    } else if (this.options?.apiDoc?.display === 'HTTP') {
      //? generate types
      await codeGen(
        this.options.source || '.',
        this.options?.strictMode as 'ON' | 'WARN',
        { local: `http://localhost:${this.options.port}`, external: `http://${localIP}:${this.options.port}` },
        this.options.generatedRoutesFilePath
      );
      // ? render API in a .HTTP file
      await fs().writeFile('api-doc.http', compiledAPI);
      LOG.log(
        `Compiled ${handlersCount} Functions\nTime: ${Math.round(
          endTime - startTime
        )}ms`,
        'info'
      );
      LOG.log(`APIs: written to ${fs().sep}api-doc.http`, 'info');
    }
    if (errorsCount) {
      for (let i = 0; i < errorsCount.length; i++) {
        LOG.log(
          `\nReport: ${errorsCount[i].file} file was not loaded due to \n "${
            errorsCount[i].error
          }" error; \n please resolve!`,
          'warn'
        );
      }
    }

    //
    assignMiddleware(_JetPath_paths, _jet_middleware);
    // ? start server
    // ? check if server is already listening
    this.server = server(this.plugs, this.options);
    // ? add plugins to the server
    if (
      this.server.edge &&
      typeof this.options.edgeGrabber?.length === 'number'
    ) {
      await getHandlersEdge(this.options.edgeGrabber);
      if (this.options?.apiDoc?.display === 'UI') {
        this.api_UI_req(UI);
      }
      this.server.listen();
      LOG.log('Jetpath: Edge is enabled', 'success');
      return;
    } else if (this.server.edge && !this.options.edgeGrabber?.length) {
      // ? edge is enabled but no edgeGrabber provided
      throw new Error(
        'Jetpath: the runtime is Edge is enabled but no edgeGrabber provided. Please provide edgeGrabber in options.'
      );
    }
    this.listening = true;

    this.server.listen(this.options.port);
    LOG.log(`Open http://localhost:${this.options.port}`, 'info');
    // ? show external IP 
    if (localIP) {
      LOG.log(`External: http://${localIP}:${this.options.port}`, 'info');
    }
  }

  api_UI_req(UI: string): void {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, compiledAPI] = compileAPI(this.options);
    const name = this.options?.apiDoc?.path || '/api-doc';
    _JetPath_paths_trie['GET'].insert(name, (ctx) => {
      UI = compileUI(UI, this.options, compiledAPI);
      if (this.options.apiDoc?.username && this.options.apiDoc?.password) {
        const authHeader = ctx.get('authorization');
        if (authHeader && authHeader.startsWith('Basic ')) {
          const [authType, encodedToken] = authHeader.trim().split(' ');
          if (authType !== 'Basic' || !encodedToken) {
            ctx.set('WWW-Authenticate', 'Basic realm=Jetpath API Doc');
            ctx.send('<h1>Unauthorized</h1>', 401, 'text/html');
            return;
          }
          let username, password;
          try {
            const decodedToken = new TextDecoder().decode(
              Uint8Array.from(atob(encodedToken), (c) => c.charCodeAt(0))
            );
            [username, password] = decodedToken.split(':');
          } catch (error) {
            ctx.set('WWW-Authenticate', 'Basic realm=Jetpath API Doc');
            ctx.send('<h1>Unauthorized</h1>', 401, 'text/html');
            return;
          }
          if (
            password === this.options?.apiDoc?.password &&
            username === this.options?.apiDoc?.username
          ) {
            ctx.send(UI, 200, 'text/html');
            return;
          } else {
            ctx.set('WWW-Authenticate', 'Basic realm=Jetpath API Doc');
            ctx.send('<h1>Unauthorized</h1>', 401, 'text/html');
            return;
          }
        } else {
          ctx.set('WWW-Authenticate', 'Basic realm=Jetpath API Doc');
          ctx.send('<h1>Unauthorized</h1>', 401, 'text/html');
          return;
        }
      } else {
        ctx.send(UI, 200, 'text/html');
        return;
      }
    });
  }
}

//? exports
export type {
  JetContext,
  JetFile,
  JetMiddleware,
  JetRoute,
  JetPluginExecutorInitParams,
} from './primitives/types.js';
export { JetServer } from './primitives/classes.js';
export { use } from './primitives/functions.js';
export { mime } from './extracts/mimejs-extract.js';
