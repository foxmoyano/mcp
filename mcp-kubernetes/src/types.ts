export type ExecResult = { code: number; stdout: string; stderr: string };

export type Tool = {
  name: string;
  description: string;
  inputSchema: any; // JSON-schema-like
  handler: (args: any) => Promise<{
    content: Array<{ type: 'text' | 'json'; text?: string; json?: any }>;
  }>;
};