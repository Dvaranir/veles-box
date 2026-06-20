import { spawn } from 'node:child_process';

export function runCommand(command, args, { cwd, timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (callback) => (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject)(new Error(`${command} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', finish(reject));
    child.on('close', finish((code) => {
      if (code === 0) return resolve({ stdout, stderr });
      return reject(new Error(`${command} exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
    }));
  });
}
