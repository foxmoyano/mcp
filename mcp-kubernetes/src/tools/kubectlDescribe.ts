import type { Tool } from '../types.js';
import { runKubectl } from '../utils/kubectl.js';
import { vName } from '../utils/validation.js';

const kubectlDescribe: Tool = {
  name: 'kubectl_describe',
  description: 'kubectl describe <kind> <name> [-n ns]',
  inputSchema: {
    type: 'object',
    properties: { kind: { type: 'string' }, name: { type: 'string' }, namespace: { type: 'string' } },
    required: ['kind', 'name']
  },
  handler: async ({ kind, name, namespace }) => {
    vName(name, 'resource'); vName(namespace, 'namespace');
    const args = ['describe', kind, name];
    if (namespace) args.push('-n', namespace);
    const { code, stdout, stderr } = await runKubectl(args);
    if (code !== 0) throw new Error(stderr || `kubectl describe falló (${code})`);
    return { content: [{ type: 'text', text: stdout }] };
  }
};

export default kubectlDescribe;
