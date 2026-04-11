#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

const gitCheck = spawnSync("git", ["--version"], { stdio: "ignore" });
if (gitCheck.status !== 0) {
  console.error("Error: Git is not installed or not found in your PATH.");
  process.exit(1);
}

const [targetDir = "new-jetpath-project", branch = "main"] = process.argv.slice(
  2,
);

// Sanitize inputs to prevent command injection
const safeDirPattern = /^[a-zA-Z0-9._\-/]+$/;
if (!safeDirPattern.test(targetDir) || !safeDirPattern.test(branch)) {
  console.error(
    "Error: Invalid characters in target directory or branch name.",
  );
  process.exit(1);
}

try {
  spawnSync(
    "git",
    [
      "clone",
      "--depth",
      "1",
      "--branch",
      branch,
      "https://github.com/codedynasty-dev/jetpath-sample.git",
      targetDir,
    ],
    { stdio: "inherit" },
  );
  console.log(`
    🚀 Project created successfully!
    cd ${targetDir}
    npm install
    npm install jetpath@latest #important
    npm run dev
    `);
} catch (err) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.error("Error during git clone:", (err as any).message);
  process.exit(1);
}

try {
  rmSync(join(targetDir, ".git"), { recursive: true, force: true });
} catch (err) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.error("Warning: failed to remove .git folder:", (err as any).message);
}
