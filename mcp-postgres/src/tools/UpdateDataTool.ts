import { Pool } from "pg";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class UpdateDataTool implements Tool {
  [key: string]: any;
  name = "update";
  description = "Updates records in a PostgreSQL table that match the given conditions";
  inputSchema = {
    type: "object",
    properties: {
      tableName: {
        type: "string",
        description: "Name of the table to update",
      },
      data: {
        type: "object",
        description: "Data to update as key-value pairs",
      },
      where: {
        type: "object",
        description: "Filter conditions as key-value pairs",
      },
    },
    required: ["tableName", "data", "where"],
  } as any;

  private pool: Pool | null = null;

  setPool(pool: Pool) {
    this.pool = pool;
  }

  async run(args: { 
    tableName: string; 
    data: Record<string, any>;
    where: Record<string, any>;
  }) {
    if (!this.pool) {
      throw new Error("Database connection pool is not set.");
    }

    try {
      const { tableName, data, where } = args;
      const updateColumns = Object.keys(data);
      const whereColumns = Object.keys(where);
      
      if (updateColumns.length === 0) {
        return {
          success: false,
          message: "No data provided for update",
        };
      }
      if (whereColumns.length === 0) {
        return {
          success: false,
          message: "WHERE clause is required for update operations",
        };
      }

      const values = [...Object.values(data), ...Object.values(where)];
      const setClause = updateColumns
        .map((key, index) => `${key} = $${index + 1}`)
        .join(", ");
      
      const whereClause = whereColumns
        .map((key, index) => `${key} = $${updateColumns.length + index + 1}`)
        .join(" AND ");

      const query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause} RETURNING *;`;
      
      const result = await this.pool.query(query, values);
      return {
        success: true,
        message: `Updated ${result.rowCount} rows successfully`,
        rows: result.rows,
        rowCount: result.rowCount
      };
    } catch (error) {
      console.error("Error updating data:", error);
      return {
        success: false,
        message: `Failed to update data: ${error}`,
      };
    }
  }
}