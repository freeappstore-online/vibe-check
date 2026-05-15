/** Generate a self-contained HTML report from a VibeReport. */

import type { CheckResult, VibeReport } from "../types.js";

function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function gradeColor(grade: string): string {
	return { A: "#22c55e", B: "#84cc16", C: "#eab308", D: "#f97316", F: "#ef4444" }[grade] || "#6b7280";
}

const GROUPS: { label: string; checks: string[] }[] = [
	{ label: "Foundations", checks: ["structure", "lint", "types", "type-safety"] },
	{ label: "Quality", checks: ["complexity", "duplication", "docs"] },
	{ label: "Testing", checks: ["testing"] },
	{ label: "Security", checks: ["secrets", "dependencies"] },
];

function checkCard(c: CheckResult): string {
	const skipped = (c.details as any).skipped;
	const clr = skipped ? "#6b7280" : gradeColor(c.grade);
	const detailHtml = Object.entries(c.details)
		.filter(([k]) => k !== "skipped" && k !== "reason")
		.map(([k, v]) => {
			const display = Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
			return `<span class="d-item"><strong>${esc(k)}</strong> ${esc(display)}</span>`;
		})
		.join("");

	const issueCount = c.issues.length;
	const issueHtml = c.issues
		.slice(0, 15)
		.map((i) => {
			const loc = i.file ? `<span class="i-loc">${esc(i.file)}${i.line ? ":" + i.line : ""}</span>` : "";
			return `<div class="issue ${i.severity}"><span class="i-sev">${i.severity[0].toUpperCase()}</span>${loc}<span class="i-msg">${esc(i.message)}</span>${i.rule ? `<span class="i-rule">${esc(i.rule)}</span>` : ""}</div>`;
		})
		.join("");
	const moreHtml = issueCount > 15 ? `<div class="issue info"><span class="i-sev">+</span><span class="i-msg">${issueCount - 15} more issues</span></div>` : "";
	const skipReason = skipped ? `<div class="skip-reason">${esc((c.details as any).reason || "skipped")}</div>` : "";

	return `<div class="card${skipped ? " skipped" : ""}">
  <div class="card-head">
    <span class="card-grade" style="color:${clr}">${skipped ? "—" : c.grade}</span>
    <div class="card-info"><strong>${esc(c.name)}</strong><span class="card-score">${skipped ? "skipped" : c.score + "/100"}</span></div>
    <span class="card-ms">${c.duration}ms</span>
  </div>
  ${skipReason}
  ${detailHtml ? `<div class="card-details">${detailHtml}</div>` : ""}
  ${issueHtml ? `<div class="card-issues">${issueHtml}${moreHtml}</div>` : ""}
</div>`;
}

