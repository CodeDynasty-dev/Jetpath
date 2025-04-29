import { type JetMiddleware, Jetpath } from "jetpath";
import { SafeToken } from "safetoken";

export const auth = new SafeToken({
  secret: "qdxlpowfjcieruvuirhvgbuirgbu8rhu8ghrgbvhur",
  timeWindows: {
    access: 60 * 60 * 1000,
  },
});

//  middleware declaration

export const MIDDLEWARE_: JetMiddleware = async (ctx) => {
  console.log(ctx.request.method, ctx.request.url);
  try {
    if (ctx.request.method !== "GET") {
      await ctx.parse({ maxBodySize: 1024 * 1024 * 20 });
    }
  } catch (error) {
    console.log(String(error), "body");
    ctx.code = 500;
    ctx.throw({
      message: error.message || "Internal Server Error",
      ok: false,
    });
    return;
  }
  return (ctx, err: unknown) => {
    if (err) {
      console.log(String(err), "err");
      ctx.code = ctx.code < 299 ? 500 : ctx.code;
      ctx.send({
        message: String(err) || "Internal Server Error",
        ok: false,
      });
      return;
    }
  };
};

export const app = new Jetpath({
  source: "./src",
  apiDoc: {
    name: "Audit Server API",
    info: "This is the documentation for the Audit Server API.",
    color: "#7e57c2", // Choose a color!
    password: "grey11",
    username: "admin",
    display: "UI",
  }, 
  upgrade: true
});

app.listen();
