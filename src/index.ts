import mime from "mime/lite";

import { writeFile } from "node:fs/promises";
import {
  _JetPath_hooks,
  _JetPath_paths,
  compileAPI,
  compileUI,
  corsHook,
  getHandlers,
  UTILS,
} from "./primitives/functions.js";
import { type jetOptions } from "./primitives/types.js";
import { JetPlugin, Log } from "./primitives/classes.js";

export class JetPath {
  public server: any;
  private listening: boolean = false;
  private options: jetOptions = { port: 8080, APIdisplay: "UI", cors: true };
  private plugs: JetPlugin[] = [];
  constructor(options?: jetOptions) {
    Object.assign(this.options, options || {});
    if (!this.options.port) this.options.port = 8080;
    // ? setting up app configs
    if (this.options.cors !== false) {
      _JetPath_hooks["cors"] = corsHook({
        exposeHeaders: [],
        allowMethods: ["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT"],
        origin: ["*"],
        allowHeaders: ["*"],
        maxAge: "86400",
        keepHeadersOnError: true,
        ...(typeof options?.cors === "object" ? options.cors : {}),
      });
    }
  }
  use(plugin: JetPlugin): void {
    if (this.listening) {
      throw new Error("Your app is listening new plugins can't be added.");
    }
    if (plugin instanceof JetPlugin) {
      this.plugs.push(plugin);
    } else {
      throw Error("invalid Jetpath plugin");
    }
  }
  async listen(): Promise<void> {
    // ? kickoff server
    this.server = UTILS.server(this.plugs);
    // ? {-view-} here is replaced at build time to html
    let UI = `{{view}}`; //! could be loaded only when needed
    // ? setting up static server
    if (this.options?.static?.route && this.options?.static?.dir) {
      _JetPath_paths["GET"][
        (this.options.static.route === "/" ? "" : this.options.static.route) +
          "/*"
      ] = async (ctx) => {
        const fileName =
          this.options?.static?.dir +
          "/" +
          // @ts-expect-error
          decodeURI(ctx.params?.["extraPath"] || "").split("?")[0];
        const contentType = mime.getType(fileName.split(".").at(-1) || "");
        ctx.sendStream(fileName, contentType || "application/octet-stream");
      };
    }

    //? setting up api viewer
    if (this.options?.APIdisplay !== undefined) {
      Log.info("♻️  Compiling routes...");
      const startTime = performance.now();
      // ? Load all jetpath functions described in user code
      const errorsCount = await getHandlers(this.options?.source!, true);
      const endTime = performance.now();
      //? compile API
      const [handlersCount, compiledAPI] = compileAPI(this.options);
      // ? render API in UI
      if (this.options?.APIdisplay === "UI") {
        UI = compileUI(UI, this.options, compiledAPI);
        _JetPath_paths["GET"][this.options?.apiDoc?.path || "/api-doc"] = (
          ctx
        ) => {
          ctx.send(UI, "text/html");
        };
        Log.info(
          `✅ Processed routes ${handlersCount} handlers in ${Math.round(
            endTime - startTime
          )}ms`
        );
        Log.success(
          `visit http://localhost:${this.options.port}${
            this.options?.apiDoc?.path || "/api-doc"
          } to see the displayed routes in UI`
        );
      }
      // ? render API in a .HTTP file
      if (this.options?.APIdisplay === "HTTP") {
        await writeFile("api-doc.http", compiledAPI);
        Log.info(
          `✅ Processed routes ${handlersCount} handlers in ${Math.round(
            endTime - startTime
          )}ms`
        );
        Log.success(
          `Check http file ./api-doc.http to test the routes Visual Studio rest client extension`
        );
      }
      if (errorsCount) {
        for (let i = 0; i < errorsCount.length; i++) {
          Log.error(
            `\nReport: ${errorsCount[i].file} file was not loaded due to \n "${errorsCount[i].error}" error; \n please resolve!`
          );
        }
      }
    } else {
      // ? Load all jetpath functions described in user code
      const errorsCount = await getHandlers(this.options?.source!, false);
      if (errorsCount) {
        for (let i = 0; i < errorsCount.length; i++) {
          Log.error(
            `\n\n\nReport: ${errorsCount[i].file} file was not loaded due to \n "${errorsCount[i].error}" error; \n please resolve!`
          );
        }
      }
    }
    Log.success(`Listening on http://localhost:${this.options.port}`);
    // ? start server
    this.listening = true;
    this.server.listen(this.options.port);
  }
}

//? exports
export type { Context, JetFunc } from "./primitives/types.js";
export { JetPlugin } from "./primitives/classes.js";
