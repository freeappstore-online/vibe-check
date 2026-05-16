/** Architecture analysis — import graph, circular deps, coupling metrics, god modules.
 *
 * Produces:
 *   1. Import graph (adjacency list)
 *   2. Circular dependency detection
 *   3. Fan-in / fan-out metrics per file (coupling)
 *   4. God modules (imported by >50% of files)
 *   5. Orphan files (not imported by anyone, not an entrypoint)
 *   6. Layer violations (optional: detect cross-layer imports)
 *   7. SVG architecture diagram
 */

import { basename, dirname, extname } from "node:path";
import { getProductionFiles, type SourceFile } from "../fs-utils.js";
import type { CheckResult, Issue } from "../types.js";
import { gradeFromScore } from "../types.js";

interface ModuleNode {
	path: string;
	imports: string[]; // resolved relative paths
	importedBy: string[]; // reverse edges
	dir: string; // directory (for grouping)
	exports: number;
}

export interface ArchGraph {
	nodes: Map<string, ModuleNode>;
	cycles: string[][];
	godModules: string[];
	orphans: string[];
}

export function runArchitecture(cwd: string): CheckResult {
	const start = Date.now();
	const issues: Issue[] = [];
	const files = getProductionFiles(cwd);

	if (files.length < 2) {
		return {
			name: "architecture",
			score: 100,
			grade: "A",
			details: { skipped: true, reason: "fewer than 2 source files" },
			issues: [],
			duration: Date.now() - start,
		};
	}

	const graph = buildGraph(files);

	// ── Circular dependencies ──
	const cycles = findCycles(graph.nodes);
	for (const cycle of cycles.slice(0, 5)) {
		issues.push({ severity: "error", message: `Circular: ${cycle.map(short).join(" → ")}`, rule: "circular-dep" });
	}
	if (cycles.length > 5) {
		issues.push({ severity: "error", message: `...and ${cycles.length - 5} more cycles`, rule: "circular-dep" });
	}

	// ── God modules (imported by >50% of files) ──
	const threshold = Math.max(3, Math.floor(files.length * 0.5));
	const godModules: string[] = [];
	for (const [path, node] of graph.nodes) {
		if (node.importedBy.length >= threshold) {
			godModules.push(path);
			issues.push({
				severity: "warning",
				message: `God module: imported by ${node.importedBy.length}/${files.length} files — consider splitting`,
				file: path,
				rule: "god-module",
			});
		}
	}

	// ── Orphan files (not imported by anyone) ──
	const entrypoints = new Set(["index.ts", "index.tsx", "main.ts", "main.tsx", "cli.ts", "App.tsx", "App.ts"]);
	const orphans: string[] = [];
	for (const [path, node] of graph.nodes) {
		const isEntry = entrypoints.has(basename(path));
		if (node.importedBy.length === 0 && !isEntry) {
			orphans.push(path);
			issues.push({ severity: "warning", message: `Orphan: not imported by any file (dead module?)`, file: path, rule: "orphan-module" });
		}
	}

	// ── High fan-out (file imports too many modules) ──
	let highFanOut = 0;
	for (const [path, node] of graph.nodes) {
		if (node.imports.length > 10) {
			highFanOut++;
			issues.push({
				severity: "warning",
				message: `High fan-out: imports ${node.imports.length} modules — hard to test in isolation`,
				file: path,
				rule: "high-fan-out",
			});
		}
	}

	// ── High fan-in + fan-out (connector files) ──
	let connectors = 0;
	for (const [path, node] of graph.nodes) {
		if (node.imports.length > 5 && node.importedBy.length > 5) {
			connectors++;
			issues.push({
				severity: "warning",
				message: `Connector: ${node.imports.length} imports, ${node.importedBy.length} importers — high coupling`,
				file: path,
				rule: "connector-module",
			});
		}
	}

	// ── Score ──
	const penalty = cycles.length * 15 + godModules.length * 5 + orphans.length * 2 + highFanOut * 3 + connectors * 4;
	const score = Math.max(0, Math.min(100, 100 - penalty));

	// ── Build details with graph data for visualization ──
	const graphData: Record<string, { imports: string[]; importedBy: string[]; dir: string }> = {};
	for (const [path, node] of graph.nodes) {
		graphData[path] = { imports: node.imports, importedBy: node.importedBy, dir: node.dir };
	}

	return {
		name: "architecture",
		score,
		grade: gradeFromScore(score),
		details: {
			totalModules: graph.nodes.size,
			circularDeps: cycles.length,
			godModules: godModules.length,
			orphans: orphans.length,
			highFanOut,
			connectors,
			graph: graphData,
		},
		issues,
		duration: Date.now() - start,
	};
}

// ── Graph building ──

function buildGraph(files: SourceFile[]): { nodes: Map<string, ModuleNode> } {
	const filePaths = new Set(files.map((f) => f.path));
	const nodes = new Map<string, ModuleNode>();

	// Initialize nodes
	for (const f of files) {
		nodes.set(f.path, {
			path: f.path,
			imports: [],
			importedBy: [],
			dir: dirname(f.path),
			exports: (f.content.match(/\bexport\s+/g) || []).length,
		});
	}

	// Parse imports and build edges
	for (const f of files) {
		const imports = parseImports(f.content);
		const node = nodes.get(f.path)!;

		for (const imp of imports) {
			const resolved = resolveImport(f.path, imp, filePaths);
			if (resolved && resolved !== f.path) {
				node.imports.push(resolved);
				const target = nodes.get(resolved);
				if (target) target.importedBy.push(f.path);
			}
		}
	}

	return { nodes };
}

