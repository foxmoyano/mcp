import fs from "node:fs";
import path from "node:path";
import { isBranchProtected } from "./utils.js";


export type Policy = {
protectedBranches: string[];
allowForcePush: boolean;
requireSignedCommits: boolean;
maxFilesChanged: number;
conventionalCommits: boolean;
defaultPullRebase: boolean;
};


const defaultPolicy: Policy = {
protectedBranches: ["main", "master", "release/*"],
allowForcePush: false,
requireSignedCommits: false,
maxFilesChanged: 500,
conventionalCommits: true,
defaultPullRebase: true
};


export function loadPolicy(cwd: string): Policy {
const p1 = path.join(cwd, "policy.json");
if (fs.existsSync(p1)) {
try { return { ...defaultPolicy, ...JSON.parse(fs.readFileSync(p1, "utf8")) }; } catch {}
}
// ENV overrides simples
const env = { ...defaultPolicy } as Policy;
if (process.env.GIT_MCP_PROTECTED) env.protectedBranches = process.env.GIT_MCP_PROTECTED.split(",").map(s => s.trim());
if (process.env.GIT_MCP_ALLOW_FORCE_PUSH) env.allowForcePush = process.env.GIT_MCP_ALLOW_FORCE_PUSH === "true";
if (process.env.GIT_MCP_REQUIRE_SIGN) env.requireSignedCommits = process.env.GIT_MCP_REQUIRE_SIGN === "true";
if (process.env.GIT_MCP_MAX_FILES) env.maxFilesChanged = parseInt(process.env.GIT_MCP_MAX_FILES, 10) || defaultPolicy.maxFilesChanged;
if (process.env.GIT_MCP_CONV_COMMITS) env.conventionalCommits = process.env.GIT_MCP_CONV_COMMITS === "true";
if (process.env.GIT_MCP_PULL_REBASE) env.defaultPullRebase = process.env.GIT_MCP_PULL_REBASE === "true";
return env;
}


export function forbidForcePush(branch: string, policy: Policy) {
if (!policy.allowForcePush && isBranchProtected(branch, policy.protectedBranches)) {
throw new Error(`Push --force prohibido en rama protegida: ${branch}`);
}
}


export function enforceConventional(message: string, enabled: boolean) {
    if (!enabled) return;
    const re = /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\(.+\))?!?: .+/;
    
    if (!re.test(message)) {
        throw new Error("Mensaje de commit no cumple Conventional Commits");
    }
}