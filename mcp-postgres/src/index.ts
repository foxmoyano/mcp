#!/usr/bin/env node

// index.ts — MCP server para PostgreSQL con UNA sola tool (ListTableTool)

import * as dotenv from "dotenv";
import { Pool } from "pg";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ⚠️ Usaremos tu misma tool por ahora.
// OJO: la versión que compartiste está hecha con `mssql`.
// Para que funcione con Postgres, deberá usar `pool.query(...)` posteriormente.
import { ListTableTool } from "./tools/ListTableTool.js";
import { DropTableTool } from "./tools/DropTableTool.js";
import { ReadDataTool } from "./tools/ReadDataTool.js";
import { InsertDataTool } from "./tools/InsertDataTool.js";
import { DescribeTableTool } from "./tools/DescribeTableTool.js";
import { CreateTableTool } from "./tools/CreateTableTool.js";
import { CreateIndexTool } from "./tools/CreateIndexTool.js";
import { UpdateDataTool } from "./tools/UpdateDataTool.js";
dotenv.config();


// ========= Config PG =========
let globalPgPool: Pool | null = null;

function buildPool(): Pool {
  const useSSL = (process.env.PGSSL || "false").toLowerCase() === "true";
  const rejectUnauthorized = (process.env.PGSSL_REJECT_UNAUTH || "false").toLowerCase() === "true";
  const port = process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432;

  // Log de diagnóstico a stderr
  console.error(`[mcp-pg] buildPool host=${process.env.PGHOST} port=${port} db=${process.env.PGDATABASE} user=${process.env.PGUSER}`);

  return new Pool({
    host: process.env.PGHOST,
    port,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: useSSL ? { rejectUnauthorized } : undefined,
    // opcionales: idleTimeoutMillis, max, etc.
  });
}

async function ensurePgConnection(): Promise<void> {
  if (globalPgPool) {
    try {
      await globalPgPool.query("SELECT 1");
      return;
    } catch {
      try { await globalPgPool.end(); } catch {}
      globalPgPool = null;
    }
  }
  globalPgPool = buildPool();
  await globalPgPool.query("SELECT 1"); // smoke test
}

function attachPoolToTool(tool: any) {
  // Si tu tool expone setPool(), úsala; si no, inyecta propiedad pública
  if (typeof tool.setPool === "function") {
    tool.setPool(globalPgPool);
  } else {
    tool.pool = globalPgPool;
  }
}

// ========= Instancias =========
const listTableTool = new ListTableTool();
const dropTableTool = new DropTableTool();
const readDataTool = new ReadDataTool();
const insertDataTool = new InsertDataTool();
const describeTableTool = new DescribeTableTool();
const createTableTool = new CreateTableTool();
const createIndexTool = new CreateIndexTool();
const updateDataTool = new UpdateDataTool();

