import { Pool } from "pg";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class InsertDataTool implements Tool {
  [key: string]: any;
  name = "insert";
  description = "Inserts a new record into a PostgreSQL table";
  inputSchema = {
    type: "object",
    properties: {
      tableName: {
        type: "string",
        description: "Name of the table to insert into",
      },
      data: {
        type: "object",
        description: "Data to insert as key-value pairs",
      },
    },
    required: ["tableName", "data"],
  } as any;

  private pool: Pool | null = null;

  setPool(pool: Pool) {
    this.pool = pool;
  }

  async run(args: { tableName: string; data: Record<string, any> }) {
    if (!this.pool) {
      throw new Error("Database connection pool is not set.");
    }

    try {
      const { tableName, data } = args;
      const columns = Object.keys(data).join(", ");
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

      const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) RETURNING *;`;

      const result = await this.pool.query(query, values);
      return {
        success: true,
        message: "Data inserted successfully",
        rows: result.rows,
        rowCount: result.rowCount
      };
    } catch (error) {
      console.error("Error inserting data:", error);
      return {
        success: false,
        message: `Failed to insert data: ${error}`,
      };
    }
  }
}