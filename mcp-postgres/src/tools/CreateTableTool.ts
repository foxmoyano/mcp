import { Pool } from "pg";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class CreateTableTool implements Tool {
  [key: string]: any;
  name = "create_table";
  description = "Creates a new table in PostgreSQL with specified columns and constraints";
  inputSchema = {
    type: "object",
    properties: {
      tableName: {
        type: "string",
        description: "Name of the table to create",
      },
      columns: {
        type: "array",
        description: "Array of column definitions",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the column",
            },
            type: {
              type: "string",
              description: "PostgreSQL data type for the column",
            },
            constraints: {
              type: "array",
              items: { type: "string" },
              description: "Optional constraints for the column (e.g., NOT NULL, UNIQUE, etc.)",
            },
          },
          required: ["name", "type"],
        },
      },
    },
    required: ["tableName", "columns"],
  } as any;

  private pool: Pool | null = null;

  setPool(pool: Pool) {
    this.pool = pool;
  }

  async run(args: { 
    tableName: string; 
    columns: Array<{
      name: string;
      type: string;
      constraints?: string[];
    }>;
  }) {
    if (!this.pool) {
      throw new Error("Database connection pool is not set.");
    }

    try {
      const { tableName, columns } = args;
      
      if (!columns || columns.length === 0) {
        return {
          success: false,
          message: "No columns specified for table creation",
        };
      }

      const columnDefinitions = columns.map(col => {
        const constraints = col.constraints ? ` ${col.constraints.join(" ")}` : "";
        return `${col.name} ${col.type}${constraints}`;
      }).join(", ");

      const query = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefinitions});`;
      
      await this.pool.query(query);
      return {
        success: true,
        message: `Table ${tableName} created successfully`,
        table: tableName,
        columns: columns.map(col => ({
          name: col.name,
          type: col.type,
          constraints: col.constraints || []
        }))
      };
    } catch (error) {
      console.error("Error creating table:", error);
      return {
        success: false,
        message: `Failed to create table: ${error}`,
      };
    }
  }
}