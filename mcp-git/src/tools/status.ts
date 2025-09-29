import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { tryGit } from "../lib/execGit.js";

type StatusArgs = {
    path: string;
    porcelain?: boolean;
};

export const toolStatus: Tool = {
    name: "git:status",
    description: "Muestra estado del repo usando formato porcelain y rama actual.",
    inputSchema: {
        type: "object",
        properties: {
        path: { type: "string", description: "Ruta del repo" },
        porcelain: { type: "boolean", description: "Usar --porcelain", default: true }
        },
        required: ["path"]
    },
    async *invoke({ path, porcelain = true }: StatusArgs) {
        const branch = await tryGit(path, ["rev-parse", "--abbrev-ref", "HEAD"]);
        const aheadBehind = await tryGit(path, ["rev-list", "--left-right", "--count", "HEAD...@{u}"]).catch(() => ({ stdout: "0\t0", stderr: "", code: 0 }));
        const [behindStr, aheadStr] = (aheadBehind.stdout || "0\t0").split("\t");
        const behind = parseInt(behindStr || "0", 10);
        const ahead = parseInt(aheadStr || "0", 10);
        const args = ["status", porcelain ? "--porcelain" : "--short"];
        const s = await tryGit(path, args);

        return {
            content: [{ type: "text", text: `On ${branch.stdout} (ahead ${ahead}, behind ${behind})\n${s.stdout}` }]
        };
    }
};