/** Page renderers for the HTML report. */

import { getCheckMeta } from "../check-meta.js";
import { generateArchSVG } from "../runners/architecture.js";
import type { CheckResult, VibeReport } from "../types.js";
import { e, gc, pc } from "./components.js";
import { buildRadar, buildRing } from "./svg.js";

export interface CatScore {
	id: string;
	label: string;
	checks: CheckResult[];
	avg: number;
}

export interface FileEntry {
	file: string;
	total: number;
	errors: number;
	warnings: number;
	checks: string[];
}

type FL = (path: string, line?: number) => string;

export function overviewPage(
	report: VibeReport,
	active: CheckResult[],
	totalIssues: number,
	catScores: CatScore[],
): string {
	const ringPct = report.score;
	const barChart = active
		.sort((a, b) => a.score - b.score)
		.map((c) => {
			return `<div class="brow"><span class="bl">${e(c.name)}</span><div class="bb"><div class="bf" style="width:${c.score}%;background:${gc(c.grade)}"></div></div><span class="bv" style="color:${gc(c.grade)}">${c.grade} ${c.score}</span></div>`;
		})
		.join("");

	const catCards = catScores
		.map((cs) => {
			const clr = gc(cs.avg >= 90 ? "A" : cs.avg >= 75 ? "B" : cs.avg >= 60 ? "C" : cs.avg >= 40 ? "D" : "F");
			const mini = cs.checks
				.map((c) => {
					const sk = (c.details as any).skipped;
					return `<span class="mc" style="color:${sk ? "#555" : gc(c.grade)}" title="${e(c.name)}: ${sk ? "skip" : c.score}">${sk ? "\u2014" : c.grade}</span>`;
				})
				.join("");
			return `<div class="cc" onclick="go('${cs.id}')"><div class="cc-s" style="color:${clr}">${cs.avg}</div><div class="cc-l">${cs.label}</div><div class="cc-m">${mini}</div></div>`;
		})
		.join("");

	const radarSvg = buildRadar(catScores.map((cs) => ({ label: cs.label, score: cs.avg })));

	return `<div id="p-overview" class="page active">
<div class="dash">
  <div class="hero">
    ${buildRing(ringPct, gc(report.grade))}
    <div class="hc"><span class="hg" style="color:${gc(report.grade)}">${report.grade}</span><span class="hs" style="color:${gc(report.grade)}">${report.score}/100</span><span class="hd">${active.length} checks \u00b7 ${totalIssues} issues \u00b7 ${report.meta.duration}ms</span></div>
  </div>
  <div class="radar">${radarSvg}</div>
</div>
<div class="cats">${catCards}</div>
<h3>All Checks</h3>
<div class="bars">${barChart}</div>
<div class="stack">${Object.entries(report.meta.stack)
		.filter(([, v]) => v !== "none" && v !== "unknown")
		.map(([k, v]) => `<span>${k}: <b>${v}</b></span>`)
		.join("")}</div>
</div>`;
}

