export function isBranchProtected(branch: string, patterns: string[]): boolean {
    return patterns.some(p => {
    if (p.endsWith("/*")) return branch.startsWith(p.slice(0, -2));
    return branch === p;
    });
    }
    
    
    export function sanitizeStdout(s: string): string {
    // Agrega aquí redactores si alguna vez imprimes URLs con tokens
    return s.trim();
    }
    
    
    export function assert(condition: any, message: string): asserts condition {
    if (!condition) throw new Error(message);
}