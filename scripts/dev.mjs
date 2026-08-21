import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const processes = [
  {
    name: 'backend',
    command: npmCommand,
    args: ['run', 'dev'],
    cwd: fileURLToPath(new URL('../backend/', import.meta.url))
  },
  {
    name: 'frontend',
    command: npmCommand,
    args: ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'],
    cwd: fileURLToPath(new URL('../frontend/', import.meta.url))
  }
];

const children = processes.map(({ name, command, args, cwd }) => {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: ['inherit', 'pipe', 'pipe']
  });

  const prefix = `[${name}]`;

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`${prefix} ${chunk}`.replaceAll('\n', `\n${prefix} `));
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`${prefix} ${chunk}`.replaceAll('\n', `\n${prefix} `));
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`${prefix} stopped by ${signal}`);
      return;
    }

    if (code !== 0) {
      console.error(`${prefix} exited with code ${code}`);
      shutdown();
    }
  });

  return child;
});

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  children.forEach((child) => {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
