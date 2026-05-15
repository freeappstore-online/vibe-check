/** Generate a multi-page navigable HTML report.
 *
 * Architecture:
 *   Top nav:    Overview | Foundations | Quality | Testing | Security | Issues
 *   Sub-nav:    Tabs for each check within a category
 *   Detail:     Per-check stats + full issue list grouped by file
 *   File map:   Cross-check heatmap of issues per file
 *
 * All in one self-contained HTML file using hash routing + show/hide.
 */

import { getCheckMeta, type Priority } from "../check-meta.js";
import { generateArchSVG } from "../runners/architecture.js";
import type { CheckResult, VibeReport } from "../types.js";

function e(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
/** Make a file path a clickable GitHub link if repoUrl is available. */
function fileLink(path: string, line: number | undefined, repoUrl: string | null, branch: string): string {
	const clean = path.split(":")[0]!; // strip :line from composite paths
	if (!repoUrl) return e(path);
	const href = `${repoUrl}/blob/${branch}/${clean}${line ? "#L" + line : ""}`;
	return `<a href="${e(href)}" target="_blank" rel="noopener" class="flink">${e(path)}</a>`;
}
function gc(grade: string): string {
	return { A: "#22c55e", B: "#84cc16", C: "#eab308", D: "#f97316", F: "#ef4444" }[grade] || "#6b7280";
}
function pc(p: Priority): string {
	return { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#6b7280" }[p];
}

const GROUPS: { id: string; label: string; checks: string[] }[] = [
	{ id: "foundations", label: "Foundations", checks: ["structure", "lint", "types", "type-safety", "standards"] },
	{ id: "quality", label: "Quality", checks: ["complexity", "duplication", "docs"] },
	{ id: "testing", label: "Testing", checks: ["testing"] },
	{ id: "arch", label: "Architecture", checks: ["architecture"] },
	{ id: "security", label: "Security", checks: ["secrets", "security", "dependencies"] },
	{ id: "llm", label: "LLM Readiness", checks: ["confusion", "context"] },
];

export function generateHTML(report: VibeReport): string {
	const allChecks = report.checks;
	const checkMap = new Map(allChecks.map((c) => [c.name, c]));
	const active = allChecks.filter((c) => !(c.details as any).skipped);
	const ru = report.meta.repoUrl;
	const br = report.meta.branch;
	const fl = (path: string, line?: number) => fileLink(path, line, ru, br);
	const totalIssues = allChecks.reduce((s, c) => s + c.issues.length, 0);
	const proj = report.meta.cwd.split("/").pop() || "project";

	// ── File heatmap: aggregate issues per file across all checks ──
	const fileIssues = new Map<string, { errors: number; warnings: number; checks: Set<string> }>();
	for (const c of allChecks) {
		for (const iss of c.issues) {
			if (!iss.file) continue;
			const f = iss.file.split(":")[0]!; // strip :line from composite file fields
			const entry = fileIssues.get(f) || { errors: 0, warnings: 0, checks: new Set() };
			if (iss.severity === "error") entry.errors++;
			else entry.warnings++;
			entry.checks.add(c.name);
			fileIssues.set(f, entry);
		}
	}
	const topFiles = [...fileIssues.entries()]
		.map(([file, d]) => ({ file, total: d.errors + d.warnings, errors: d.errors, warnings: d.warnings, checks: [...d.checks] }))
		.sort((a, b) => b.total - a.total)
		.slice(0, 20);

	// ── Category averages ──
	const catScores = GROUPS.map((g) => {
		const checks = g.checks.map((n) => checkMap.get(n)).filter(Boolean) as CheckResult[];
		const scored = checks.filter((c) => !(c.details as any).skipped);
		const avg = scored.length > 0 ? Math.round(scored.reduce((s, c) => s + c.score, 0) / scored.length) : 0;
		return { ...g, avg, checks };
	});

	// ── Build pages ──

	// Top nav
	const topNavItems = [
		{ id: "overview", label: "Overview" },
		...GROUPS.map((g) => ({ id: g.id, label: g.label })),
		{ id: "issues", label: `Issues (${totalIssues})` },
		{ id: "files", label: "File Map" },
		{ id: "heatmap", label: "Heatmap" },
	];
	const topNav = topNavItems.map((t) => `<a class="tn" data-page="${t.id}" onclick="go('${t.id}')">${t.label}</a>`).join("");

	// Overview page
	const ringPct = report.score;
	const barChart = active.sort((a, b) => a.score - b.score).map((c) => {
		return `<div class="brow"><span class="bl">${e(c.name)}</span><div class="bb"><div class="bf" style="width:${c.score}%;background:${gc(c.grade)}"></div></div><span class="bv" style="color:${gc(c.grade)}">${c.grade} ${c.score}</span></div>`;
	}).join("");

	const catCards = catScores.map((cs) => {
		const clr = gc(cs.avg >= 90 ? "A" : cs.avg >= 75 ? "B" : cs.avg >= 60 ? "C" : cs.avg >= 40 ? "D" : "F");
		const mini = cs.checks.map((c) => {
			const sk = (c.details as any).skipped;
			return `<span class="mc" style="color:${sk ? "#555" : gc(c.grade)}" title="${e(c.name)}: ${sk ? "skip" : c.score}">${sk ? "—" : c.grade}</span>`;
		}).join("");
		return `<div class="cc" onclick="go('${cs.id}')"><div class="cc-s" style="color:${clr}">${cs.avg}</div><div class="cc-l">${cs.label}</div><div class="cc-m">${mini}</div></div>`;
	}).join("");

	const radarSvg = buildRadar(catScores.map((cs) => ({ label: cs.label, score: cs.avg })));

	const overviewPage = `<div id="p-overview" class="page active">
<div class="dash">
  <div class="hero">
    ${buildRing(ringPct, gc(report.grade))}
    <div class="hc"><span class="hg" style="color:${gc(report.grade)}">${report.grade}</span><span class="hs" style="color:${gc(report.grade)}">${report.score}/100</span><span class="hd">${active.length} checks · ${totalIssues} issues · ${report.meta.duration}ms</span></div>
  </div>
  <div class="radar">${radarSvg}</div>
</div>
<div class="cats">${catCards}</div>
<h3>All Checks</h3>
<div class="bars">${barChart}</div>
<div class="stack">${Object.entries(report.meta.stack).filter(([, v]) => v !== "none" && v !== "unknown").map(([k, v]) => `<span>${k}: <b>${v}</b></span>`).join("")}</div>
</div>`;

	// Category pages (with sub-nav tabs for each check)
	let catPages = "";
	for (const cs of catScores) {
		const subNav = cs.checks.map((c, i) => {
			const sk = (c.details as any).skipped;
			return `<a class="sn${i === 0 ? " active" : ""}" data-sub="${cs.id}-${c.name}" onclick="sub(this,'${cs.id}')">${e(c.name)} <span style="color:${sk ? "#555" : gc(c.grade)}">${sk ? "—" : c.grade}</span></a>`;
		}).join("");

		const subPages = cs.checks.map((c, i) => {
			const meta = getCheckMeta(c.name);
			const sk = (c.details as any).skipped;
			const detailsFiltered = Object.entries(c.details).filter(([k]) => k !== "skipped" && k !== "reason" && k !== "graph").map(([k, v]) => {
				const d = Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
				return `<div class="kv"><span class="k">${e(k)}</span><span class="v">${e(d)}</span></div>`;
			}).join("");

			// Group issues by file
			const byFile = new Map<string, typeof c.issues>();
			const noFile: typeof c.issues = [];
			for (const iss of c.issues) {
				const f = iss.file?.split(":")[0];
				if (f) {
					const arr = byFile.get(f) || [];
					arr.push(iss);
					byFile.set(f, arr);
				} else {
					noFile.push(iss);
				}
			}

			let issuesHtml = "";
			for (const [file, issues] of byFile) {
				issuesHtml += `<div class="fg"><div class="fn">${fl(file)} <span class="fc">${issues.length}</span></div>`;
				for (const iss of issues) {
					const prompt = `Fix this issue in ${file}${iss.line ? ":" + iss.line : ""}\\n${iss.severity}: ${iss.message}${iss.rule ? " (" + iss.rule + ")" : ""}\\nCheck: ${c.name}`;
					issuesHtml += `<div class="ir ${iss.severity}"><span class="is">${iss.severity[0].toUpperCase()}</span>${iss.line ? `<span class="il">${iss.line}</span>` : ""}<span class="im">${e(iss.message)}</span>${iss.rule ? `<span class="iru">${e(iss.rule)}</span>` : ""}<button class="cp-btn" onclick="navigator.clipboard.writeText('${prompt.replace(/'/g, "\\'")}');this.textContent='✓';setTimeout(()=>this.textContent='📋',1000)" title="Copy fix prompt">📋</button></div>`;
				}
				issuesHtml += `</div>`;
			}
			if (noFile.length > 0) {
				issuesHtml += `<div class="fg"><div class="fn">General</div>`;
				for (const iss of noFile) {
					issuesHtml += `<div class="ir ${iss.severity}"><span class="is">${iss.severity[0].toUpperCase()}</span><span class="im">${e(iss.message)}</span>${iss.rule ? `<span class="iru">${e(iss.rule)}</span>` : ""}</div>`;
				}
				issuesHtml += `</div>`;
			}

			return `<div class="sp${i === 0 ? " active" : ""}" data-sub="${cs.id}-${c.name}">
<div class="ch-head"><span class="ch-g" style="color:${sk ? "#555" : gc(c.grade)}">${sk ? "—" : c.grade}</span><div><b>${e(meta.label)}</b><span class="ch-s">${sk ? "skipped" : c.score + "/100"} · weight ${meta.weight}% · ${c.duration}ms · ${c.issues.length} issues</span></div><span class="pri" style="color:${pc(meta.priority)}">${meta.priority}</span></div>
${meta.description ? `<div class="info-panel"><div class="ip-row"><span class="ip-label">What</span><span>${e(meta.description)}</span></div><div class="ip-row"><span class="ip-label">Risk</span><span>${e(meta.risk)}</span></div><div class="ip-row"><span class="ip-label">Fix</span><span>${e(meta.recommendation)}</span></div></div>` : ""}
${sk ? `<p class="skip-r">${e((c.details as any).reason || "skipped")}</p>` : ""}
${c.name === "architecture" && !sk ? `<div class="arch-svg">${generateArchSVG(c.details)}</div>` : ""}
${detailsFiltered ? `<div class="kvs">${detailsFiltered}</div>` : ""}
${issuesHtml ? `<div class="iss-list">${issuesHtml}</div>` : '<p style="color:var(--muted);font-size:0.8rem;margin-top:1rem">No issues found.</p>'}
</div>`;
		}).join("");

		const clr = gc(cs.avg >= 90 ? "A" : cs.avg >= 75 ? "B" : cs.avg >= 60 ? "C" : cs.avg >= 40 ? "D" : "F");
		catPages += `<div id="p-${cs.id}" class="page">
<div class="cat-head"><span style="color:${clr};font-size:1.8rem;font-weight:900">${cs.avg}</span><span style="color:${clr}">/100</span><span style="color:var(--muted);margin-left:0.5rem">${cs.label}</span></div>
<div class="bar2"><div class="bf2" style="width:${cs.avg}%;background:${clr}"></div></div>
<div class="sub-nav">${subNav}</div>
${subPages}
</div>`;
	}

	// All Issues page
	const allIssues = allChecks.flatMap((c) => c.issues.map((i) => ({ check: c.name, ...i })));
	const issueRows = allIssues.slice(0, 200).map((i) => {
		const loc = i.file ? fl(i.file.split(":")[0]!, i.line) : "";
		return `<tr class="${i.severity}"><td class="is2">${i.severity[0].toUpperCase()}</td><td class="ic2">${e(i.check)}</td><td class="il2">${loc}</td><td>${e(i.message)}</td><td class="iru2">${e(i.rule || "")}</td></tr>`;
	}).join("");

	const issuesPage = `<div id="p-issues" class="page">
<h2>All Issues <span style="color:var(--muted);font-weight:400">${totalIssues}</span></h2>
<div class="isf">${allIssues.filter((i) => i.severity === "error").length} errors · ${allIssues.filter((i) => i.severity === "warning").length} warnings</div>
<table class="it"><thead><tr><th></th><th>Check</th><th>Location</th><th>Message</th><th>Rule</th></tr></thead><tbody>${issueRows}</tbody></table>
${allIssues.length > 200 ? `<p style="color:var(--muted);text-align:center;margin-top:1rem">Showing 200 of ${allIssues.length}</p>` : ""}
</div>`;

	// File heatmap page
	const fileRows = topFiles.map((f) => {
		const pct = Math.min(100, f.total * 5);
		return `<div class="fr"><span class="ff">${fl(f.file)}</span><div class="fb"><div class="fbf" style="width:${pct}%;background:${f.errors > 0 ? "var(--fail)" : "var(--warn)"}"></div></div><span class="fv">${f.errors}E ${f.warnings}W</span><span class="fcs">${f.checks.join(", ")}</span></div>`;
	}).join("");

	const filesPage = `<div id="p-files" class="page">
<h2>File Heatmap</h2>
<p style="color:var(--muted);font-size:0.78rem;margin-bottom:1rem">Top ${topFiles.length} files by total issues across all checks</p>
${fileRows || '<p style="color:var(--muted)">No file-level issues found.</p>'}
</div>`;

	// Codebase heatmap — each file = row of pixels, color = issue density
	const heatmapFiles = [...fileIssues.entries()]
		.sort((a, b) => b[1].errors + b[1].warnings - a[1].errors - a[1].warnings)
		.slice(0, 30);
	let heatmapHtml = "";
	if (heatmapFiles.length > 0) {
		const maxIssues = Math.max(...heatmapFiles.map(([, d]) => d.errors + d.warnings));
		heatmapHtml = heatmapFiles.map(([file, d]) => {
			const total = d.errors + d.warnings;
			const intensity = maxIssues > 0 ? total / maxIssues : 0;
			const r = Math.round(239 * intensity); // red channel
			const g = Math.round(68 * (1 - intensity) + 197 * (d.errors === 0 ? 0.3 : 0)); // green
			const color = `rgb(${r},${g},30)`;
			const barW = Math.max(4, Math.round(intensity * 200));
			const checks = [...d.checks].join(", ");
			return `<div class="hm-row"><span class="hm-name">${fl(file)}</span><div class="hm-bar" style="width:${barW}px;background:${color}" title="${total} issues (${checks})"></div><span class="hm-count">${d.errors}E ${d.warnings}W</span></div>`;
		}).join("");
	}

	const heatmapPage = `<div id="p-heatmap" class="page">
<h2>Code Heatmap</h2>
<p style="color:var(--muted);font-size:0.78rem;margin-bottom:1rem">Visual density of issues per file. Red = errors, orange = warnings. Bar width = relative issue count.</p>
${heatmapHtml || '<p style="color:var(--muted)">No issues to visualize.</p>'}
</div>`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VibeCode QA — ${e(proj)}</title>
<style>
:root{--bg:#09090b;--card:#111115;--border:#1e1e24;--text:#e5e5e5;--muted:#6b7280;--pass:#22c55e;--fail:#ef4444;--warn:#eab308;--info:#6366f1;--accent:#818cf8}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Inter",system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.5}
code{font-family:"SF Mono",Menlo,monospace;font-size:0.85em}

/* Top nav */
.top{position:sticky;top:0;z-index:20;background:#0c0c0fcc;backdrop-filter:blur(12px);border-bottom:1px solid var(--border);padding:0 2rem;display:flex;align-items:center;gap:0}
.logo{font-weight:800;font-size:1rem;margin-right:1.5rem;padding:0.7rem 0}
.logo span{color:var(--accent)}
.tn{padding:0.7rem 0.8rem;font-size:0.78rem;color:var(--muted);text-decoration:none;cursor:pointer;border-bottom:2px solid transparent;transition:all 0.15s}
.tn:hover{color:var(--text)}
.tn.active{color:var(--text);border-bottom-color:var(--accent)}

/* Sidebar */
.side{position:fixed;top:42px;left:0;bottom:0;width:200px;background:#0c0c0f;border-right:1px solid var(--border);overflow-y:auto;padding:0.8rem 0;font-size:0.7rem;z-index:10}
.side-section{padding:0.3rem 0;border-bottom:1px solid var(--border)}
.side-section:last-child{border-bottom:none}
.side-score{font-size:1.4rem;font-weight:900;padding:0.3rem 0.8rem}
.side-cat{display:block;padding:0.3rem 0.8rem;color:var(--text);font-weight:700;cursor:pointer;text-decoration:none;font-size:0.72rem}
.side-cat:hover{background:#14141a}
.side-check{display:block;padding:0.2rem 0.8rem 0.2rem 1.2rem;color:var(--muted);cursor:pointer;text-decoration:none;font-size:0.65rem}
.side-check:hover{color:var(--text);background:#14141a}
.side-check span{display:inline-block;width:1rem;font-weight:800;text-align:center}

/* Content */
.content{max-width:900px;margin-left:200px;padding:2rem}
.page{display:none;animation:fadeIn 0.15s}
.page.active{display:block}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}

/* Overview */
.dash{display:flex;gap:2rem;margin-bottom:2rem;align-items:center;flex-wrap:wrap}
.hero{display:flex;align-items:center;gap:1rem}
.hero svg{width:100px;height:100px}
.hc{display:flex;flex-direction:column}
.hg{font-size:2.5rem;font-weight:900;line-height:1}
.hs{font-size:1rem;font-weight:600}
.hd{font-size:0.68rem;color:var(--muted)}
.radar{flex:1;display:flex;justify-content:center}
.radar svg{max-width:240px;width:100%}
.cats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:0.6rem;margin-bottom:2rem}
.cc{background:var(--card);border:1px solid var(--border);border-radius:0.6rem;padding:0.8rem;cursor:pointer;transition:border-color 0.15s}
.cc:hover{border-color:var(--accent)}
.cc-s{font-size:1.8rem;font-weight:900}
.cc-l{font-size:0.75rem;color:var(--muted)}
.cc-m{margin-top:0.3rem;display:flex;gap:0.25rem}
.mc{font-size:0.65rem;font-weight:800}
h3{font-size:0.85rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:0.5rem}
.bars{margin-bottom:1.5rem}
.brow{display:flex;align-items:center;gap:0.4rem;margin-bottom:0.25rem;font-size:0.72rem}
.bl{width:80px;text-align:right;color:var(--muted);flex-shrink:0}
.bb{flex:1;height:14px;background:var(--card);border-radius:3px;overflow:hidden;border:1px solid var(--border)}
.bf{height:100%;border-radius:2px}
.bv{width:36px;font-weight:700;font-size:0.68rem}
.stack{display:flex;gap:0.35rem;flex-wrap:wrap}
.stack span{background:var(--card);border:1px solid var(--border);padding:0.1rem 0.45rem;border-radius:9999px;font-size:0.62rem;color:var(--muted)}

/* Category pages */
.cat-head{margin-bottom:0.3rem}
.bar2{height:4px;background:var(--card);border-radius:2px;margin-bottom:1rem;overflow:hidden}
.bf2{height:100%;border-radius:2px}
.sub-nav{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:1rem}
.sn{padding:0.5rem 0.8rem;font-size:0.75rem;color:var(--muted);cursor:pointer;border-bottom:2px solid transparent}
.sn:hover{color:var(--text)}
.sn.active{color:var(--text);border-bottom-color:var(--accent)}
.sp{display:none}.sp.active{display:block}

/* Check detail */
.ch-head{display:flex;align-items:center;gap:0.7rem;margin-bottom:0.8rem}
.ch-g{font-size:2rem;font-weight:900}
.ch-s{display:block;font-size:0.7rem;color:var(--muted)}
.pri{font-size:0.62rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;padding:0.15rem 0.5rem;border-radius:9999px;border:1px solid currentColor;flex-shrink:0}
.info-panel{background:#0d0d12;border:1px solid var(--border);border-radius:0.5rem;padding:0.7rem 0.9rem;margin-bottom:1rem;font-size:0.72rem;line-height:1.6}
.ip-row{margin-bottom:0.4rem;display:flex;gap:0.5rem}
.ip-row:last-child{margin-bottom:0}
.ip-label{color:var(--accent);font-weight:700;min-width:2.5rem;flex-shrink:0}
.skip-r{color:var(--muted);font-style:italic;font-size:0.78rem}
.kvs{display:flex;gap:0.6rem;flex-wrap:wrap;margin-bottom:1rem}
.kv{background:var(--card);border:1px solid var(--border);border-radius:0.4rem;padding:0.3rem 0.6rem;font-size:0.7rem}
.k{color:var(--muted);margin-right:0.3rem}
.v{font-weight:600}

/* Issue list grouped by file */
.iss-list{margin-top:1rem}
.fg{margin-bottom:0.8rem}
.fn{font-size:0.72rem;font-weight:600;font-family:"SF Mono",monospace;padding:0.3rem 0;border-bottom:1px solid var(--border);margin-bottom:0.2rem;display:flex;align-items:center;gap:0.5rem}
.fc{background:var(--border);border-radius:9999px;padding:0 0.4rem;font-size:0.6rem;color:var(--muted)}
.ir{font-size:0.65rem;font-family:"SF Mono",monospace;padding:0.12rem 0 0.12rem 0.5rem;display:flex;gap:0.4rem;align-items:baseline}
.is{font-weight:800;font-size:0.55rem;width:0.9rem;text-align:center;border-radius:2px;flex-shrink:0}
.ir.error .is{color:var(--fail);background:#ef444418}
.ir.warning .is{color:var(--warn);background:#eab30818}
.il{color:var(--accent);min-width:2rem;flex-shrink:0}
.im{flex:1;word-break:break-word}
.iru{color:#555;font-size:0.55rem}

/* All issues table */
.isf{color:var(--muted);font-size:0.75rem;margin-bottom:0.8rem}
.it{width:100%;border-collapse:collapse;font-size:0.68rem}
.it th{text-align:left;padding:0.35rem 0.4rem;color:var(--muted);font-size:0.62rem;text-transform:uppercase;border-bottom:1px solid var(--border)}
.it td{padding:0.25rem 0.4rem;border-bottom:1px solid var(--border);font-family:"SF Mono",monospace;font-size:0.62rem}
.it tr.error .is2{color:var(--fail)}
.it tr.warning .is2{color:var(--warn)}
.is2{font-weight:800;width:1rem}
.ic2{color:var(--muted);width:70px}
.il2{color:var(--muted)}
.iru2{color:#555;font-size:0.58rem}

/* File heatmap */
.fr{display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem;font-size:0.7rem}
.ff{width:200px;font-family:"SF Mono",monospace;font-size:0.65rem;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fb{flex:1;height:12px;background:var(--card);border-radius:3px;overflow:hidden;border:1px solid var(--border)}
.fbf{height:100%;border-radius:2px}
.fv{width:50px;font-size:0.65rem;color:var(--muted);flex-shrink:0}
.fcs{font-size:0.6rem;color:#555}

.footer{text-align:center;color:var(--muted);font-size:0.58rem;margin-top:2rem;padding:0.8rem 0;border-top:1px solid var(--border)}
.footer a{color:var(--muted)}
.flink{color:var(--accent);text-decoration:none;font-family:"SF Mono",monospace}.flink:hover{text-decoration:underline}
.arch-svg{margin:1rem 0;overflow-x:auto}
.hm-row{display:flex;align-items:center;gap:0.5rem;margin-bottom:0.2rem;font-size:0.7rem}
.hm-name{width:200px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:"SF Mono",monospace;font-size:0.65rem}
.hm-bar{height:14px;border-radius:3px;min-width:4px}
.hm-count{color:var(--muted);font-size:0.65rem;flex-shrink:0}
.arch-svg svg{border-radius:8px}
.cp-btn{background:none;border:none;cursor:pointer;font-size:0.6rem;opacity:0.3;padding:0 0.2rem;flex-shrink:0}.cp-btn:hover{opacity:1}
.ir:hover .cp-btn{opacity:0.6}
@media(max-width:768px){.side{display:none}.content{margin-left:0;padding:1rem}.cats{grid-template-columns:1fr 1fr}.dash{flex-direction:column}}
</style>
</head>
<body>

<nav class="top">
  <div class="logo"><span>VibeCode</span> QA</div>
  ${topNav}
</nav>

<aside class="side">
  <div class="side-section">Score<div class="side-score" style="color:${gc(report.grade)}">${report.grade} ${report.score}</div></div>
  ${catScores.map((cs) => {
		const clr = gc(cs.avg >= 90 ? "A" : cs.avg >= 75 ? "B" : cs.avg >= 60 ? "C" : cs.avg >= 40 ? "D" : "F");
		return `<div class="side-section"><a class="side-cat" onclick="go('${cs.id}')">${cs.label} <span style="color:${clr}">${cs.avg}</span></a>${cs.checks.map((c) => {
			const sk = (c.details as any).skipped;
			const meta = getCheckMeta(c.name);
			return `<a class="side-check" onclick="go('${cs.id}')" title="${e(meta.label)}"><span style="color:${sk ? "#555" : gc(c.grade)}">${sk ? "—" : c.grade}</span> ${e(meta.label)}</a>`;
		}).join("")}</div>`;
	}).join("")}
</aside>
<div class="content">
  ${overviewPage}
  ${catPages}
  ${issuesPage}
  ${filesPage}
  ${heatmapPage}
  <div class="footer">Generated by <a href="https://vibecodeqa.online">VibeCode QA</a> v${report.version} &mdash; <code>npx @vibecodeqa/cli</code></div>
</div>

<script>
function go(id){
  document.querySelectorAll('.tn').forEach(n=>{n.classList.toggle('active',n.dataset.page===id)});
  document.querySelectorAll('.page').forEach(p=>{p.classList.toggle('active',p.id==='p-'+id)});
  window.scrollTo(0,0);
}
function sub(el,cat){
  const id=el.dataset.sub;
  el.parentElement.querySelectorAll('.sn').forEach(n=>n.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('#p-'+cat+' .sp').forEach(s=>{s.classList.toggle('active',s.dataset.sub===id)});
}
// Init: show overview
document.querySelector('.tn').classList.add('active');
</script>
</body></html>`;
}

// ── SVG builders ──

function buildRing(score: number, color: string): string {
	const r = 42;
	const c = 2 * Math.PI * r;
	const off = c - (score / 100) * c;
	return `<svg viewBox="0 0 100 100" style="width:100px;height:100px"><circle cx="50" cy="50" r="${r}" fill="none" stroke="#1e1e24" stroke-width="7"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-dasharray="${c}" stroke-dashoffset="${off}" stroke-linecap="round" transform="rotate(-90 50 50)"/></svg>`;
}

function buildRadar(items: { label: string; score: number }[]): string {
	const n = items.length;
	if (n < 3) return "";
	const cx = 120, cy = 120, r = 90;
	const step = (2 * Math.PI) / n;
	let grid = "";
	for (const pct of [25, 50, 75, 100]) {
		const rr = (pct / 100) * r;
		const pts = items.map((_, i) => `${cx + rr * Math.cos(i * step - Math.PI / 2)},${cy + rr * Math.sin(i * step - Math.PI / 2)}`).join(" ");
		grid += `<polygon points="${pts}" fill="none" stroke="#1e1e24" stroke-width="0.7"/>`;
	}
	let axes = "";
	for (let i = 0; i < n; i++) {
		const a = i * step - Math.PI / 2;
		axes += `<line x1="${cx}" y1="${cy}" x2="${cx + r * Math.cos(a)}" y2="${cy + r * Math.sin(a)}" stroke="#1e1e24" stroke-width="0.7"/>`;
		const lx = cx + (r + 16) * Math.cos(a);
		const ly = cy + (r + 16) * Math.sin(a);
		axes += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="#6b7280" font-size="9" font-weight="600">${items[i].label}</text>`;
	}
	const dataPts = items.map((c, i) => {
		const a = i * step - Math.PI / 2;
		const rr = (c.score / 100) * r;
		return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
	}).join(" ");
	let dots = "";
	for (let i = 0; i < n; i++) {
		const a = i * step - Math.PI / 2;
		const rr = (items[i].score / 100) * r;
		dots += `<circle cx="${cx + rr * Math.cos(a)}" cy="${cy + rr * Math.sin(a)}" r="3.5" fill="#818cf8"/>`;
	}
	return `<svg viewBox="0 0 240 240">${grid}${axes}<polygon points="${dataPts}" fill="#818cf825" stroke="#818cf8" stroke-width="1.5"/>${dots}</svg>`;
}
