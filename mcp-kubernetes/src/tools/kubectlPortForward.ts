import type { Tool } from '../types.js';
import { vName } from '../utils/validation.js';
import { spawn } from 'node:child_process';

const kubectlPortForward: Tool = {
  name: 'kubectl_portForward',
  description: 'kubectl port-forward <pod|svc/name> <local:remote> [-n ns] (efímero)',
  inputSchema: {
    type: 'object',
    properties: {
      target: { type: 'string' },
      mapping: { type: 'string' }, // "8080:80"
      namespace: { type: 'string' },
      seconds: { type: 'number', default: 5, minimum: 1, maximum: 120 }
    },
    required: ['target', 'mapping']
  },
  handler: async ({ target, mapping, namespace, seconds = 5 }) => {
    vName(namespace, 'namespace');
    const child = spawn('kubectl', ['port-forward', target, mapping, ...(namespace ? ['-n', namespace] : [])], { env: process.env });
    let log = '';
    child.stdout.on('data', (d) => (log += d.toString()));
    child.stderr.on('data', (d) => (log += d.toString()));
    await new Promise((r) => setTimeout(r, Math.max(1, Math.min(seconds, 120)) * 1000));
    try { child.kill('SIGINT'); } catch {}
    return { content: [{ type: 'text', text: log || `Port-forward finalizado (${seconds}s).` }] };
  }
};

export default kubectlPortForward;
