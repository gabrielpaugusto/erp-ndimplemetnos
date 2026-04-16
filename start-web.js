const { spawn } = require('child_process');
const path = require('path');

const root = __dirname;

const proc = spawn('pnpm', ['--filter', '@erp/web', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: '3000' },
});

proc.on('exit', (code) => process.exit(code || 0));
proc.on('error', (err) => { console.error(err); process.exit(1); });
