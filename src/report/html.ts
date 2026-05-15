/** Generate a self-contained HTML report — a navigable single-page app with
 *  sidebar, radar chart, category drill-downs, and issue lists. */

import type { CheckResult, VibeReport } from "../types.js";

function esc(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function gc(grade: string): string {
	return { A: "#22c55e", B: "#84cc16", C: "#eab308", D: "#f97316", F: "#ef4444" }[grade] || "#6b7280";
}

const GROUPS: { id: string; label: string; icon: string; checks: string[] }[] = [
	{ id: "foundations", label: "Foundations", icon: "&#9881;", checks: ["structure", "lint", "types", "type-safety", "standards"] },
	{ id: "quality", label: "Quality", icon: "&#9733;", checks: ["complexity", "duplication", "docs"] },
	{ id: "testing", label: "Testing", icon: "&#9745;", checks: ["testing"] },
	{ id: "security", label: "Security", icon: "&#128274;", checks: ["secrets", "security", "dependencies"] },
];

function checkCard(c: CheckResult): string {
	const skipped = (c.details as any).skipped;
	const color = skipped ? "#555" : gc(c.grade);
	const detailHtml = Object.entries(c.details)
		.filter(([k]) => k !== "skipped" && k !== "reason")
		.map(([k, v]) => {
			const d = Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
			return `<span class="d"><b>${esc(k)}</b> ${esc(d)}</span>`;
		}).join("");
	const issueHtml = c.issues.slice(0, 20).map((i) => {
		const loc = i.file ? `<span class="iloc">${esc(i.file)}${i.line ? ":" + i.line : ""}</span>` : "";
		return `<div class="iss ${i.severity}"><span class="isev">${i.severity[0].toUpperCase()}</span>${loc}<span class="imsg">${esc(i.message)}</span>${i.rule ? `<span class="irule">${esc(i.rule)}</span>` : ""}</div>`;
	}).join("");
	const more = c.issues.length > 20 ? `<div class="iss info"><span class="isev">+</span><span class="imsg">${c.issues.length - 20} more</span></div>` : "";
	const skip = skipped ? `<div class="skip">${esc((c.details as any).reason || "skipped")}</div>` : "";

	return `<div class="card${skipped ? " sk" : ""}" id="check-${esc(c.name)}">
<div class="ch"><span class="cg" style="color:${color}">${skipped ? "—" : c.grade}</span><div class="ci"><b>${esc(c.name)}</b><span class="cs">${skipped ? "skipped" : c.score + "/100"} · ${c.duration}ms · ${c.issues.length} issues</span></div></div>
${skip}${detailHtml ? `<div class="cd">${detailHtml}</div>` : ""}${issueHtml ? `<div class="ciss">${issueHtml}${more}</div>` : ""}</div>`;
}

export function generateHTML(report: VibeReport): string {
	const totalIssues = report.checks.reduce((s, c) => s + c.issues.length, 0);
	const active = report.checks.filter((c) => !(c.details as any).skipped);
	const skipped = report.checks.filter((c) => (c.details as any).skipped);
	const checkMap = new Map(report.checks.map((c) => [c.name, c]));
	const proj = report.meta.cwd.split("/").pop() || "project";

	// Radar chart data (SVG)
	const radarChecks = GROUPS.map((g) => {
		const gChecks = g.checks.map((n) => checkMap.get(n)).filter(Boolean) as CheckResult[];
		const scored = gChecks.filter((c) => !(c.details as any).skipped);
		const avg = scored.length > 0 ? Math.round(scored.reduce((s, c) => s + c.score, 0) / scored.length) : 0;
		return { label: g.label, score: avg };
	});
	const radarSvg = buildRadarSVG(radarChecks);

	// Sidebar nav
	let sideHtml = `<a class="sn active" href="#overview" onclick="nav(this)">Overview</a>`;
	for (const g of GROUPS) {
		sideHtml += `<a class="sn" href="#${g.id}" onclick="nav(this)">${g.icon} ${g.label}</a>`;
	}
	sideHtml += `<a class="sn" href="#all-issues" onclick="nav(this)">All Issues (${totalIssues})</a>`;

	// Group sections
	let sections = "";
	for (const g of GROUPS) {
		const gChecks = g.checks.map((n) => checkMap.get(n)).filter(Boolean) as CheckResult[];
		const scored = gChecks.filter((c) => !(c.details as any).skipped);
		const avg = scored.length > 0 ? Math.round(scored.reduce((s, c) => s + c.score, 0) / scored.length) : 0;
		const gColor = gc(avg >= 90 ? "A" : avg >= 75 ? "B" : avg >= 60 ? "C" : avg >= 40 ? "D" : "F");

		sections += `<section id="${g.id}" class="sec" style="display:none">
<div class="sh"><span>${g.icon} ${g.label}</span><span style="color:${gColor};font-weight:800">${avg}/100</span></div>
<div class="bar"><div class="bf" style="width:${avg}%;background:${gColor}"></div></div>
${gChecks.map(checkCard).join("\n")}
</section>`;
	}

	// All issues section
	const allIssues = report.checks.flatMap((c) => c.issues.map((i) => ({ check: c.name, ...i })));
	const errCount = allIssues.filter((i) => i.severity === "error").length;
	const warnCount = allIssues.filter((i) => i.severity === "warning").length;
	const infoCount = allIssues.filter((i) => i.severity === "info").length;

	let issueTableHtml = allIssues.slice(0, 100).map((i) => {
		const loc = i.file ? `${esc(i.file)}${i.line ? ":" + i.line : ""}` : "";
		return `<tr class="${i.severity}"><td class="isev2">${i.severity[0].toUpperCase()}</td><td class="ichk">${esc(i.check)}</td><td>${loc}</td><td>${esc(i.message)}</td><td class="irule2">${esc(i.rule || "")}</td></tr>`;
	}).join("");
	if (allIssues.length > 100) issueTableHtml += `<tr><td colspan="5" style="text-align:center;color:var(--muted)">...${allIssues.length - 100} more issues</td></tr>`;

	// Score breakdown bar chart
	const barChecks = active.sort((a, b) => a.score - b.score);
	const barsHtml = barChecks.map((c) => {
		const color = gc(c.grade);
		return `<div class="brow"><span class="blbl">${esc(c.name)}</span><div class="bbar"><div class="bfill" style="width:${c.score}%;background:${color}"></div></div><span class="bval" style="color:${color}">${c.score}</span></div>`;
	}).join("");

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vibe Check — ${esc(proj)}</title>
<style>
:root{--bg:#09090b;--card:#111115;--border:#1e1e24;--text:#e5e5e5;--muted:#6b7280;--pass:#22c55e;--fail:#ef4444;--warn:#eab308;--info:#6366f1;--accent:#818cf8;--side:220px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Inter",system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.5;display:flex;min-height:100vh}
code{font-family:"SF Mono",Menlo,monospace;font-size:0.85em}

/* Layout */
.sidebar{width:var(--side);position:fixed;top:0;left:0;bottom:0;background:#0c0c0f;border-right:1px solid var(--border);padding:1.2rem 0;overflow-y:auto;z-index:10}
.logo{padding:0 1rem 1rem;font-weight:800;font-size:1.1rem;border-bottom:1px solid var(--border);margin-bottom:0.5rem}
.logo span{color:var(--accent)}
.sn{display:block;padding:0.45rem 1rem;font-size:0.78rem;color:var(--muted);text-decoration:none;border-left:3px solid transparent;transition:all 0.15s}
.sn:hover{color:var(--text);background:#14141a}
.sn.active{color:var(--text);border-left-color:var(--accent);background:#14141a}
.main{margin-left:var(--side);flex:1;padding:2rem;max-width:900px}

/* Top bar */
.topbar{display:flex;align-items:center;gap:1rem;margin-bottom:2rem;padding-bottom:1rem;border-bottom:1px solid var(--border)}
.topbar h1{font-size:1.2rem;flex:1}
.topbar .meta{font-size:0.72rem;color:var(--muted)}
.stack{display:flex;gap:0.35rem;flex-wrap:wrap}
.stack span{background:var(--card);border:1px solid var(--border);padding:0.12rem 0.5rem;border-radius:9999px;font-size:0.65rem;color:var(--muted)}

/* Overview */
.hero{display:flex;gap:2rem;margin-bottom:2rem;align-items:center}
.grade-ring{width:140px;height:140px;position:relative;flex-shrink:0}
.grade-ring svg{width:100%;height:100%}
.grade-big{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.grade-big .g{font-size:3rem;font-weight:900;line-height:1}
.grade-big .s{font-size:0.9rem;font-weight:600}
.grade-big .sub{font-size:0.65rem;color:var(--muted)}
.radar{flex:1;display:flex;justify-content:center}
.radar svg{max-width:260px}

/* Bar chart */
.bars{margin-bottom:2rem}
.brow{display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem;font-size:0.75rem}
.blbl{width:90px;text-align:right;color:var(--muted);flex-shrink:0}
.bbar{flex:1;height:16px;background:var(--card);border-radius:4px;overflow:hidden;border:1px solid var(--border)}
.bfill{height:100%;border-radius:3px;transition:width 0.3s}
.bval{width:28px;font-weight:700;font-size:0.72rem;text-align:right}

/* Sections */
.sec{animation:fadeIn 0.15s}
@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.sh{display:flex;justify-content:space-between;align-items:center;font-size:1rem;font-weight:700;margin-bottom:0.5rem}
.bar{height:4px;background:var(--card);border-radius:2px;margin-bottom:1rem;overflow:hidden}
.bf{height:100%;border-radius:2px}

/* Cards */
.card{background:var(--card);border:1px solid var(--border);border-radius:0.6rem;margin-bottom:0.4rem;overflow:hidden}
.card.sk{opacity:0.4}
.ch{display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem}
.cg{font-size:1.2rem;font-weight:900;width:1.6rem;text-align:center;flex-shrink:0}
.ci{flex:1}
.ci b{font-size:0.82rem;text-transform:capitalize;display:block}
.cs{font-size:0.65rem;color:var(--muted)}
.skip{padding:0 0.75rem 0.3rem 2.8rem;font-size:0.68rem;color:var(--muted);font-style:italic}
.cd{padding:0.15rem 0.75rem 0.3rem 2.8rem;font-size:0.68rem;color:var(--muted);display:flex;gap:0.7rem;flex-wrap:wrap}
.d b{color:var(--text);margin-right:0.15rem}
.ciss{border-top:1px solid var(--border);padding:0.25rem 0.75rem 0.35rem 2.8rem;max-height:260px;overflow-y:auto}
.iss{font-size:0.65rem;font-family:"SF Mono",monospace;padding:0.1rem 0;display:flex;gap:0.35rem;align-items:baseline}
.isev{font-weight:800;font-size:0.55rem;width:0.9rem;text-align:center;border-radius:2px;flex-shrink:0}
.iss.error .isev{color:var(--fail);background:#ef444418}
.iss.warning .isev{color:var(--warn);background:#eab30818}
.iss.info .isev{color:var(--info);background:#6366f118}
.iloc{color:var(--muted);flex-shrink:0}
.imsg{flex:1;word-break:break-word}
.irule{color:#555;font-size:0.55rem}

/* Issue table */
.itbl{width:100%;border-collapse:collapse;font-size:0.7rem}
.itbl th{text-align:left;padding:0.4rem;color:var(--muted);font-size:0.65rem;text-transform:uppercase;border-bottom:1px solid var(--border)}
.itbl td{padding:0.3rem 0.4rem;border-bottom:1px solid var(--border);font-family:"SF Mono",monospace;font-size:0.65rem}
.itbl tr.error td:first-child{color:var(--fail)}
.itbl tr.warning td:first-child{color:var(--warn)}
.itbl tr.info td:first-child{color:var(--info)}
.isev2{font-weight:800;width:1rem}
.ichk{color:var(--muted);width:80px}
.irule2{color:#555;font-size:0.6rem}

.footer{text-align:center;color:var(--muted);font-size:0.6rem;margin-top:2rem;padding-top:0.8rem;border-top:1px solid var(--border)}
.footer a{color:var(--muted)}

/* Mobile */
@media(max-width:700px){.sidebar{display:none}.main{margin-left:0;padding:1rem}}
</style>
</head>
<body>

<aside class="sidebar">
  <div class="logo"><span>vibe</span>-check</div>
  ${sideHtml}
</aside>

<div class="main">
  <div class="topbar">
    <h1>${esc(proj)}</h1>
    <div>
      <div class="meta">${report.timestamp} · ${report.meta.duration}ms · v${report.version}</div>
      <div class="stack">${Object.entries(report.meta.stack).filter(([, v]) => v !== "none" && v !== "unknown").map(([k, v]) => `<span>${k}: <b>${v}</b></span>`).join("")}</div>
    </div>
  </div>

  <section id="overview">
    <div class="hero">
      <div class="grade-ring">
        ${buildRingSVG(report.score, gc(report.grade))}
        <div class="grade-big">
          <span class="g" style="color:${gc(report.grade)}">${report.grade}</span>
          <span class="s" style="color:${gc(report.grade)}">${report.score}/100</span>
          <span class="sub">${active.length} checks · ${totalIssues} issues${skipped.length ? " · " + skipped.length + " skipped" : ""}</span>
        </div>
      </div>
      <div class="radar">${radarSvg}</div>
    </div>

    <div class="bars">${barsHtml}</div>
    <div style="color:var(--muted);font-size:0.7rem;margin-bottom:1rem">${errCount} errors · ${warnCount} warnings · ${infoCount} info</div>
  </section>

  ${sections}

  <section id="all-issues" class="sec" style="display:none">
    <div class="sh"><span>All Issues</span><span style="color:var(--muted);font-size:0.8rem">${totalIssues}</span></div>
    <table class="itbl"><thead><tr><th></th><th>Check</th><th>Location</th><th>Message</th><th>Rule</th></tr></thead><tbody>${issueTableHtml}</tbody></table>
  </section>

  <div class="footer">Generated by <a href="https://github.com/freeappstore-online/vibe-check">vibe-check</a> v${report.version} — code health scanner for the AI coding era</div>
</div>

<script>
function nav(el){document.querySelectorAll('.sn').forEach(n=>n.classList.remove('active'));el.classList.add('active');
document.querySelectorAll('.sec,#overview').forEach(s=>s.style.display='none');
const id=el.getAttribute('href').slice(1);document.getElementById(id).style.display='block';window.scrollTo(0,0);}
</script>
</body></html>`;
}

// ── SVG generators ──

function buildRingSVG(score: number, color: string): string {
	const r = 58;
	const c = 2 * Math.PI * r;
	const offset = c - (score / 100) * c;
	return `<svg viewBox="0 0 140 140"><circle cx="70" cy="70" r="${r}" fill="none" stroke="#1e1e24" stroke-width="8"/><circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="8" stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round" transform="rotate(-90 70 70)" style="transition:stroke-dashoffset 0.5s"/></svg>`;
}

function buildRadarSVG(checks: { label: string; score: number }[]): string {
	const n = checks.length;
	if (n < 3) return "";
	const cx = 130, cy = 130, r = 100;
	const angleStep = (2 * Math.PI) / n;

	// Grid
	let grid = "";
	for (const pct of [25, 50, 75, 100]) {
		const rr = (pct / 100) * r;
		const pts = checks.map((_, i) => {
			const a = i * angleStep - Math.PI / 2;
			return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
		}).join(" ");
		grid += `<polygon points="${pts}" fill="none" stroke="#1e1e24" stroke-width="1"/>`;
	}

	// Axes + labels
	let axes = "";
	for (let i = 0; i < n; i++) {
		const a = i * angleStep - Math.PI / 2;
		const x2 = cx + r * Math.cos(a);
		const y2 = cy + r * Math.sin(a);
		axes += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#1e1e24" stroke-width="1"/>`;
		const lx = cx + (r + 18) * Math.cos(a);
		const ly = cy + (r + 18) * Math.sin(a);
		axes += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="#6b7280" font-size="10">${checks[i].label}</text>`;
	}

	// Data polygon
	const dataPts = checks.map((c, i) => {
		const a = i * angleStep - Math.PI / 2;
		const rr = (c.score / 100) * r;
		return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
	}).join(" ");
	const dataHtml = `<polygon points="${dataPts}" fill="#818cf830" stroke="#818cf8" stroke-width="2"/>`;

	// Score dots
	let dots = "";
	for (let i = 0; i < n; i++) {
		const a = i * angleStep - Math.PI / 2;
		const rr = (checks[i].score / 100) * r;
		dots += `<circle cx="${cx + rr * Math.cos(a)}" cy="${cy + rr * Math.sin(a)}" r="4" fill="#818cf8"/>`;
	}

	return `<svg viewBox="0 0 260 260">${grid}${axes}${dataHtml}${dots}</svg>`;
}
