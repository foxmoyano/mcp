import type { Tool } from '../types.js';
import { runKubectl } from '../utils/kubectl.js';
import { vName } from '../utils/validation.js';

const kubectlLogs: Tool = {
  name: 'kubectl_logs',
  description: 'kubectl logs <pod> [-c container] [-n ns] [--tail=N] [--previous]',
  inputSchema: {
    type: 'object',
    properties: {
      pod: { type: 'string' },
      namespace: { type: 'string' },
      container: { type: 'string' },
      tailLines: { type: 'number', minimum: 1, maximum: 10000 },
      previous: { type: 'boolean' }
    },
    required: ['pod']
  },
  handler: async ({ pod, namespace, container, tailLines, previous }) => {
    vName(pod, 'pod'); vName(namespace, 'namespace'); vName(container, 'container');
    const args = ['logs', pod];
    if (container) args.push('-c', container);
    if (namespace) args.push('-n', namespace);
    if (tailLines) args.push(`--tail=${tailLines}`);
    if (previous) args.push('--previous');
    const { code, stdout, stderr } = await runKubectl(args);
    if (code !== 0) throw new Error(stderr || `kubectl logs falló (${code})`);
    return { content: [{ type: 'text', text: stdout }] };
  }
};

export default kubectlLogs;
