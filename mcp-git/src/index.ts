import * as dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import "dotenv/config";
import { spawn } from "node:child_process";

// ---------- util: ejecutar git ----------
type ExecResult = { code: number; stdout: string; stderr: string };

function runGit(args: string[], cwd?: string, stdinData?: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn("git", args, { env: process.env, cwd });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    if (stdinData) { child.stdin.write(stdinData); child.stdin.end(); }
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

// Validaciones simples
const BRANCH_RE = /^[A-Za-z0-9._\/-]{1,255}$/;
function vPath(p?: string) { if (!p) throw new Error("'path' es requerido y debe apuntar a un repo git"); }
function vBranch(b?: string) { if (!b) return; if (!BRANCH_RE.test(b)) throw new Error(`branch inválida: ${b}`); }

// ---------- tool registry (manual) ----------
type Tool = {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any) => Promise<{ content: Array<{ type: "text"|"json"; text?: string; json?: any }> }>;
};

const tools: Tool[] = [];
function addTool(t: Tool) { tools.push(t); }

// ---------- definir tools Git ----------
addTool({
  name: "git.status",
  description: "git status (porcelain) + rama actual y ahead/behind",
  inputSchema: {
    type: "object",
    properties: { path: { type: "string" }, porcelain: { type: "boolean", default: true } },
    required: ["path"]
  },
  handler: async ({ path, porcelain = true }) => {
    vPath(path);
    const b = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], path);
    if (b.code !== 0) throw new Error(b.stderr || "No es un repo git");
    const up = await runGit(["rev-list", "--left-right", "--count", "HEAD...@{u}"], path);
    const [behindStr, aheadStr] = (up.stdout || "0\t0").trim().split("\t");
    const st = await runGit(["status", porcelain ? "--porcelain" : "--short"], path);
    if (st.code !== 0) throw new Error(st.stderr || "git status falló");
    const header = `On ${b.stdout.trim()} (ahead ${aheadStr}, behind ${behindStr})`;
    return { content: [{ type: "text", text: `${header}\n${st.stdout}` }] };
  }
});

// ... aquí puedes añadir los demás tools (diff, add, commit, push, pull, switch, log, stash, stashPop, tag)
// El patrón es el mismo que viste: construir args, ejecutar con runGit, validar, y devolver { content: [...] }

// ---------- server & handlers MCP ----------
const server = new Server(
  { name: "mcp-git", version: "0.1.0" },
  { capabilities: { tools: {}, prompts: {}, resources: {} } }
);

const transport = new StdioServerTransport();

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))
  };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = (req as any)?.params?.name;
  const args = (req as any)?.params?.arguments ?? {};
  const t = tools.find(x => x.name === name);
  if (!t) throw new Error(`Tool no encontrada: ${name}`);
  return await t.handler(args);
});

async function main() { await server.connect(transport); }
main().catch(err => { console.error(err); process.exit(1); });
