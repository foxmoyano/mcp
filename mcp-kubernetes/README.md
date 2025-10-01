# MCP Kubernetes Server

Un servidor MCP (Model Context Protocol) que proporciona herramientas para interactuar con clusters de Kubernetes a través de `kubectl`.

## 📋 Descripción

Este servidor MCP permite a los asistentes de IA ejecutar comandos de Kubernetes de forma segura y estructurada, proporcionando una interfaz estandarizada para operaciones comunes de Kubernetes como obtener recursos, aplicar manifiestos, gestionar rollouts y más.

## 🛠️ Herramientas Disponibles

### 1. `kubectl_get`
Obtiene recursos de Kubernetes con diferentes formatos de salida.

**Parámetros:**
- `kind` (requerido): Tipo de recurso (deployment, pod, service, etc.)
- `name` (opcional): Nombre específico del recurso
- `namespace` (opcional): Namespace del recurso
- `selector` (opcional): Selector de etiquetas
- `output` (opcional): Formato de salida (`json`, `yaml`, `wide`) - por defecto `json`

**Ejemplo:**
```typescript
kubectl_get({
  kind: "deployment",
  namespace: "default",
  output: "json"
})
```

### 2. `kubectl_describe`
Muestra información detallada de un recurso específico.

**Parámetros:**
- `kind` (requerido): Tipo de recurso
- `name` (requerido): Nombre del recurso
- `namespace` (opcional): Namespace del recurso

**Ejemplo:**
```typescript
kubectl_describe({
  kind: "pod",
  name: "my-pod",
  namespace: "default"
})
```

### 3. `kubectl_logs`
Obtiene los logs de un pod específico.

**Parámetros:**
- `pod` (requerido): Nombre del pod
- `container` (opcional): Nombre del contenedor específico
- `namespace` (opcional): Namespace del pod
- `tailLines` (opcional): Número de líneas finales a mostrar (máx. 10000)
- `previous` (opcional): Obtener logs del contenedor anterior

**Ejemplo:**
```typescript
kubectl_logs({
  pod: "my-app-123",
  namespace: "production",
  tailLines: 100
})
```

### 4. `kubectl_apply`
Aplica manifiestos de Kubernetes.

**Parámetros:**
- `manifest` (requerido): Contenido del manifiesto YAML/JSON
- `namespace` (opcional): Namespace donde aplicar
- `serverSide` (opcional): Usar server-side apply

**Ejemplo:**
```typescript
kubectl_apply({
  manifest: `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
spec:
  containers:
  - name: test
    image: nginx
  `,
  namespace: "default"
})
```

### 5. `kubectl_delete`
Elimina recursos de Kubernetes.

**Parámetros:**
- `kind` (requerido): Tipo de recurso
- `name` (requerido): Nombre del recurso
- `namespace` (opcional): Namespace del recurso
- `gracePeriod` (opcional): Período de gracia para la eliminación

**Ejemplo:**
```typescript
kubectl_delete({
  kind: "deployment",
  name: "old-app",
  namespace: "default",
  gracePeriod: 30
})
```

### 6. `kubectl_exec`
Ejecuta comandos dentro de un pod.

**Parámetros:**
- `pod` (requerido): Nombre del pod
- `command` (requerido): Array de comandos a ejecutar
- `container` (opcional): Nombre del contenedor específico
- `namespace` (opcional): Namespace del pod

**Ejemplo:**
```typescript
kubectl_exec({
  pod: "debug-pod",
  command: ["ls", "-la", "/app"],
  namespace: "default"
})
```

### 7. `kubectl_port_forward`
Crea un port-forward temporal hacia un pod o servicio.

**Parámetros:**
- `target` (requerido): Objetivo (pod/nombre o svc/nombre)
- `mapping` (requerido): Mapeo de puertos (local:remoto)
- `namespace` (opcional): Namespace del recurso
- `seconds` (opcional): Duración en segundos (1-120, por defecto 5)

**Ejemplo:**
```typescript
kubectl_port_forward({
  target: "svc/my-service",
  mapping: "8080:80",
  namespace: "default",
  seconds: 30
})
```

### 8. `kubectl_rollout`
Gestiona rollouts de deployments, daemonsets y statefulsets.

**Parámetros:**
- `action` (requerido): Acción a ejecutar (`status`, `history`, `undo`, `restart`, `pause`, `resume`)
- `resourceType` (requerido): Tipo de recurso (`deployment`, `daemonset`, `statefulset`)
- `name` (requerido): Nombre del recurso
- `namespace` (opcional): Namespace del recurso
- `revision` (opcional): Número de revisión para `undo`
- `timeout` (opcional): Timeout para `status` (ej: 300s, 5m)

