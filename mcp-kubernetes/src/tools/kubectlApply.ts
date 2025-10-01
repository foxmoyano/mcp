import type { Tool } from '../types.js';
import { runKubectl } from '../utils/kubectl.js';
import { vName } from '../utils/validation.js';

const kubectlApply: Tool = {
    name: 'kubectl_apply',
    description: 'kubectl apply -f - [-n ns] [--server-side]',
    inputSchema: {
        type: 'object',
        properties: {
            manifest: { type: 'string' },
            namespace: { type: 'string' },
            serverSide: { type: 'boolean' }
        },  
        required: ['manifest']
    },
    handler: async ({ manifest, namespace, serverSide }) => {
        vName(namespace, 'namespace');
        const args = ['apply', '-f', '-'];
        if (namespace) args.push('-n', namespace);
        if (serverSide) args.push('--server-side');
        const { code, stdout, stderr } = await runKubectl(args, manifest);
        if (code !== 0) throw new Error(stderr || `kubectl apply falló (${code})`);
        return { content: [{ type: 'text', text: stdout }] };
    }
};

export default kubectlApply;