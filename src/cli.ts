#!/usr/bin/env node
import { spawnSync, execSync } from 'node:child_process';
import { rmSync }            from 'node:fs';
import { join }              from 'node:path';

// 0. Ensure Git is installed
const gitCheck = spawnSync('git', ['--version'], { stdio: 'ignore' });
if (gitCheck.status !== 0) {
  console.error('Error: Git is not installed or not found in your PATH.');
  process.exit(1);
}

// 1. Parse CLI args: [repo, targetDir, branch]
const [targetDir = 'new-jetpath-project', branch = 'main'] = process.argv.slice(2);

// 2. Shallow‑clone the desired branch
try {
  execSync(
    `git clone --depth 1 --branch ${branch} https://github.com/codedynasty-dev/jetpath-sample.git ${targetDir}`,
    { stdio: 'inherit' }
  );
} catch (err) {
    // @ts-ignore
  console.error('Error during git clone:', err.message);
  process.exit(1);
}

// 3. Remove the .git folder recursively & forcefully
try {
  rmSync(join(targetDir, '.git'), { recursive: true, force: true });
} catch (err) {
    // @ts-ignore

  console.error('Warning: failed to remove .git folder:', err.message);
}