**Ejemplos:**
```typescript
// Verificar estado del rollout
kubectl_rollout({
  action: "status",
  resourceType: "deployment",
  name: "my-app",
  namespace: "production"
})

// Reiniciar deployment
kubectl_rollout({
  action: "restart",
  resourceType: "deployment",
  name: "my-app",
  namespace: "production"
})

// Deshacer a revisión anterior
kubectl_rollout({
  action: "undo",
  resourceType: "deployment",
  name: "my-app",
  revision: "2"
})
```

## 🚀 Instalación y Configuración

### Prerrequisitos

- Node.js (versión 16 o superior)
- `kubectl` instalado y configurado
- Acceso a un cluster de Kubernetes

### Instalación

1. **Clonar el repositorio:**
```bash
git clone <repository-url>
cd mcp-kubernetes
```

2. **Instalar dependencias:**
```bash
npm install
```

3. **Compilar el proyecto:**
```bash
npm run build
```

### Configuración

#### Opción 1: VS Code con extensión MCP

Crea o edita el archivo `.vscode/mcp.json` en tu workspace:

```json
{
    "servers": {
        "kubernetes": {
            "command": "node",
            "args": ["path/to/mcp-kubernetes/dist/index.js"],
            "env": {
                "KUBECONFIG": "/path/to/your/kubeconfig"
            }
        }
    }
}
```

#### Opción 2: Cliente MCP estándar

```bash
# Ejecutar el servidor directamente
npm start

# O en modo desarrollo
npm run dev
```

## 🔧 Desarrollo

### Estructura del Proyecto

```
mcp-kubernetes/
├── src/
│   ├── index.ts          # Servidor principal MCP
│   ├── types.ts          # Definiciones de tipos
│   ├── tools/            # Herramientas disponibles
│   │   ├── index.ts      # Exporta todas las herramientas
│   │   ├── kubectlGet.ts
│   │   ├── kubectlApply.ts
│   │   ├── kubectlDelete.ts
│   │   ├── kubectlDescribe.ts
│   │   ├── kubectlExec.ts
│   │   ├── kubectlLogs.ts
│   │   ├── kubectlPortForward.ts
│   │   └── kubectlRollout.ts
│   └── utils/            # Utilidades
│       ├── kubectl.ts    # Ejecutor de kubectl
│       └── validation.ts # Validaciones
├── dist/                 # Código compilado
├── package.json
├── tsconfig.json
└── README.md
```

### Scripts Disponibles

- `npm run build`: Compila el proyecto TypeScript
- `npm run clean`: Limpia el directorio dist
- `npm start`: Ejecuta el servidor compilado
- `npm run dev`: Compila y ejecuta en modo desarrollo

### Agregar Nuevas Herramientas

1. Crear un nuevo archivo en `src/tools/` (ej: `kubectlNewTool.ts`)
2. Implementar la interfaz `Tool`:

```typescript
import type { Tool } from '../types.js';
import { runKubectl } from '../utils/kubectl.js';
import { vName } from '../utils/validation.js';

const kubectlNewTool: Tool = {
  name: 'kubectl_new_tool',
  description: 'Descripción de la nueva herramienta',
  inputSchema: {
    type: 'object',
    properties: {
      // Definir parámetros
    },
    required: ['param1', 'param2']
  },
  handler: async (args) => {
    // Implementar lógica
    const { code, stdout, stderr } = await runKubectl(['comando', 'args']);
    if (code !== 0) throw new Error(stderr || 'Error');
    return { content: [{ type: 'text', text: stdout }] };
  }
};

export default kubectlNewTool;
```

3. Agregar la exportación en `src/tools/index.ts`:

```typescript
import kubectlNewTool from './kubectlNewTool.js';

export const tools: Tool[] = [
    // ... otras herramientas
    kubectlNewTool,
];
```

## 🔒 Seguridad

- **Validación de entrada**: Todos los parámetros son validados antes de la ejecución
- **Namespace isolation**: Soporta operaciones específicas por namespace
- **Error handling**: Manejo robusto de errores de kubectl
- **Timeouts**: Configurables para operaciones de larga duración

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-herramienta`)
3. Commit tus cambios (`git commit -am 'Agrega nueva herramienta'`)
4. Push a la rama (`git push origin feature/nueva-herramienta`)
5. Crea un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

Si encuentras algún problema o tienes sugerencias:

1. Revisa los [issues existentes](../../issues)
2. Crea un nuevo issue con detalles del problema
3. Incluye información del entorno (versión de kubectl, cluster, etc.)

## 📚 Recursos Adicionales

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Reference](https://kubernetes.io/docs/reference/kubectl/)

---

**Nota**: Este servidor MCP está diseñado para uso en entornos de desarrollo y testing. Para uso en producción, asegúrate de implementar las medidas de seguridad y control de acceso apropiadas.