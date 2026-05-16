/** SVG sparkline builder — simple polyline with dots. */

export interface SparklineOptions {
	width?: number;
	height?: number;
	color?: string;
	dotRadius?: number;
}

/** Build an inline SVG sparkline from an array of values (0-100). */
export function buildSparkline(values: number[], opts: SparklineOptions = {}): string {
	if (values.length === 0) return "";
	const w = opts.width ?? 120;
	const h = opts.height ?? 30;
	const color = opts.color ?? "#818cf8";
	const dotR = opts.dotRadius ?? 2;

	const padX = dotR + 1;
	const padY = dotR + 1;
	const plotW = w - padX * 2;
	const plotH = h - padY * 2;

	// Map values to SVG coordinates
	const points = values.map((v, i) => {
		const x = values.length === 1 ? w / 2 : padX + (i / (values.length - 1)) * plotW;
		const y = padY + plotH - (Math.min(100, Math.max(0, v)) / 100) * plotH;
		return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
	});

	const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
	const dots = points.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="${dotR}" fill="${color}"/>`).join("");

	return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:block"><polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg>`;
}
