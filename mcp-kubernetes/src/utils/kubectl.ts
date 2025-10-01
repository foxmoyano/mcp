import { spawn } from 'node:child_process';
import type { ExecResult } from '../types.js';

export function runKubectl(args: string[], stdinData?: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn('kubectl', args, { env: process.env });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    if (stdinData) { child.stdin.write(stdinData); child.stdin.end(); }
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}