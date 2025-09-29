import { Pool } from "pg";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class CreateIndexTool implements Tool {
  [key: string]: any;
  name = "create_index";
  description = "Creates an index on specified columns in a PostgreSQL table";
  inputSchema = {
    type: "object",
    properties: {
      tableName: {
        type: "string",
        description: "Name of the table to create index on",
      },
      indexName: {
        type: "string",
        description: "Name of the index to create",
      },
      columns: {
        type: "array",
        items: { type: "string" },
        description: "Columns to include in the index",
      },
      unique: {
        type: "boolean",
        description: "Whether to create a unique index",
      },
      type: {
        type: "string",
        enum: ["btree", "hash", "gist", "gin"],
        description: "Index type (btree, hash, gist, or gin)",
      },
    },
    required: ["tableName", "indexName", "columns"],
  } as any;

  private pool: Pool | null = null;

  setPool(pool: Pool) {
    this.pool = pool;
  }

  async run(args: { 
    tableName: string;
    indexName: string;
    columns: string[];
    unique?: boolean;
    type?: "btree" | "hash" | "gist" | "gin";
  }) {
    if (!this.pool) {
      throw new Error("Database connection pool is not set.");
    }

    try {
      const { tableName, indexName, columns, unique = false, type } = args;
      
      if (!columns || columns.length === 0) {
        return {
          success: false,
          message: "No columns specified for index creation",
        };
      }

      let query = `CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${indexName} `;
      if (type) {
        query += `USING ${type} `;
      }
      query += `ON ${tableName} (${columns.join(", ")});`;
      
      await this.pool.query(query);
      return {
        success: true,
        message: `Index ${indexName} created successfully on table ${tableName}`,
        index: {
          name: indexName,
          table: tableName,
          columns,
          unique,
          type
        }
      };
    } catch (error) {
      console.error("Error creating index:", error);
      return {
        success: false,
        message: `Failed to create index: ${error}`,
      };
    }
  }
}