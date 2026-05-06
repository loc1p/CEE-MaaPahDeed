#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const backendDir = __dirname;
const isWindows = process.platform === 'win32';
const script = isWindows ? 'setup-lv-chordia.ps1' : 'setup-lv-chordia.sh';
const command = isWindows ? 'powershell' : 'bash';
const args = isWindows
  ? ['-ExecutionPolicy', 'Bypass', '-File', path.join(backendDir, script), ...process.argv.slice(2)]
  : [path.join(backendDir, script), ...process.argv.slice(2)];

const result = spawnSync(command, args, {
  cwd: backendDir,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`Failed to run ${script}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status || 0);
