#!/usr/bin/env node

// External imports
import * as dotenv from "dotenv";
import sql from "mssql";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Internal imports
import { UpdateDataTool } from "./tools/UpdateDataTool.js";
import { InsertDataTool } from "./tools/InsertDataTool.js";
import { ReadDataTool } from "./tools/ReadDataTool.js";
import { CreateTableTool } from "./tools/CreateTableTool.js";
import { CreateIndexTool } from "./tools/CreateIndexTool.js";
import { ListTableTool } from "./tools/ListTableTool.js";
import { DropTableTool } from "./tools/DropTableTool.js";
import { DescribeTableTool } from "./tools/DescribeTableTool.js";

// MSSQL Database connection configuration (sin Azure)
let globalSqlPool: sql.ConnectionPool | null = null;

export async function createSqlConfig(): Promise<sql.config> {
  console.log('🔧 Creating SQL config...');
  console.log('📋 Environment variables:', {
    SERVER_NAME: process.env.SERVER_NAME,
    DATABASE_NAME: process.env.DATABASE_NAME,
    USER: process.env.USER,
    PASSWORD: process.env.PASSWORD ? '***masked***' : 'undefined',
    TRUST_SERVER_CERTIFICATE: process.env.TRUST_SERVER_CERTIFICATE,
    READONLY: process.env.READONLY
  });

  const trustServerCertificate =
    process.env.TRUST_SERVER_CERTIFICATE?.toLowerCase() === "true";
  const connectionTimeout = process.env.CONNECTION_TIMEOUT
    ? parseInt(process.env.CONNECTION_TIMEOUT, 10)
    : 30;

  return {
    server: process.env.SERVER_NAME!,
    database: process.env.DATABASE_NAME!,
    user: process.env.USER!,
    password: process.env.PASSWORD!,
    options: {
      encrypt: false,
      trustServerCertificate,
      enableArithAbort: true,
    },
    connectionTimeout: connectionTimeout * 1000, // segundos → ms
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };
}

export async function getSqlPool(): Promise<sql.ConnectionPool> {
  console.log('🔍 getSqlPool called - checking connection...');
  if (!globalSqlPool || !globalSqlPool.connected) {
    console.log('🔄 Creating new SQL connection...');
    const config = await createSqlConfig();
    console.log('📋 SQL Config:', {
      server: config.server,
      database: config.database,
      user: config.user,
      // Don't log password for security
      options: config.options
    });
    if (globalSqlPool && globalSqlPool.connected) {
      await globalSqlPool.close();
    }
    globalSqlPool = await sql.connect(config);
    console.log('✅ SQL connection established successfully');
  } else {
    console.log('✅ Using existing SQL connection');
  }
  return globalSqlPool;
}

const updateDataTool = new UpdateDataTool();
const insertDataTool = new InsertDataTool();
const readDataTool = new ReadDataTool();
const createTableTool = new CreateTableTool();
const createIndexTool = new CreateIndexTool();
const listTableTool = new ListTableTool();
const dropTableTool = new DropTableTool();
const describeTableTool = new DescribeTableTool();

const server = new Server(
  {
    name: "mssql-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Read READONLY env variable
const isReadOnly = process.env.READONLY === "true";

// Request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: isReadOnly
    ? [listTableTool, readDataTool, describeTableTool]
    : [
        insertDataTool,
        readDataTool,
        describeTableTool,
        updateDataTool,
        createTableTool,
        createIndexTool,
        dropTableTool,
        listTableTool,
      ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.log(`🔧 Tool called: ${name}`, args);
  try {
    let result;
    switch (name) {
      case insertDataTool.name:
        result = await insertDataTool.run(args);
        break;
      case readDataTool.name:
        result = await readDataTool.run(args);
        break;
      case updateDataTool.name:
        result = await updateDataTool.run(args);
        break;
      case createTableTool.name:
        result = await createTableTool.run(args);
        break;
      case createIndexTool.name:
        result = await createIndexTool.run(args);
        break;
      case listTableTool.name:
        result = await listTableTool.run(args);
        break;
      case dropTableTool.name:
        result = await dropTableTool.run(args);
        break;
      case describeTableTool.name:
        if (!args || typeof args.tableName !== "string") {
          return {
            content: [
              {
                type: "text",
                text: `Missing or invalid 'tableName' argument for describe_table tool.`,
              },
            ],
            isError: true,
          };
        }
        result = await describeTableTool.run(args as { tableName: string });
        break;
      default:
        console.log(`❌ Unknown tool: ${name}`);
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
    console.log(`✅ Tool ${name} executed successfully`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    console.error(`❌ Error in tool ${name}:`, error);
    return {
      content: [{ type: "text", text: `Error occurred: ${error}` }],
      isError: true,
    };
  }
});

// Server startup
async function runServer() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  } catch (error) {
    console.error("Fatal error running server:", error);
    process.exit(1);
  }
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});

// Ensure SQL connection
async function ensureSqlConnection() {
  if (globalSqlPool && globalSqlPool.connected) {
    return;
  }

  const config = await createSqlConfig();

  if (globalSqlPool && globalSqlPool.connected) {
    await globalSqlPool.close();
  }

  globalSqlPool = await sql.connect(config);
}

// Patch all tool handlers to ensure SQL connection before running
function wrapToolRun(tool: { run: (...args: any[]) => Promise<any> }) {
  const originalRun = tool.run.bind(tool);
  tool.run = async function (...args: any[]) {
    await ensureSqlConnection();
    return originalRun(...args);
  };
}

[
  insertDataTool,
  readDataTool,
  updateDataTool,
  createTableTool,
  createIndexTool,
  dropTableTool,
  listTableTool,
  describeTableTool,
].forEach(wrapToolRun);
