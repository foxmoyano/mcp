import type { Tool } from '../types.js';
import { runKubectl } from '../utils/kubectl.js';
import { vName } from '../utils/validation.js';

const kubectlExec: Tool = {
  name: 'kubectl_exec',
  description: 'kubectl exec <pod> [-c container] [-n ns] -- <cmd...>',
  inputSchema: {
    type: 'object',
    properties: {
      pod: { type: 'string' },
      namespace: { type: 'string' },
      container: { type: 'string' },
      command: { type: 'array', items: { type: 'string' } }
    },
    required: ['pod', 'command']
  },
  handler: async ({ pod, namespace, container, command }) => {
    vName(pod, 'pod'); vName(namespace, 'namespace'); vName(container, 'container');
    const args = ['exec', pod];
    if (container) args.push('-c', container);
    if (namespace) args.push('-n', namespace);
    args.push('--', ...command);
    const { code, stdout, stderr } = await runKubectl(args);
    if (code !== 0) throw new Error(stderr || `kubectl exec falló (${code})`);
    return { content: [{ type: 'text', text: stdout }] };
  }
};

export default kubectlExec;