export function categoryPages(catScores: CatScore[], fl: FL): string {
	let catPagesHtml = "";
	for (const cs of catScores) {
		const subNav = cs.checks
			.map((c, i) => {
				const sk = (c.details as any).skipped;
				return `<a class="sn${i === 0 ? " active" : ""}" data-sub="${cs.id}-${c.name}" onclick="sub(this,'${cs.id}')">${e(c.name)} <span style="color:${sk ? "#555" : gc(c.grade)}">${sk ? "\u2014" : c.grade}</span></a>`;
			})
			.join("");

		const subPages = cs.checks
			.map((c, i) => {
				const meta = getCheckMeta(c.name);
				const sk = (c.details as any).skipped;
				const detailsFiltered = Object.entries(c.details)
					.filter(([k]) => k !== "skipped" && k !== "reason" && k !== "graph")
					.map(([k, v]) => {
						const d = Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
						return `<div class="kv"><span class="k">${e(k)}</span><span class="v">${e(d)}</span></div>`;
					})
					.join("");

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
						const prompt = `Fix this issue in ${file}${iss.line ? `:${iss.line}` : ""}\n${iss.severity}: ${iss.message}${iss.rule ? ` (${iss.rule})` : ""}\nCheck: ${c.name}`;
						issuesHtml += `<div class="ir ${iss.severity}"><span class="is">${iss.severity[0].toUpperCase()}</span>${iss.line ? `<span class="il">${iss.line}</span>` : ""}<span class="im">${e(iss.message)}</span>${iss.rule ? `<span class="iru">${e(iss.rule)}</span>` : ""}<button class="cp-btn" data-prompt="${e(prompt)}" title="Copy fix prompt">\ud83d\udccb</button></div>`;
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
<div class="ch-head"><span class="ch-g" style="color:${sk ? "#555" : gc(c.grade)}">${sk ? "\u2014" : c.grade}</span><div><b>${e(meta.label)}</b><span class="ch-s">${sk ? "skipped" : `${c.score}/100`} \u00b7 weight ${meta.weight}% \u00b7 ${c.duration}ms \u00b7 ${c.issues.length} issues</span></div><span class="pri" style="color:${pc(meta.priority)}">${meta.priority}</span></div>
${meta.description ? `<div class="info-panel"><div class="ip-row"><span class="ip-label">What</span><span>${e(meta.description)}</span></div><div class="ip-row"><span class="ip-label">Risk</span><span>${e(meta.risk)}</span></div><div class="ip-row"><span class="ip-label">Fix</span><span>${e(meta.recommendation)}</span></div></div>` : ""}
${sk ? `<p class="skip-r">${e((c.details as any).reason || "skipped")}</p>` : ""}
${c.name === "architecture" && !sk ? `<div class="arch-svg">${generateArchSVG(c.details)}</div>` : ""}
${detailsFiltered ? `<div class="kvs">${detailsFiltered}</div>` : ""}
${issuesHtml ? `<div class="iss-list">${issuesHtml}</div>` : '<p style="color:var(--muted);font-size:0.8rem;margin-top:1rem">No issues found.</p>'}
</div>`;
			})
			.join("");

		const clr = gc(cs.avg >= 90 ? "A" : cs.avg >= 75 ? "B" : cs.avg >= 60 ? "C" : cs.avg >= 40 ? "D" : "F");
		catPagesHtml += `<div id="p-${cs.id}" class="page">
<div class="cat-head"><span style="color:${clr};font-size:1.8rem;font-weight:900">${cs.avg}</span><span style="color:${clr}">/100</span><span style="color:var(--muted);margin-left:0.5rem">${cs.label}</span></div>
<div class="bar2"><div class="bf2" style="width:${cs.avg}%;background:${clr}"></div></div>
<div class="sub-nav">${subNav}</div>
${subPages}
</div>`;
	}
	return catPagesHtml;
}

export function issuesPage(allChecks: CheckResult[], totalIssues: number, fl: FL): string {
	const allIssues = allChecks.flatMap((c) => c.issues.map((i) => ({ check: c.name, ...i })));
	const issueRows = allIssues
		.slice(0, 200)
		.map((i) => {
			const loc = i.file ? fl(i.file.split(":")[0]!, i.line) : "";
			return `<tr class="${i.severity}"><td class="is2">${i.severity[0].toUpperCase()}</td><td class="ic2">${e(i.check)}</td><td class="il2">${loc}</td><td>${e(i.message)}</td><td class="iru2">${e(i.rule || "")}</td></tr>`;
		})
		.join("");

	return `<div id="p-issues" class="page">
<h2>All Issues <span style="color:var(--muted);font-weight:400">${totalIssues}</span></h2>
<div class="isf">${allIssues.filter((i) => i.severity === "error").length} errors \u00b7 ${allIssues.filter((i) => i.severity === "warning").length} warnings</div>
<table class="it"><thead><tr><th></th><th>Check</th><th>Location</th><th>Message</th><th>Rule</th></tr></thead><tbody>${issueRows}</tbody></table>
${allIssues.length > 200 ? `<p style="color:var(--muted);text-align:center;margin-top:1rem">Showing 200 of ${allIssues.length}</p>` : ""}
</div>`;
}

export function filesPage(topFiles: FileEntry[], fl: FL): string {
	const fileRows = topFiles
		.map((f) => {
			const pct = Math.min(100, f.total * 5);
			return `<div class="fr"><span class="ff">${fl(f.file)}</span><div class="fb"><div class="fbf" style="width:${pct}%;background:${f.errors > 0 ? "var(--fail)" : "var(--warn)"}"></div></div><span class="fv">${f.errors}E ${f.warnings}W</span><span class="fcs">${f.checks.join(", ")}</span></div>`;
		})
		.join("");

	return `<div id="p-files" class="page">
<h2>File Heatmap</h2>
<p style="color:var(--muted);font-size:0.78rem;margin-bottom:1rem">Top ${topFiles.length} files by total issues across all checks</p>
${fileRows || '<p style="color:var(--muted)">No file-level issues found.</p>'}
</div>`;
}

export function heatmapPage(
	fileIssues: Map<string, { errors: number; warnings: number; checks: Set<string> }>,
	fl: FL,
): string {
	const heatmapFiles = [...fileIssues.entries()].sort((a, b) => b[1].errors + b[1].warnings - a[1].errors - a[1].warnings).slice(0, 30);
	let heatmapHtml = "";
	if (heatmapFiles.length > 0) {
		const maxIssues = Math.max(...heatmapFiles.map(([, d]) => d.errors + d.warnings));
		heatmapHtml = heatmapFiles
			.map(([file, d]) => {
				const total = d.errors + d.warnings;
				const intensity = maxIssues > 0 ? total / maxIssues : 0;
				const r = Math.round(239 * intensity); // red channel
				const g = Math.round(68 * (1 - intensity) + 197 * (d.errors === 0 ? 0.3 : 0)); // green
				const color = `rgb(${r},${g},30)`;
				const barW = Math.max(4, Math.round(intensity * 200));
				const checks = [...d.checks].join(", ");
				return `<div class="hm-row"><span class="hm-name">${fl(file)}</span><div class="hm-bar" style="width:${barW}px;background:${color}" title="${total} issues (${checks})"></div><span class="hm-count">${d.errors}E ${d.warnings}W</span></div>`;
			})
			.join("");
	}

	return `<div id="p-heatmap" class="page">
<h2>Code Heatmap</h2>
<p style="color:var(--muted);font-size:0.78rem;margin-bottom:1rem">Visual density of issues per file. Red = errors, orange = warnings. Bar width = relative issue count.</p>
${heatmapHtml || '<p style="color:var(--muted)">No issues to visualize.</p>'}
</div>`;
}
