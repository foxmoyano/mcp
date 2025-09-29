import { Pool } from "pg";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class DropTableTool implements Tool {  
    name = "drop_table";
    description = "Drops a table from the PostgreSQL database";
    inputSchema = {
        type: "object" as const,
        properties: {
            schema: {
                type: "string",
                description: "Name of the table to drop",
                default: "public"
            }
        }
    };

    private pool: Pool | null = null;

    setPool(pool: Pool) {
        this.pool = pool;
    }

    async run(args: { 
        tableName: string;
        cascade?: boolean;
    }) {
        if (!this.pool) {
            throw new Error("Database connection pool is not set.");
        }

        try {
            const { tableName, cascade = false } = args;
            const query = `DROP TABLE IF EXISTS ${tableName}${cascade ? ' CASCADE' : ''};`;
      
            await this.pool.query(query);
            return {
                success: true,
                message: `Table ${tableName} dropped successfully`,
                table: tableName,
                cascade
            };
        } catch (error) {
            console.error("Error dropping table:", error);
            return {
                success: false,
                message: `Failed to drop table: ${error}`,
            };
        }
    }

    [key: string]: any;
}