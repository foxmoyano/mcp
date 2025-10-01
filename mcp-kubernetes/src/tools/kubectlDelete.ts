import type { Tool } from '../types.js';
import { runKubectl } from '../utils/kubectl.js';
import { vName } from '../utils/validation.js';

const kubectlDelete: Tool = {
  name: 'kubectl_delete',
  description: 'kubectl delete <kind> <name> [-n ns] [--grace-period=N]',
  inputSchema: {
    type: 'object',
    properties: {
      kind: { type: 'string' },
      name: { type: 'string' },
      namespace: { type: 'string' },
      gracePeriod: { type: 'number', minimum: 0 }
    },
    required: ['kind', 'name']
  },
  handler: async ({ kind, name, namespace, gracePeriod }) => {
    vName(name, 'resource'); vName(namespace, 'namespace');
    const args = ['delete', kind, name];
    if (namespace) args.push('-n', namespace);
    if (typeof gracePeriod === 'number') args.push(`--grace-period=${gracePeriod}`);
    const { code, stdout, stderr } = await runKubectl(args);
    if (code !== 0) throw new Error(stderr || `kubectl delete falló (${code})`);
    return { content: [{ type: 'text', text: stdout || 'Deleted' }] };
  }
};

export default kubectlDelete;
