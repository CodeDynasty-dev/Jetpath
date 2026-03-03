export const fs = await (async () => {
  try {
    // detect edge;
    const { opendir, readdir, readFile, writeFile } =
      await import('node:fs/promises');
    // import { opendir, readdir, readFile, writeFile } from "node:fs/promises";
    const { dirname, join, resolve, sep } = await import('node:path');
    // import { dirname, join, resolve, sep } from "node:path";
    const { cwd } = await import('node:process');
    // import { cwd } from "node:process";

    const { createReadStream, realpathSync } = await import('node:fs');
    // import { createReadStream, realpathSync } from "node:fs";

    const { createServer } = await import('node:http');
    const { networkInterfaces } = await import('node:os');
    const { execFile } = await import('node:child_process');
    const { mkdirSync } = await import('node:fs');
    const { pathToFileURL } = await import('node:url');

    const fils_system_apis = {
      opendir,
      readdir,
      readFile,
      writeFile,
      dirname,
      join,
      resolve,
      sep,
      cwd,
      createReadStream,
      realpathSync,
      createServer,
      networkInterfaces,
      execFile,
      mkdirSync,
      pathToFileURL,
    };
    return () => fils_system_apis;
  } catch (error) {
    return () => {
      throw new Error(
        'Node.js APIs are not available in this environment. Please ensure you are using edgeGrabber for edge environment, check the edge docs for more information.'
      );
    };
  }
})();