const server = new Server(
  { name: "postgres-mcp-server", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// ========= Handlers =========

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const readDataTool = new ReadDataTool();

  const tools = [
    {
      name: listTableTool.name,
      description: listTableTool.description,
      inputSchema: listTableTool.input_schema
    },
    {
      name: dropTableTool.name,
      description: dropTableTool.description,
      inputSchema: dropTableTool.inputSchema
    },
    {
      name: readDataTool.name,
      description: readDataTool.description,
      inputSchema: readDataTool.input_schema
    },
    {
      name: insertDataTool.name,
      description: insertDataTool.description,
      inputSchema: insertDataTool.inputSchema
    },
    {
      name: describeTableTool.name,
      description: describeTableTool.description,
      inputSchema: describeTableTool.inputSchema
    },
    {
      name: createTableTool.name,
      description: createTableTool.description,
      inputSchema: createTableTool.inputSchema
    },
    {
      name: createIndexTool.name,
      description: createIndexTool.description,
      inputSchema: createIndexTool.inputSchema
    },
    {
      name: updateDataTool.name,
      description: updateDataTool.description,
      inputSchema: updateDataTool.inputSchema
    }
  ];
  console.error("[mcp-pg] tools/list ->", tools.map(t => t?.name));
  return { tools
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === listTableTool.name) {
      const result = await listTableTool.run(args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === readDataTool.name) {
      await ensurePgConnection();
      readDataTool.setPool(globalPgPool!);

      let callArgs = (args || {}) as any;

      // Compat: si viene tableName y NO query, construimos SELECT seguro
      if (!callArgs.query && typeof callArgs.tableName === "string") {
        const tn = callArgs.tableName as string;
        const limit = Number.isFinite(callArgs.limit) && callArgs.limit > 0 ? Math.floor(callArgs.limit) : 100;

        const parts = tn.split(".");
        const quoteIdent = (id: string) => {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) throw new Error(`Invalid identifier: ${id}`);
          return `"${id}"`;
        };
        const quoted = parts.map(quoteIdent).join(".");
        callArgs = { query: `SELECT * FROM ${quoted} LIMIT ${limit}` };
      }

      // Si eliges exigir SIEMPRE query a partir de aquí:
      if (!callArgs.query || typeof callArgs.query !== "string") {
        return { content: [{ type: "text", text: "Missing or invalid 'query' argument for read_data tool (must be a SELECT string)." }], isError: true };
      }

      const result = await readDataTool.run(callArgs);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
    
    if (name === dropTableTool.name) {
      if (!args || typeof args.tableName !== "string") {
        return {
          content: [
            { type: "text", text: "Missing or invalid 'tableName' argument for drop_table tool." },
          ],
          isError: true,
        };
      }
      const result = await dropTableTool.run(args as { tableName: string; cascade?: boolean });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    if (name === insertDataTool.name) {
      if (!args || typeof args.tableName !== "string" || typeof args.data !== "object") {
        return {
          content: [
            { type: "text", text: "Missing or invalid arguments for insert_data tool." },
          ],
          isError: true,
        };
      }
      const result = await insertDataTool.run(args as { tableName: string; data: Record<string, any> });
      return { content: [{ type: "json", json: result }] };
    }

    if (name === describeTableTool.name) {
      if (!args || typeof args.tableName !== "string") {
        return {
          content: [
            { type: "text", text: "Missing or invalid 'tableName' argument for describe_table tool." },
          ],
          isError: true,
        };
      }
      const result = await describeTableTool.run(args as { tableName: string });
      return { content: [{ type: "json", json: result }] };
    }

    if (name === createTableTool.name) {
      if (!args || typeof args.tableName !== "string" || !Array.isArray(args.columns)) {
        return {
          content: [
            { type: "text", text: "Missing or invalid arguments for create_table tool." },
          ],
          isError: true,
        };
      }
      const result = await createTableTool.run(args as { tableName: string; columns: Array<{ name: string; type: string; constraints?: string[] }> });
      return { content: [{ type: "json", json: result }] };
    }

    if (name === createIndexTool.name) {
      if (!args || typeof args.tableName !== "string" || typeof args.indexName !== "string" || !Array.isArray(args.columns)) {
        return {
          content: [
            { type: "text", text: "Missing or invalid arguments for create_index tool." },
          ],
          isError: true,
        };
      }
      if (args.type && !["btree", "hash", "gist", "gin"].includes(args.type as string)) {
        return {
          content: [
            { type: "text", text: "Invalid index type. Allowed values are: btree, hash, gist, gin." },
          ],
          isError: true,
        };
      }
      const result = await createIndexTool.run(args as { tableName: string; indexName: string; columns: string[]; unique?: boolean; type?: "btree" | "hash" | "gist" | "gin" });
      return { content: [{ type: "json", json: result }] };
    }

    if (name === updateDataTool.name) {
      if (!args || typeof args.tableName !== "string" || typeof args.data !== "object" || typeof args.where !== "object") {
        return {
          content: [
            { type: "text", text: "Missing or invalid arguments for update_data tool." },
          ],
          isError: true,
        };
      }
      const result = await updateDataTool.run(args as { tableName: string; data: Record<string, any>; where: Record<string, any> });
      return { content: [{ type: "json", json: result }] };
    }

    return {
      content: [
        { type: "text", text: `Unknown tool: ${name}` },
      ],
      isError: true,
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        content: [
          { type: "text", text: `Error executing tool: ${error.message}` },
        ],
        isError: true,
      };
    }
    return {
      content: [
        { type: "text", text: "An unknown error occurred." },
      ],
      isError: true,
    };
  }
});

// ========= Startup =========
const EAGER_CONNECT = (process.env.EAGER_CONNECT || "").toLowerCase() === "true";
const FAIL_ON_STARTUP_DB = (process.env.FAIL_ON_STARTUP_DB || "").toLowerCase() === "true";

async function runServer() {
  try {
    console.error("Iniciando servidor MCP para PostgreSQL...");

    // ⬅️ OBLIGA un intento de conexión aquí
    await ensurePgConnection();
    console.error("[mcp-pg] Conexión a Postgres OK en startup.");

    // ⬅️ Inyectar el pool a todas las tools
    attachPoolToTool(listTableTool);
    attachPoolToTool(dropTableTool);
    attachPoolToTool(readDataTool);
    attachPoolToTool(insertDataTool);
    attachPoolToTool(describeTableTool);
    attachPoolToTool(createTableTool);
    attachPoolToTool(createIndexTool);
    attachPoolToTool(updateDataTool);

    const transport = new StdioServerTransport();
    await server.connect(transport);

    // ⬅️ Este banner solo se imprime si el ping pasó
    console.error("Servidor MCP para PostgreSQL iniciado y listo.");
  } catch (error: any) {
    console.error("[mcp-pg] ERROR de conexión en startup:", error?.message || error);
    process.exit(1);
  }
}

function respondText(result: unknown) {
  const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  return { content: [{ type: "text" as const, text }] };
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});