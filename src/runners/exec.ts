/** Shared exec helper for runners. */

import { execSync } from "node:child_process";

export function run(cmd: string, cwd: string, timeout = 60_000): { stdout: string; ok: boolean } {
	try {
		const stdout = execSync(cmd, {
			cwd,
			timeout,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		return { stdout, ok: true };
	} catch (e: any) {
		return { stdout: e.stdout || e.stderr || String(e), ok: false };
	}
}

export function runJSON<T>(cmd: string, cwd: string, timeout = 60_000): T | null {
	const { stdout } = run(cmd, cwd, timeout);
	try {
		return JSON.parse(stdout) as T;
	} catch {
		return null;
	}
}
