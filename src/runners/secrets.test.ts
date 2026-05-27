import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runSecrets } from "./secrets.js";

function makeProject(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), "vcqa-sec-"));
	writeFileSync(join(dir, "package.json"), "{}");
	mkdirSync(join(dir, "src"), { recursive: true });
	for (const [name, content] of Object.entries(files)) {
		const full = join(dir, name.startsWith("src/") ? name : `src/${name}`);
		mkdirSync(join(full, ".."), { recursive: true });
		writeFileSync(full, content);
	}
	return dir;
}

describe("runSecrets", () => {
	it("gives A for clean code", () => {
		const dir = makeProject({ "clean.ts": 'const API_URL = "https://api.example.com";\nexport const config = { url: API_URL };' });
		const result = runSecrets(dir);
		expect(result.grade).toBe("A");
		expect(result.score).toBe(100);
		rmSync(dir, { recursive: true });
	});

	it("detects GitHub PAT", () => {
		const dir = makeProject({ "bad.ts": 'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";' });
		const result = runSecrets(dir);
		expect(result.issues.length).toBeGreaterThan(0);
		expect(result.issues[0].message).toContain("GitHub");
		expect(result.score).toBeLessThan(100);
		rmSync(dir, { recursive: true });
	});

	it("detects AWS access key", () => {
		const dir = makeProject({ "aws.ts": 'const key = "AKIAIOSFODNN7EXAMPLE";' });
		const result = runSecrets(dir);
		expect(result.issues.some((i) => i.message.includes("AWS"))).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("detects private key", () => {
		const dir = makeProject({ "key.ts": 'const pk = "-----BEGIN RSA PRIVATE KEY-----\\nMII...";' });
		const result = runSecrets(dir);
		expect(result.issues.some((i) => i.message.includes("Private Key"))).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("ignores test files", () => {
		const dir = makeProject({ "src/auth.test.ts": 'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";' });
		const result = runSecrets(dir);
		expect(result.issues).toHaveLength(0);
		rmSync(dir, { recursive: true });
	});

	it("scans non-code files (json, yaml, env extension)", () => {
		const dir = makeProject({ "config.json": '{ "token": "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij" }' });
		const result = runSecrets(dir);
		expect(result.issues.some((i) => i.message.includes("GitHub"))).toBe(true);
		rmSync(dir, { recursive: true });
	});

	it("gives A for empty project", () => {
		const dir = mkdtempSync(join(tmpdir(), "vcqa-sec-"));
		writeFileSync(join(dir, "package.json"), "{}");
		const result = runSecrets(dir);
		expect(result.score).toBe(100);
		rmSync(dir, { recursive: true });
	});
});
