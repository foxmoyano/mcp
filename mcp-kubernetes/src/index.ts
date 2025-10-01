import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from 'node:child_process';

// ---------- util: ejecutar kubectl ----------
type ExecResult = { code: number; stdout: string; stderr: string };

function runKubectl(args: string[], stdinData?: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn('kubectl', args, { env: process.env });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    if (stdinData) { child.stdin.write(stdinData); child.stdin.end(); }
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

const NAME_RE = /^[a-z0-9]([-a-z0-9\.]*[a-z0-9])?$/i;
function vName(v?: string, label = 'name') {
  if (!v) return;
  if (!NAME_RE.test(v)) throw new Error(`${label} inválido: ${v}`);
}

// ---------- tool registry (manual) ----------
type Tool = {
  name: string;
  description: string;
  inputSchema: any; // JSON-schema-like (no tipado)
  handler: (args: any) => Promise<{ content: Array<{ type: 'text'|'json'; text?: string; json?: any }> }>;
};

const tools: Tool[] = [];

// helper para registrar
function addTool(t: Tool) { tools.push(t); }

// ---------- definir tools ----------
addTool({
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
    if (output === 'json') {
      return { content: [{ type: 'json', json: JSON.parse(stdout) }] };
    }
    return { content: [{ type: 'text', text: stdout }] };
  }
});

addTool({
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
});

addTool({
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
});

addTool({
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
});

addTool({
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
});

addTool({
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
});

addTool({
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
});

// ---------- server & handlers MCP ----------
const server = new Server(
  { name: 'mcp-k8s', version: '0.1.0' },
  { capabilities: { tools: {}, prompts: {}, resources: {} } }
);

const transport = new StdioServerTransport();

// tools/list → devolver metadatos de tus tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema, // tu objeto JSON-schema-like
    })),
  };
});

// tools/call → ejecutar la tool por nombre
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params?.name;
  // Nota: en MCP el campo se llama "arguments", no "args"
  const args = (req.params as any)?.arguments ?? {};
  const t = tools.find(x => x.name === name);
  if (!t) {
    // puedes devolver isError:true, pero lanzar Error también es válido
    throw new Error(`Tool no encontrada: ${name}`);
  }
  // Tu handler debe devolver { content: [...] }
  return await t.handler(args);
});

// ---------- start ----------
async function main() {
  await server.connect(transport);
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
