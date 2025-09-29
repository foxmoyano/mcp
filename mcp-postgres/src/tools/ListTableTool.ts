// tools/ListTableTool.ts (versión mínima, “estilo MSSQL”, solo cambia run)
import type { Pool } from "pg";
// import type { Tool } from "@modelcontextprotocol/sdk/types.js"; // opcional

export class ListTableTool /* implements Tool */ {
  [key: string]: any;

  name = "list_table";
  description = "Lists tables in a PostgreSQL database, optionally filtered by schema(s).";

  inputSchema = {
    type: "object",
    properties: {
      parameters: {
        type: "array",
        description: "Schemas to filter by (optional)",
        items: { type: "string" },
        minItems: 0,
      },
    },
    required: [],
    additionalProperties: false,
  } as any;

  // alias snake_case por si lo quieres usar en index.ts
  input_schema = this.inputSchema;

  private pool: Pool | null = null;
  setPool(pool: Pool) { this.pool = pool; }

  async run(params: any) {
    if (!this.pool) throw new Error("Database connection pool is not set.");

    const schemas: string[] = Array.isArray(params?.parameters) ? params.parameters : [];

    let text = `
      SELECT
        schemaname || '.' || tablename AS table_full_name,
        schemaname AS schema_name,
        tablename  AS table_name
      FROM pg_catalog.pg_tables
    `;
    const values: any[] = [];
    if (schemas.length > 0) {
      text += ` WHERE schemaname = ANY($1::text[]) `;
      values.push(schemas);
    }
    text += ` ORDER BY schemaname, tablename;`;

    const { rows } = await this.pool.query(text, values);

    return {
      success: true,
      message: "List tables executed successfully",
      items: rows,
    };
  }
}