export function generateHTML(report: VibeReport): string {
	const gc = gradeColor(report.grade);
	const totalIssues = report.checks.reduce((s, c) => s + c.issues.length, 0);
	const activeChecks = report.checks.filter((c) => !(c.details as any).skipped);
	const skippedChecks = report.checks.filter((c) => (c.details as any).skipped);

	const checkMap = new Map(report.checks.map((c) => [c.name, c]));

	let groupsHtml = "";
	for (const group of GROUPS) {
		const groupChecks = group.checks.map((name) => checkMap.get(name)).filter(Boolean) as CheckResult[];
		if (groupChecks.length === 0) continue;
		const groupScore = groupChecks.filter((c) => !(c.details as any).skipped);
		const avg = groupScore.length > 0 ? Math.round(groupScore.reduce((s, c) => s + c.score, 0) / groupScore.length) : 0;
		groupsHtml += `<div class="group"><div class="group-head"><span class="group-label">${group.label}</span><span class="group-avg" style="color:${gradeColor(report.grade)}">${groupScore.length > 0 ? avg + "/100" : "—"}</span></div>\n`;
		groupsHtml += groupChecks.map(checkCard).join("\n");
		groupsHtml += `</div>\n`;
	}

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vibe Check — ${esc(report.meta.cwd.split("/").pop() || "project")}</title>
<style>
:root{--bg:#09090b;--card:#141418;--border:#23232a;--text:#e5e5e5;--muted:#6b7280;--pass:#22c55e;--fail:#ef4444;--warn:#eab308;--info:#6366f1}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Inter",system-ui,sans-serif;background:var(--bg);color:var(--text);padding:2rem 1.5rem;max-width:780px;margin:0 auto;line-height:1.5}
code{font-family:"SF Mono",Menlo,monospace;font-size:0.85em}
h1{font-size:1.4rem;font-weight:700;margin-bottom:0.2rem}
.meta{color:var(--muted);font-size:0.78rem;margin-bottom:2rem}
.hero{text-align:center;padding:2rem;border-radius:1rem;margin-bottom:1.5rem;border:1px solid var(--border);background:var(--card)}
.hero-grade{font-size:5rem;font-weight:900;letter-spacing:-0.05em;line-height:1}
.hero-score{font-size:1.3rem;font-weight:600;margin-top:0.3rem}
.hero-detail{color:var(--muted);font-size:0.78rem;margin-top:0.5rem}
.stack{display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:1.5rem}
.stack span{background:var(--card);border:1px solid var(--border);padding:0.15rem 0.55rem;border-radius:9999px;font-size:0.68rem;color:var(--muted)}
.group{margin-bottom:1.2rem}
.group-head{display:flex;justify-content:space-between;align-items:center;padding:0 0.2rem 0.4rem;border-bottom:1px solid var(--border);margin-bottom:0.5rem}
.group-label{font-weight:700;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--muted)}
.group-avg{font-size:0.8rem;font-weight:600}
.card{background:var(--card);border:1px solid var(--border);border-radius:0.65rem;margin-bottom:0.4rem;overflow:hidden}
.card.skipped{opacity:0.5}
.card-head{display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.85rem}
.card-grade{font-size:1.3rem;font-weight:900;width:1.8rem;text-align:center;flex-shrink:0}
.card-info{flex:1}
.card-info strong{font-size:0.85rem;text-transform:capitalize;display:block}
.card-score{font-size:0.7rem;color:var(--muted)}
.card-ms{font-size:0.6rem;color:var(--muted)}
.skip-reason{padding:0 0.85rem 0.4rem 3.3rem;font-size:0.72rem;color:var(--muted);font-style:italic}
.card-details{padding:0.2rem 0.85rem 0.4rem 3.3rem;font-size:0.72rem;color:var(--muted);display:flex;gap:0.8rem;flex-wrap:wrap}
.d-item strong{color:var(--text);margin-right:0.2rem}
.card-issues{border-top:1px solid var(--border);padding:0.3rem 0.85rem 0.4rem 3.3rem;max-height:300px;overflow-y:auto}
.issue{font-size:0.68rem;font-family:"SF Mono",monospace;padding:0.12rem 0;display:flex;gap:0.4rem;align-items:baseline}
.i-sev{font-weight:800;font-size:0.58rem;width:1rem;flex-shrink:0;text-align:center;border-radius:3px;padding:0.05rem 0}
.issue.error .i-sev{color:var(--fail);background:#ef444420}
.issue.warning .i-sev{color:var(--warn);background:#eab30820}
.issue.info .i-sev{color:var(--info);background:#6366f120}
.i-loc{color:var(--muted);flex-shrink:0}
.i-msg{flex:1;word-break:break-word}
.i-rule{color:var(--muted);font-size:0.6rem;flex-shrink:0}
.footer{text-align:center;color:var(--muted);font-size:0.62rem;margin-top:2rem;padding-top:0.8rem;border-top:1px solid var(--border)}
.footer a{color:var(--muted)}
</style>
</head>
<body>
<h1>vibe-check</h1>
<p class="meta">${esc(report.meta.cwd)} &mdash; ${report.timestamp}</p>

<div class="hero">
  <div class="hero-grade" style="color:${gc}">${report.grade}</div>
  <div class="hero-score" style="color:${gc}">${report.score}/100</div>
  <div class="hero-detail">${activeChecks.length} checks &middot; ${totalIssues} issues &middot; ${skippedChecks.length > 0 ? skippedChecks.length + " skipped &middot; " : ""}${report.meta.duration}ms</div>
</div>

<div class="stack">
  ${Object.entries(report.meta.stack).filter(([, v]) => v !== "none" && v !== "unknown").map(([k, v]) => `<span>${k}: <strong>${v}</strong></span>`).join("")}
</div>

${groupsHtml}

<div class="footer">
  Generated by <a href="https://github.com/freeappstore-online/vibe-check">vibe-check</a> v${report.version} &mdash; code health scanner for the AI coding era
</div>
</body></html>`;
}
