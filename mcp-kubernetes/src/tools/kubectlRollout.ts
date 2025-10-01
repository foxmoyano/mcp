import type { Tool } from '../types.js';
import { runKubectl } from '../utils/kubectl.js';
import { vName } from '../utils/validation.js';

const kubectlRollout: Tool = {
  name: 'kubectl_rollout',
  description: 'kubectl rollout [status|history|undo|restart|pause|resume] [deployment|daemonset|statefulset]/name [-n namespace]',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['status', 'history', 'undo', 'restart', 'pause', 'resume'],
        description: 'Acción de rollout a ejecutar'
      },
      resourceType: {
        type: 'string',
        enum: ['deployment', 'daemonset', 'statefulset'],
        description: 'Tipo de recurso (deployment, daemonset, statefulset)'
      },
      name: {
        type: 'string',
        description: 'Nombre del recurso'
      },
      namespace: {
        type: 'string',
        description: 'Namespace del recurso (opcional)'
      },
      revision: {
        type: 'string',
        description: 'Número de revisión para undo (opcional)'
      },
      timeout: {
        type: 'string',
        description: 'Timeout para status (ej: 300s, 5m, opcional)'
      }
    },
    required: ['action', 'resourceType', 'name']
  },
  handler: async ({ action, resourceType, name, namespace, revision, timeout }) => {
    vName(namespace, 'namespace');
    vName(name, 'resource');
    
    const args = ['rollout', action];
    
    // Construir el recurso tipo/nombre
    const resource = `${resourceType}/${name}`;
    args.push(resource);
    
    // Agregar namespace si se especifica
    if (namespace) {
      args.push('-n', namespace);
    }
    
    // Agregar opciones específicas según la acción
    switch (action) {
      case 'undo':
        if (revision) {
          args.push(`--to-revision=${revision}`);
        }
        break;
      case 'status':
        if (timeout) {
          args.push(`--timeout=${timeout}`);
        }
        break;
    }
    
    const { code, stdout, stderr } = await runKubectl(args);
    
    if (code !== 0) {
      throw new Error(stderr || `kubectl rollout ${action} falló (código: ${code})`);
    }
    
    return {
      content: [{
        type: 'text',
        text: stdout || `Rollout ${action} ejecutado exitosamente para ${resource}${namespace ? ` en namespace ${namespace}` : ''}`
      }]
    };
  }
};

export default kubectlRollout;