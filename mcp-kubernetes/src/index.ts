import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import tools from './tools/index.js';

const server = new Server(
  { name: 'mcp-kubernetes', version: '0.1.0' },
  { capabilities: { tools: {}, prompts: {}, resources: {} } }
);

const transport = new StdioServerTransport();

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params?.name;
  const args = (req.params as any)?.arguments ?? {};
  const t = tools.find(x => x.name === name);
  if (!t) throw new Error(`Tool no encontrada: ${name}`);
  return await t.handler(args);
});

async function main() {
  await server.connect(transport);
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});