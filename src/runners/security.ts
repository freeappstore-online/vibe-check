/** Security analysis — beyond secrets, checks for vulnerable code patterns. */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import type { CheckResult, Issue } from "../types.js";
import { gradeFromScore } from "../types.js";

interface SecurityPattern {
	name: string;
	pattern: RegExp;
	severity: "error" | "warning";
	message: string;
	cwe?: string; // Common Weakness Enumeration ID
}

const PATTERNS: SecurityPattern[] = [
	// XSS
	{ name: "innerHTML", pattern: /\.innerHTML\s*=/, severity: "warning", message: "XSS: innerHTML assignment — use textContent or DOM APIs", cwe: "CWE-79" },
	{ name: "dangerouslySetInnerHTML", pattern: /dangerouslySetInnerHTML/, severity: "error", message: "XSS: dangerouslySetInnerHTML bypasses React protection", cwe: "CWE-79" },
	{ name: "document.write", pattern: /document\.write\s*\(/, severity: "error", message: "XSS: document.write is dangerous", cwe: "CWE-79" },
	{ name: "outerHTML", pattern: /\.outerHTML\s*=/, severity: "warning", message: "XSS: outerHTML assignment", cwe: "CWE-79" },
	{ name: "insertAdjacentHTML", pattern: /\.insertAdjacentHTML\s*\(/, severity: "warning", message: "XSS: insertAdjacentHTML with user data", cwe: "CWE-79" },

	// Injection
	{ name: "eval", pattern: /\beval\s*\(/, severity: "error", message: "Injection: eval() executes arbitrary code", cwe: "CWE-94" },
	{ name: "new Function", pattern: /new\s+Function\s*\(/, severity: "error", message: "Injection: new Function() is equivalent to eval()", cwe: "CWE-94" },
	{ name: "child_process.exec", pattern: /\bexec(?:Sync)?\s*\((?!.*\{[^}]*encoding)/, severity: "warning", message: "Command injection risk: prefer execFile with argument array", cwe: "CWE-78" },
	{ name: "template literal in SQL", pattern: /(?:query|prepare|execute)\s*\(\s*`[^`]*\$\{/, severity: "error", message: "SQL injection: use parameterized queries instead of template literals", cwe: "CWE-89" },

	// Crypto
	{ name: "Math.random for security", pattern: /Math\.random\s*\(\).*(?:token|secret|key|password|nonce|salt)/i, severity: "error", message: "Weak randomness: use crypto.randomUUID() or crypto.getRandomValues()", cwe: "CWE-330" },
	{ name: "MD5/SHA1", pattern: /\b(?:md5|sha1|SHA1|MD5)\b/, severity: "warning", message: "Weak hash: MD5/SHA1 are broken — use SHA-256+", cwe: "CWE-328" },

	// Prototype pollution
	{ name: "Object.assign from user input", pattern: /Object\.assign\s*\(\s*\{\s*\}\s*,\s*(?:req|request|body|params|query)/, severity: "warning", message: "Prototype pollution risk: validate/sanitize before Object.assign", cwe: "CWE-1321" },
	{ name: "spread from user input", pattern: /\{\s*\.\.\.(?:req|request|body|params|query)\./, severity: "warning", message: "Prototype pollution: spreading unvalidated user input", cwe: "CWE-1321" },

	// Path traversal
	{ name: "path traversal", pattern: /(?:readFile|writeFile|access|stat)(?:Sync)?\s*\([^)]*(?:req|request|body|params|query)/, severity: "warning", message: "Path traversal: validate file paths from user input", cwe: "CWE-22" },

	// SSRF
	{ name: "fetch with user URL", pattern: /fetch\s*\(\s*(?:req|request|body|params|query)\.(?:url|href|target)/, severity: "warning", message: "SSRF: validate URLs before fetching user-supplied targets", cwe: "CWE-918" },

	// Sensitive data
	{ name: "password in URL", pattern: /(?:password|secret|token|key)=[^&\s'"]+/i, severity: "warning", message: "Sensitive data in URL query string", cwe: "CWE-598" },

	// Missing security headers (in response construction)
	{ name: "no-cache header missing", pattern: /new Response\([^)]*\{[^}]*["']Set-Cookie["']/, severity: "warning", message: "Set-Cookie without Cache-Control: no-store", cwe: "CWE-525" },
];

export function runSecurity(cwd: string): CheckResult {
	const start = Date.now();
	const issues: Issue[] = [];

	const files: string[] = [];
	const dirs = ["src", "web/src"];
	for (const dir of dirs) {
		try {
			collectFiles(join(cwd, dir), files);
		} catch { /* dir doesn't exist */ }
	}

	if (files.length === 0) {
		return { name: "security", score: 100, grade: "A", details: { skipped: true, reason: "no source files" }, issues: [], duration: Date.now() - start };
	}

	const cwePrefixes = new Set<string>();

	for (const file of files) {
		const content = readFileSync(file, "utf-8");
		const relPath = file.replace(cwd + "/", "");
		const lines = content.split("\n");

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();
			if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

			for (const p of PATTERNS) {
				if (p.pattern.test(line)) {
					issues.push({
						severity: p.severity,
						message: p.message,
						file: relPath,
						line: i + 1,
						rule: p.cwe || p.name,
					});
					if (p.cwe) cwePrefixes.add(p.cwe);
				}
			}
		}
	}

	// Check for security-critical HTML files
	const htmlFiles = ["index.html", "web/index.html", "public/index.html"];
	for (const h of htmlFiles) {
		const full = join(cwd, h);
		if (!existsSync(full)) continue;
		const html = readFileSync(full, "utf-8");

		// Missing CSP
		if (!html.includes("Content-Security-Policy") && !html.includes("content-security-policy")) {
			issues.push({ severity: "info", message: "No Content-Security-Policy meta tag in HTML", file: h, rule: "CWE-1021" });
		}

		// External scripts without integrity
		const scripts = html.match(/<script[^>]*src=["'][^"']*["'][^>]*>/g) || [];
		for (const s of scripts) {
			if (s.includes("integrity=")) continue;
			if (s.includes("localhost") || s.includes("/src/")) continue; // local dev scripts
			if (!s.includes("integrity")) {
				issues.push({ severity: "info", message: "External script without subresource integrity (SRI)", file: h, rule: "CWE-829" });
			}
		}
	}

	const errors = issues.filter((i) => i.severity === "error").length;
	const warnings = issues.filter((i) => i.severity === "warning").length;
	const score = Math.max(0, Math.min(100, 100 - errors * 15 - warnings * 5));

	return {
		name: "security",
		score,
		grade: gradeFromScore(score),
		details: { filesScanned: files.length, patterns: issues.length, cweCategories: cwePrefixes.size, errors, warnings },
		issues,
		duration: Date.now() - start,
	};
}

function collectFiles(dir: string, out: string[]): void {
	for (const entry of readdirSync(dir)) {
		if (["node_modules", "dist", ".git", ".vibe-check", "coverage", "test-results"].includes(entry)) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			collectFiles(full, out);
		} else {
			const ext = extname(entry);
			if ([".ts", ".tsx", ".js", ".jsx"].includes(ext) && !entry.includes(".test.") && !entry.includes(".spec.")) {
				out.push(full);
			}
		}
	}
}
