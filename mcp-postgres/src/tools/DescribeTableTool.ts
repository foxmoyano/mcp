import { Pool } from "pg";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class DescribeTableTool implements Tool {
  [key: string]: any;
  name = "describe";
  description = "Describes the structure of a PostgreSQL table including columns, data types, constraints and defaults";
  inputSchema = {
    type: "object",
    properties: {
      tableName: {
        type: "string",
        description: "Name of the table to describe",
      },
    },
    required: ["tableName"],
  } as any;

  private pool: Pool | null = null;

  setPool(pool: Pool) {
    this.pool = pool;
  }

  async run(args: { tableName: string }) {
    if (!this.pool) {
      throw new Error("Database connection pool is not set.");
    }

    const { tableName } = args;
    
    try {
      const query = `
        SELECT 
          a.attname as column_name,
          pg_catalog.format_type(a.atttypid, a.atttypmod) as data_type,
          CASE 
            WHEN a.attnotnull THEN 'NOT NULL'
            ELSE 'NULL'
          END as nullable,
          CASE 
            WHEN p.contype = 'p' THEN 'PRIMARY KEY'
            WHEN p.contype = 'u' THEN 'UNIQUE'
            WHEN p.contype = 'f' THEN 'FOREIGN KEY'
            ELSE ''
          END as constraint_type,
          CASE
            WHEN a.atthasdef THEN pg_get_expr(d.adbin, d.adrelid)
            ELSE ''
          END as default_value
        FROM pg_catalog.pg_attribute a
        LEFT JOIN pg_catalog.pg_constraint p ON p.conrelid = a.attrelid AND a.attnum = ANY(p.conkey)
        LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = $1::regclass
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY a.attnum;
      `;
      
      const result = await this.pool.query(query, [tableName]);
      return {
        success: true,
        message: `Table structure retrieved successfully`,
        columns: result.rows
      };
    } catch (error) {
      console.error("Error describing table:", error);
      return {
        success: false,
        message: `Failed to describe table: ${error}`,
      };
    }
  }
}