function parseImports(content: string): string[] {
	const imports: string[] = [];
	const regex = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
	let match;
	while ((match = regex.exec(content)) !== null) {
		if (match[1].startsWith(".")) imports.push(match[1]);
	}
	return imports;
}

function resolveImport(fromPath: string, importPath: string, knownFiles: Set<string>): string | null {
	const fromDir = dirname(fromPath);
	let resolved = importPath;

	if (importPath.startsWith("./")) {
		resolved = fromDir ? `${fromDir}/${importPath.slice(2)}` : importPath.slice(2);
	} else if (importPath.startsWith("../")) {
		const parts = fromDir.split("/");
		let imp = importPath;
		while (imp.startsWith("../")) {
			parts.pop();
			imp = imp.slice(3);
		}
		resolved = [...parts, imp].filter(Boolean).join("/");
	}

	// Strip .js/.ts extension
	resolved = resolved.replace(/\.(js|ts|tsx|jsx)$/, "");

	// Try known extensions
	for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
		if (knownFiles.has(resolved + ext)) return resolved + ext;
	}
	// Try index
	for (const ext of [".ts", ".tsx"]) {
		if (knownFiles.has(`${resolved}/index${ext}`)) return `${resolved}/index${ext}`;
	}
	return null;
}

// ── Cycle detection (DFS with path tracking) ──

function findCycles(nodes: Map<string, ModuleNode>): string[][] {
	const cycles: string[][] = [];
	const visited = new Set<string>();
	const inStack = new Set<string>();
	const path: string[] = [];
	const seen = new Set<string>(); // dedup cycles

	function dfs(node: string): void {
		if (inStack.has(node)) {
			const cycleStart = path.indexOf(node);
			if (cycleStart >= 0) {
				const cycle = path.slice(cycleStart).map(short);
				const key = [...cycle].sort().join(",");
				if (!seen.has(key)) {
					seen.add(key);
					cycles.push([...cycle, short(node)]);
				}
			}
			return;
		}
		if (visited.has(node)) return;

		visited.add(node);
		inStack.add(node);
		path.push(node);

		const n = nodes.get(node);
		if (n) {
			for (const dep of n.imports) {
				dfs(dep);
			}
		}

		path.pop();
		inStack.delete(node);
	}

	for (const node of nodes.keys()) {
		dfs(node);
	}

	return cycles;
}

function short(path: string): string {
	return basename(path, extname(path));
}

// ── SVG Architecture Diagram ──

export function generateArchSVG(details: Record<string, unknown>): string {
	const graph = details.graph as Record<string, { imports: string[]; importedBy: string[]; dir: string }> | undefined;
	if (!graph || Object.keys(graph).length === 0) return "";

	const nodes = Object.entries(graph);
	const nodeCount = nodes.length;
	if (nodeCount > 40) return ""; // too many nodes to render meaningfully

	// Group by directory
	const dirs = new Map<string, string[]>();
	for (const [path, info] of nodes) {
		const dir = info.dir || ".";
		const arr = dirs.get(dir) || [];
		arr.push(path);
		dirs.set(dir, arr);
	}

	const W = 800,
		padding = 40;
	const dirEntries = [...dirs.entries()];
	const dirWidth = (W - padding * 2) / Math.max(dirEntries.length, 1);

	// Position nodes
	const positions = new Map<string, { x: number; y: number }>();
	let dirIdx = 0;
	for (const [_d, paths] of dirEntries) {
		const x0 = padding + dirIdx * dirWidth + dirWidth / 2;
		for (let i = 0; i < paths.length; i++) {
			const y = padding + 50 + i * 35;
			positions.set(paths[i], { x: x0, y });
		}
		dirIdx++;
	}

	const H = Math.max(300, padding * 2 + 50 + Math.max(...[...dirs.values()].map((p) => p.length)) * 35 + 20);

	// Draw edges
	let edges = "";
	for (const [path, info] of nodes) {
		const from = positions.get(path);
		if (!from) continue;
		for (const imp of info.imports) {
			const to = positions.get(imp);
			if (!to) continue;
			const color = info.dir !== graph[imp]?.dir ? "#ef444440" : "#818cf825";
			edges += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${color}" stroke-width="1.5"/>`;
		}
	}

	// Draw directory groups
	let groups = "";
	dirIdx = 0;
	for (const [dName, paths] of dirEntries) {
		const x = padding + dirIdx * dirWidth;
		const h = paths.length * 35 + 20;
		groups += `<rect x="${x + 5}" y="${padding + 30}" width="${dirWidth - 10}" height="${h}" rx="8" fill="#14141a" stroke="#23232a"/>`;
		groups += `<text x="${x + dirWidth / 2}" y="${padding + 22}" text-anchor="middle" fill="#6b7280" font-size="10" font-weight="600">${dName === "." ? "root" : dName.split("/").pop()}</text>`;
		dirIdx++;
	}

	// Draw nodes
	let nodesSvg = "";
	for (const [path] of nodes) {
		const pos = positions.get(path);
		if (!pos) continue;
		const name = basename(path, extname(path));
		const info = graph[path];
		const fanIn = info.importedBy.length;
		const size = Math.min(8, 3 + fanIn);
		nodesSvg += `<circle cx="${pos.x}" cy="${pos.y}" r="${size}" fill="#818cf8"/>`;
		nodesSvg += `<text x="${pos.x + size + 4}" y="${pos.y + 3}" fill="#e5e5e5" font-size="9">${name}</text>`;
	}

	return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;background:#09090b;border-radius:8px;border:1px solid #1e1e24">${groups}${edges}${nodesSvg}</svg>`;
}
