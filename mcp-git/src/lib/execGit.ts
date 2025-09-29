import { promisify } from "node:util";
import { sanitizeStdout } from "./utils.js";
import { execFile } from "child_process";

const exec = promisify(execFile);

export type GitExecResult = { stdout: string; stderr: string; code: number };

export async function git(path: string, args: string[]): Promise<GitExecResult> {
    const { stdout, stderr } = await exec("git", ["-C", path, ...args]);
    return { stdout: sanitizeStdout(stdout), stderr: sanitizeStdout(stderr), code: 0 };
}

export async function tryGit(path: string, args: string[]): Promise<GitExecResult> {
    try {
        return await git(path, args);
    } catch (e: any) {
        const stdout = e?.stdout ? String(e.stdout) : "";
        const stderr = e?.stderr ? String(e.stderr) : (e?.message ?? String(e));
        return { stdout: sanitizeStdout(stdout), stderr: sanitizeStdout(stderr), code: e?.code ?? 1 };
    }
}