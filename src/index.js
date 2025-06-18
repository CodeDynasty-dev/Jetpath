import { writeFile } from "node:fs/promises";
import { sep } from "node:path";
import { _jet_middleware, _JetPath_paths, _JetPath_paths_trie, assignMiddleware, codeGen, compileAPI, compileUI, corsMiddleware, getHandlers, getLocalIP, server, } from "./primitives/functions.js";
import { JetPlugin, LOG } from "./primitives/classes.js";
export class Jetpath {
    server;
    listening = false;
    /**
     * an object you can set values to per request
     */
    plugins = [];
    options = {
        port: 8080,
        apiDoc: { display: "UI" },
        cors: false,
        strictMode: "OFF",
        source: ".",
    };
    plugs = [];
    constructor(options = {}) {
        Object.assign(this.options, options);
        if (!this.options.port)
            this.options.port = 8080;
        // ? setting up app configs
        if (this.options.cors === true) {
            corsMiddleware({
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
    derivePlugins(...plugins) {
        if (this.listening) {
            throw new Error("Your app is listening new plugins can't be added.");
        }
        plugins.forEach((plugin) => {
            if (typeof plugin.executor === "function" || typeof plugin.name === "string") {
                // ? add plugin to the server
                this.plugs.push(new JetPlugin(plugin));
            }
            else {
                throw new Error("Plugin executor and name is required");
            }
        });
        return this;
    }
    async listen() {
        if (!this.options.source) {
            LOG.log("Jetpath: Provide a source directory to avoid scanning the root directory", "warn");
        }
        // ? {-view-} here is replaced at build time to html
        let UI = `{{view}}`;
        LOG.log("Compiling...", "info");
        const startTime = performance.now();
        // ? Load all jetpath functions described in user code
        const errorsCount = await getHandlers(this.options?.source, true);
        const endTime = performance.now();
        // LOG.log("Compiled!");
        //? compile API
        const [handlersCount, compiledAPI] = compileAPI(this.options);
        // ? render API in UI
        if (this.options?.apiDoc?.display === "UI") {
            UI = compileUI(UI, this.options, compiledAPI);
            const name = this.options?.apiDoc?.path || "/api-doc";
            _JetPath_paths_trie["GET"].insert(name, (ctx) => {
                if (this.options.apiDoc?.username && this.options.apiDoc?.password) {
                    const authHeader = ctx.get("authorization");
                    if (authHeader && authHeader.startsWith("Basic ")) {
                        const [authType, encodedToken] = authHeader.trim().split(" ");
                        if (authType !== "Basic" || !encodedToken) {
                            ctx.set("WWW-Authenticate", `Basic realm=Jetpath API Doc`);
                            ctx.send(`<h1>Unauthorized</h1>`, 401, "text/html");
                            return;
                        }
                        let username, password;
                        try {
                            const decodedToken = new TextDecoder().decode(Uint8Array.from(atob(encodedToken), (c) => c.charCodeAt(0)));
                            [username, password] = decodedToken.split(":");
                        }
                        catch (error) {
                            ctx.set("WWW-Authenticate", `Basic realm=Jetpath API Doc`);
                            ctx.send(`<h1>Unauthorized</h1>`, 401, "text/html");
                            return;
                        }
                        if (password === this.options?.apiDoc?.password &&
                            username === this.options?.apiDoc?.username) {
                            ctx.send(UI, 200, "text/html");
                            return;
                        }
                        else {
                            ctx.set("WWW-Authenticate", `Basic realm=Jetpath API Doc`);
                            ctx.send(`<h1>Unauthorized</h1>`, 401, "text/html");
                            return;
                        }
                    }
                    else {
                        ctx.set("WWW-Authenticate", `Basic realm=Jetpath API Doc`);
                        ctx.send(`<h1>Unauthorized</h1>`, 401, "text/html");
                        return;
                    }
                }
                else {
                    ctx.send(UI, 200, "text/html");
                    return;
                }
            });
            LOG.log(`Compiled ${handlersCount} Functions\nTime: ${Math.round(endTime - startTime)}ms`, "info");
            //? generate types
            if (/(ON|WARN)/.test(this.options?.strictMode || "OFF")) {
                await codeGen(this.options.source || ".", this.options.strictMode, this.options.generatedRoutesFilePath);
            }
            LOG.log(`APIs: Viewable at http://localhost:${this.options.port}${this.options?.apiDoc?.path || "/api-doc"}`, "info");
        }
        else if (this.options?.apiDoc?.display === "HTTP") {
            //? generate types
            await codeGen(this.options.source || ".", this.options?.strictMode, this.options.generatedRoutesFilePath);
            // ? render API in a .HTTP file
            await writeFile("api-doc.http", compiledAPI);
            LOG.log(`Compiled ${handlersCount} Functions\nTime: ${Math.round(endTime - startTime)}ms`, "info");
            LOG.log(`APIs: written to ${sep}api-doc.http`, "info");
        }
        if (errorsCount) {
            for (let i = 0; i < errorsCount.length; i++) {
                LOG.log(`\nReport: ${errorsCount[i].file} file was not loaded due to \n "${errorsCount[i].error}" error; \n please resolve!`, "warn");
            }
        }
        this.server = server(this.plugs, this.options);
        //
        assignMiddleware(_JetPath_paths, _jet_middleware);
        // ? start server
        this.listening = true;
        this.server.listen(this.options.port);
        LOG.log(`Open http://localhost:${this.options.port}`, "info");
        // ? show external IP
        const localIP = getLocalIP();
        if (localIP) {
            LOG.log(`External: http://${localIP}:${this.options.port}`, "info");
        }
    }
}
export { JetServer } from "./primitives/classes.js";
export { use } from "./primitives/functions.js";
export { mime } from "./extracts/mimejs-extract.js";
