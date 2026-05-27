/** Generate a multi-page navigable HTML report.
 *
 * Architecture:
 *   Primary nav:   Overview | Foundations | Quality | Testing | Security | Architecture | AI Readiness
 *   Secondary nav:  Issues (N) | Files  (right-aligned, visually distinct)
 *   Sidebar:        Score + dimension tree + view links
 *   Overview:       Dashboard with score, radar, timeline, category cards, top issues, file hotspots
 *   Dimensions:     Sub-tabs for each check within a category
 *   Views:          Cross-cutting data slices (issues table, file health map)
 *
 * All in one self-contained HTML file using show/hide navigation.
 */

import { getCheckMeta } from "../check-meta.js";
import type { CheckResult, VibeReport } from "../types.js";
import { e, fileLink, gc } from "./components.js";
import { type CatScore, categoryPages, filesPage, issuesPage, overviewPage } from "./pages.js";
import { CSS } from "./styles.js";

const GROUPS: { id: string; label: string; checks: string[] }[] = [
	{ id: "foundations", label: "Foundations", checks: ["structure", "lint", "types", "type-safety", "standards"] },
	{
		id: "quality",
		label: "Quality",
		checks: [
			"complexity",
			"duplication",
			"error-handling",
			"react",
			"accessibility",
			"performance",
			"ios-safe-area",
			"pwa-manifest",
			"meta-tags",
			"docs",
		],
	},
	{ id: "testing", label: "Testing", checks: ["testing"] },
	{ id: "arch", label: "Architecture", checks: ["architecture"] },
	{ id: "security", label: "Security", checks: ["secrets", "security", "dependencies"] },
	{ id: "llm", label: "AI Readiness", checks: ["confusion", "context"] },
	{ id: "ai", label: "AI Analysis", checks: ["doc-coherence", "code-coherence"] },
];

export function generateHTML(report: VibeReport, historyDir?: string): string {
	const allChecks = report.checks;
	const checkMap = new Map(allChecks.map((c) => [c.name, c]));
	const active = allChecks.filter((c) => !(c.details as any).skipped && !(c.details as any).comingSoon);
	const ru = report.meta.repoUrl;
	const br = report.meta.branch;
	const fl = (path: string, line?: number) => fileLink(path, line, ru, br);
	const totalIssues = allChecks.reduce((s, c) => s + c.issues.length, 0);
	const proj = report.meta.cwd.split("/").pop() || "project";

	// ── Aggregate file issues across all checks ──
	const fileIssues = new Map<string, { errors: number; warnings: number; checks: Set<string> }>();
	for (const c of allChecks) {
		for (const iss of c.issues) {
			if (!iss.file) continue;
			const f = iss.file.split(":")[0]!;
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
		.slice(0, 30);

	// ── Category averages ──
	const catScores: CatScore[] = GROUPS.map((g) => {
		const checks = g.checks.map((n) => checkMap.get(n)).filter(Boolean) as CheckResult[];
		const scored = checks.filter((c) => !(c.details as any).skipped);
		const avg = scored.length > 0 ? Math.round(scored.reduce((s, c) => s + c.score, 0) / scored.length) : 0;
		return { ...g, avg, checks };
	});

	// ── Primary nav (dimensions) ──
	const dimNavItems = [{ id: "overview", label: "Overview" }, ...GROUPS.map((g) => ({ id: g.id, label: g.label }))];
	const dimNav = dimNavItems.map((t) => `<a class="tn" data-page="${t.id}" onclick="go('${t.id}')">${t.label}</a>`).join("");

	// ── Secondary nav (data views, right-aligned) ──
	const viewNav = [
		{ id: "issues", label: `Issues (${totalIssues})` },
		{ id: "files", label: "Files" },
	]
		.map((t) => `<a class="tn tn-view" data-page="${t.id}" onclick="go('${t.id}')">${t.label}</a>`)
		.join("");

	// ── Sidebar ──
	const sidebarDims = catScores
		.map((cs) => {
			const isPremiumGroup = cs.checks.every((c) => (c.details as any).comingSoon);
			const clr = isPremiumGroup ? "#6366f1" : gc(cs.avg >= 90 ? "A" : cs.avg >= 75 ? "B" : cs.avg >= 60 ? "C" : cs.avg >= 40 ? "D" : "F");
			const scoreLabel = isPremiumGroup
				? `<span class="pro-badge" style="font-size:0.5rem;padding:0.08rem 0.35rem">PRO</span>`
				: `<span style="color:${clr}">${cs.avg}</span>`;
			return `<div class="side-section"><a class="side-cat" onclick="go('${cs.id}')">${cs.label} ${scoreLabel}</a>${cs.checks
				.map((c) => {
					const sk = (c.details as any).skipped;
					const premium = (c.details as any).comingSoon;
					const meta = getCheckMeta(c.name);
					if (premium)
						return `<a class="side-check" onclick="go('${cs.id}')" title="${e(meta.label)}"><span style="color:#6366f1">PRO</span> ${e(meta.label)}</a>`;
					return `<a class="side-check" onclick="go('${cs.id}')" title="${e(meta.label)}"><span style="color:${sk ? "#555" : gc(c.grade)}">${sk ? "\u2014" : c.grade}</span> ${e(meta.label)}</a>`;
				})
				.join("")}</div>`;
		})
		.join("");

	const sidebarViews = `<div class="side-section side-views"><div class="side-views-label">Views</div><a class="side-check" onclick="go('issues')">Issues <span style="color:var(--muted)">${totalIssues}</span></a><a class="side-check" onclick="go('files')">Files <span style="color:var(--muted)">${fileIssues.size}</span></a></div>`;

	// ── Assemble pages ──
	const overview = overviewPage(report, active, totalIssues, catScores, allChecks, topFiles, fl, historyDir);
	const catPages = categoryPages(catScores, fl);
	const issues = issuesPage(allChecks, totalIssues, fl);
	const files = filesPage(topFiles, fileIssues, fl);

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VibeCode QA \u2014 ${e(proj)}</title>
<style>${CSS}</style>
</head>
<body>

<nav class="top">
  <div class="logo"><span>VibeCode</span> QA</div>
  <div class="nav-dims">${dimNav}</div>
  <div class="nav-views">${viewNav}</div>
</nav>

<aside class="side">
  <div class="side-section">Score<div class="side-score" style="color:${gc(report.grade)}">${report.grade} ${report.score}</div></div>
  ${sidebarDims}
  ${sidebarViews}
</aside>
<div class="content">
  ${overview}
  ${catPages}
  ${issues}
  ${files}
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
// Copy-prompt buttons
document.addEventListener('click',function(ev){
  var btn=ev.target.closest('.cp-btn');
  if(!btn)return;
  navigator.clipboard.writeText(btn.dataset.prompt||'');
  btn.textContent='\\u2713';setTimeout(function(){btn.textContent='\\ud83d\\udccb'},1000);
});
// Init: show overview
document.querySelector('.tn').classList.add('active');
</script>
</body></html>`;
}
