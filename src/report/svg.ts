/** SVG builders for the HTML report (score ring, radar chart). */

export function buildRing(score: number, color: string): string {
	const r = 42;
	const c = 2 * Math.PI * r;
	const off = c - (score / 100) * c;
	return `<svg viewBox="0 0 100 100" style="width:100px;height:100px"><circle cx="50" cy="50" r="${r}" fill="none" stroke="#1e1e24" stroke-width="7"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-dasharray="${c}" stroke-dashoffset="${off}" stroke-linecap="round" transform="rotate(-90 50 50)"/></svg>`;
}

export function buildRadar(items: { label: string; score: number }[]): string {
	const n = items.length;
	if (n < 3) return "";
	const cx = 120,
		cy = 120,
		r = 90;
	const step = (2 * Math.PI) / n;
	let grid = "";
	for (const pct of [25, 50, 75, 100]) {
		const rr = (pct / 100) * r;
		const pts = items
			.map((_, i) => `${cx + rr * Math.cos(i * step - Math.PI / 2)},${cy + rr * Math.sin(i * step - Math.PI / 2)}`)
			.join(" ");
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
	const dataPts = items
		.map((c, i) => {
			const a = i * step - Math.PI / 2;
			const rr = (c.score / 100) * r;
			return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
		})
		.join(" ");
	let dots = "";
	for (let i = 0; i < n; i++) {
		const a = i * step - Math.PI / 2;
		const rr = (items[i].score / 100) * r;
		dots += `<circle cx="${cx + rr * Math.cos(a)}" cy="${cy + rr * Math.sin(a)}" r="3.5" fill="#818cf8"/>`;
	}
	return `<svg viewBox="0 0 240 240">${grid}${axes}<polygon points="${dataPts}" fill="#818cf825" stroke="#818cf8" stroke-width="1.5"/>${dots}</svg>`;
}

/** Sparkline — mini line chart for trend display. */
export function buildSparkline(values: number[], opts?: { width?: number; height?: number; color?: string }): string {
	const width = opts?.width ?? 120;
	const height = opts?.height ?? 30;
	const color = opts?.color ?? "#818cf8";
	if (values.length === 0) return "";
	if (values.length === 1) {
		const y = (height / 2).toFixed(1);
		return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><polyline points="${(width / 2).toFixed(1)},${y}" fill="none" stroke="${color}" stroke-width="1.5"/><circle cx="${(width / 2).toFixed(1)}" cy="${y}" r="1.5" fill="${color}"/></svg>`;
	}
	const max = Math.max(...values, 1);
	const min = Math.min(...values, 0);
	const range = max - min || 1;
	const step = width / (values.length - 1);

	const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * (height - 4) - 2).toFixed(1)}`).join(" ");

	const dots = values.map((v, i) => {
		const x = (i * step).toFixed(1);
		const y = (height - ((v - min) / range) * (height - 4) - 2).toFixed(1);
		return `<circle cx="${x}" cy="${y}" r="1.5" fill="${color}"/>`;
	}).join("");

	return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>${dots}</svg>`;
}
