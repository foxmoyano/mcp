import type { Tool } from '../types.js';
import { runKubectl } from '../utils/kubectl.js';
import { vName } from '../utils/validation.js';

const kubectlGet: Tool = {
  name: 'kubectl_get',
  description: 'kubectl get <kind> [name] [-n ns] [-l sel] -o json|yaml|wide',
  inputSchema: {
    type: 'object',
    properties: {
      kind: { type: 'string' },
      namespace: { type: 'string' },
      name: { type: 'string' },
      selector: { type: 'string' },
      output: { type: 'string', enum: ['json', 'yaml', 'wide'], default: 'json' }
    },
    required: ['kind']
  },
  handler: async ({ kind, namespace, name, selector, output = 'json' }) => {
    vName(namespace, 'namespace'); vName(name, 'resource');
    const args = ['get', kind];
    if (name) args.push(name);
    if (namespace) args.push('-n', namespace);
    if (selector) args.push('-l', selector);
    args.push('-o', output === 'wide' ? 'wide' : output);
    const { code, stdout, stderr } = await runKubectl(args);
    if (code !== 0) throw new Error(stderr || `kubectl get falló (${code})`);
    if (output === 'json') return { content: [{ type: 'json', json: JSON.parse(stdout) }] };
    return { content: [{ type: 'text', text: stdout }] };
  }
};

export default kubectlGet;
