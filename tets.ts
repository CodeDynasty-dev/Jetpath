/**
 * Assigns middleware functions to routes while ensuring that each route gets exactly one middleware function.
 * A middleware function can be shared across multiple routes.
 *
 * @param _JetPath_paths - An object mapping HTTP methods to route-handler maps.
 * @param _jet_middleware - An object mapping route paths to an array of middleware functions.
 */
function assignMiddleware(
  _JetPath_paths: { [method: string]: { [route: string]: any } },
  _jet_middleware: {
    [route: string]: (
      ctx: any,
      next: () => Promise<void>,
    ) => Promise<void> | void;
  },
): void {
  // Iterate over each HTTP method's routes.
  for (const method in _JetPath_paths) {
    const routes = _JetPath_paths[method];
    for (const route in routes) {
      // If middleware is defined for the route, ensure it has exactly one middleware function.
      for (const key in _jet_middleware) {
        if (route.startsWith(key)) {
          const middleware = _jet_middleware[key];
          // console.log({ route, key, middleware });
          if (routes[route].jet_middleware) {
            throw new Error(
              `Route "${route}" (Method: ${method}) must have exactly one middleware. 
            Found an additional middleware ${key}.
            
            🔧 Fix: Please Ensure the route "${route}" has exactly one middleware.`,
            );
          }
          // Assign the middleware function to the route handler.
          routes[route].jet_middleware = middleware;
        }
      }
    }
  }
  console.log(
    Object.keys(_JetPath_paths).flatMap((k) => {
      return Object.keys(_JetPath_paths[k]).map((j) => ({
        url: j,
        mdw: _JetPath_paths[k][j].jet_middleware,
      }));
    }),
  );
}

// Example definitions:
const _JetPath_paths = {
  GET: {
    "/assets/*": async function GET_assets() {/* ... */},
    "/": function GET_() {/* ... */},
    "/error": async function GET_error() {/* ... */},
    "/greet": function GET_greet() {/* ... */},
    "/petBy/:id": async function GET_petBy$id() {/* ... */},
    "/pets": function GET_pets() {/* ... */},
    "/pets/search/?": async function GET_pets_search$$() {/* ... */},
  },
  POST: {
    "/": async function POST_() {/* ... */},
    "/petImage/:id": async function POST_petImage$id() {/* ... */},
    "/pets": async function POST_pets() {/* ... */},
  },
  HEAD: {},
  PUT: {
    "/petBy/:id": async function PUT_petBy$id() {/* ... */},
  },
  PATCH: {},
  DELETE: {
    "/petBy/:id": function DELETE_petBy$id() {/* ... */},
  },
  OPTIONS: {},
};

const _jet_middleware = {
  "/petBy": async function MIDDLEWARE_petBy$0(ctx, next) {
    console.log("Global middleware for route /");
    await next();
  },
  "/": async function MIDDLEWARE_$0(ctx, next) {
    console.log("Global middleware for route /");
    await next();
  },
};

// Run middleware assignment.
assignMiddleware(_JetPath_paths, _jet_middleware);
