// tools/ReadDataTool.ts
import type { Pool } from "pg";

export class ReadDataTool {
  [key: string]: any;

  name = "read_data";
  description =
    "Executes a SELECT query on PostgreSQL. Provide SQL in 'query' and optional bind values in 'parameters'.";

  inputSchema = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "SQL SELECT query to execute. Must start with SELECT. Example: SELECT * FROM public.movies WHERE genre = $1",
      },
      parameters: {
        type: "array",
        description:
          "Optional bind parameters (e.g. ['comedy']). Will be bound to $1, $2, ... in the query.",
        items: {
          anyOf: [
            { type: "string" },
            { type: "number" },
            { type: "boolean" },
            { type: "null" },
          ],
        },
      },
    },
    required: ["query"],
    additionalProperties: false,
  } as any;

  // Igual que ListTableTool
  input_schema = this.inputSchema;

  private pool: Pool | null = null;
  setPool(pool: Pool) {
    this.pool = pool;
  }

  private validateQuery(query: string): { isValid: boolean; error?: string } {
    if (!query || typeof query !== "string") {
      return { isValid: false, error: "Query must be a non-empty string" };
    }

    const clean = query
      .replace(/--.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean.toUpperCase().startsWith("SELECT")) {
      return { isValid: false, error: "Query must start with SELECT" };
    }

    const dangerous = ["DELETE", "DROP", "UPDATE", "INSERT", "ALTER", "CREATE", "TRUNCATE"];
    for (const kw of dangerous) {
      const re = new RegExp(`(^|\\s|[^A-Za-z0-9_])${kw}($|\\s|[^A-Za-z0-9_])`, "i");
      if (re.test(clean)) {
        return { isValid: false, error: `Forbidden keyword: ${kw}` };
      }
    }

    return { isValid: true };
  }

  async run(params: any) {
    if (!this.pool) throw new Error("Database connection pool is not set.");

    const query: string = params?.query;
    const parameters: any[] = Array.isArray(params?.parameters) ? params.parameters : [];

    const validation = this.validateQuery(query);
    if (!validation.isValid) {
      return { success: false, message: validation.error! };
    }

    try {
      const { rows } = await this.pool.query(query, parameters);
      return {
        success: true,
        message: "Query executed successfully",
        items: rows,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to execute query: ${error.message}`,
      };
    }
  }
}