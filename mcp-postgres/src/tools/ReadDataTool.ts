// tools/ReadDataTool.ts
import type { Pool } from "pg";
// import type { Tool } from "@modelcontextprotocol/sdk/types.js"; // opcional

export class ReadDataTool /* implements Tool */ {
  [key: string]: any;

  name = "read_data";
  description =
    "Executes a SELECT query on a PostgreSQL database. The query must start with SELECT and cannot contain destructive SQL operations for security reasons.";

  inputSchema = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "SQL SELECT query to execute (must start with SELECT and cannot contain destructive operations). Example: SELECT * FROM public.movies WHERE genre = 'comedy'",
      },
      tableName: {
        type: "string",
        description:
          "LEGACY: table to SELECT * from (server will build a safe query). Example: public.movies",
      },
      limit: {
        type: "number",
        description: "Optional LIMIT when using tableName (default: 100)",
      },
    },
    required: [],      
    additionalProperties: false,
  } as any;

  // Alias snake_case para tools/list (el protocolo MCP espera input_schema)
  input_schema = this.inputSchema;

  private pool: Pool | null = null;
  setPool(pool: Pool) {
    this.pool = pool;
  }

  // === Listas de bloqueo (extendidas a Postgres) ===
  private static readonly DANGEROUS_KEYWORDS = [
    "DELETE","DROP","UPDATE","INSERT","ALTER","CREATE","TRUNCATE",
    "EXEC","EXECUTE","MERGE","REPLACE","GRANT","REVOKE","COMMIT",
    "ROLLBACK","TRANSACTION","BEGIN","DECLARE","SET","USE","BACKUP",
    "RESTORE","KILL","SHUTDOWN","COPY","DO","VACUUM","ANALYZE","EXPLAIN",
  ];

  private static readonly DANGEROUS_PATTERNS = [
    /;\s*(DELETE|DROP|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|MERGE|REPLACE|GRANT|REVOKE|COPY|DO|VACUUM|ANALYZE|EXPLAIN)/i,
    /UNION\s+(?:ALL\s+)?SELECT.*?(DELETE|DROP|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|MERGE|REPLACE|GRANT|REVOKE|COPY|DO)/i,
    /--.*?(DELETE|DROP|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|MERGE|REPLACE|GRANT|REVOKE|COPY|DO)/i,
    /\/\*.*?(DELETE|DROP|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|EXEC|EXECUTE|MERGE|REPLACE|GRANT|REVOKE|COPY|DO).*?\*\//is,
    /@@/i,                         // (de MSSQL; lo bloqueamos igual)
    /WAITFOR\s+DELAY/i,            // MSSQL timing; lo bloqueamos igual
    /WAITFOR\s+TIME/i,
    /;\s*\w/,                      // múltiples statements
    /\+\s*CHAR\s*\(/i,             // ofuscación
    /\+\s*NCHAR\s*\(/i,
    /\+\s*ASCII\s*\(/i,
  ];

  private validateQuery(query: string): { isValid: boolean; error?: string } {
    if (!query || typeof query !== "string") {
      return { isValid: false, error: "Query must be a non-empty string" };
    }

    const clean = query
      .replace(/--.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!clean) {
      return { isValid: false, error: "Query cannot be empty after removing comments" };
    }

    const upper = clean.toUpperCase();

    // Debe comenzar con SELECT
    if (!upper.startsWith("SELECT")) {
      return { isValid: false, error: "Query must start with SELECT for security reasons" };
    }

    // Palabras peligrosas (con límites de palabra)
    for (const kw of ReadDataTool.DANGEROUS_KEYWORDS) {
      const re = new RegExp(`(^|\\s|[^A-Za-z0-9_])${kw}($|\\s|[^A-Za-z0-9_])`, "i");
      if (re.test(upper)) {
        return {
          isValid: false,
          error: `Dangerous keyword '${kw}' detected in query. Only SELECT operations are allowed.`,
        };
      }
    }

    // Patrones peligrosos
    for (const pat of ReadDataTool.DANGEROUS_PATTERNS) {
      if (pat.test(query)) {
        return {
          isValid: false,
          error: "Potentially malicious SQL pattern detected. Only simple single SELECT is allowed.",
        };
      }
    }

    // Solo una sentencia
    const stmts = clean.split(";").filter((s) => s.trim().length > 0);
    if (stmts.length > 1) {
      return { isValid: false, error: "Multiple SQL statements are not allowed." };
    }

    // Tamaño máximo
    if (query.length > 10000) {
      return { isValid: false, error: "Query is too long. Maximum allowed length is 10,000 characters." };
    }

    return { isValid: true };
  }

  private sanitizeResult(data: any[]): any[] {
    if (!Array.isArray(data)) return [];
    const max = 10000;
    const safe = data.length > max ? data.slice(0, max) : data;

    return safe.map((record) => {
      if (record && typeof record === "object") {
        const out: any = {};
        for (const [key, value] of Object.entries(record)) {
          const sanitizedKey = key.replace(/[^\w\s\-_.]/g, "");
          out[sanitizedKey] = value;
        }
        return out;
      }
      return record;
    });
  }

  async run(params: any) {
    try {
      if (!this.pool) throw new Error("Database connection pool is not set.");

      // --- Compat: si viene tableName y NO viene query, construimos una segura ---
      if (!params?.query && typeof params?.tableName === "string") {
        const tn = params.tableName as string;
        const limit =
          typeof params.limit === "number" && Number.isFinite(params.limit) && params.limit > 0
            ? Math.floor(params.limit)
            : 100;

        // validar y citar identificadores: schema.table o solo table
        const parts = tn.split(".");
        if (parts.length < 1 || parts.length > 2) {
          return { success: false, message: `Invalid tableName: ${tn}`, error: "BAD_TABLE_NAME" };
        }
        const quoteIdent = (id: string) => {
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(id)) {
            throw new Error(`Invalid identifier: ${id}`);
          }
          return `"${id}"`;
        };
        const quoted = parts.map(quoteIdent).join(".");
        params.query = `SELECT * FROM ${quoted} LIMIT ${limit}`;
      }

      const query: string = params?.query;

      // (resto igual que tenías)
      const validation = this.validateQuery(query);
      if (!validation.isValid) {
        console.error(`[read_data] validation failed: ${validation.error}`);
        return {
          success: false,
          message: `Security validation failed: ${validation.error}`,
          error: "SECURITY_VALIDATION_FAILED",
        };
      }

      const preview = query.length > 200 ? `${query.slice(0, 200)}...` : query;
      console.error(`[read_data] executing validated SELECT: ${preview}`);

      const result = await this.pool.query(query);
      const sanitized = this.sanitizeResult(result.rows || []);

      return {
        success: true,
        message: `Query executed successfully. Retrieved ${sanitized.length} record(s)${
          (result.rows?.length ?? 0) !== sanitized.length
            ? ` (limited from ${(result.rows?.length ?? 0)} total records)`
            : ""
        }`,
        data: sanitized,
        recordCount: sanitized.length,
        totalRecords: result.rows?.length ?? sanitized.length,
      };
    } catch (error: any) {
      console.error("Error executing query:", error);
      const safeMsg = typeof error?.message === "string" ? error.message : "Database query execution failed";
      return { success: false, message: `Failed to execute query: ${safeMsg}`, error: "QUERY_EXECUTION_FAILED" };
    }
  }

}