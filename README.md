# VibeCode QA

**Code health scanner for the AI coding era.**

One command. 15 checks. Full report. Zero config.

```bash
npx @vibecodeqa/cli
```

![Grade](https://img.shields.io/badge/checks-15-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-first-3178C6) ![License](https://img.shields.io/badge/license-MIT-green)

## What it does

vcqa scans your TypeScript/JavaScript codebase and produces a scored health report with actionable findings. It auto-detects your stack (React, Vite, vitest, Biome, etc.) and runs 15 checks across 6 categories.

The output is a self-contained HTML report with radar charts, architecture diagrams, file heatmaps, and drill-down issue lists — all navigable via sidebar and tab navigation.

## Quick start

```bash
# Scan current directory (runs tests + coverage)
npx @vibecodeqa/cli

# Fast mode (skip test execution)
npx @vibecodeqa/cli --skip-tests

# Watch mode (re-scan on file changes)
npx @vibecodeqa/cli --watch

# CI mode (exit code 1 if score < 60)
npx @vibecodeqa/cli --ci

# JSON output (pipe to other tools)
npx @vibecodeqa/cli --json

# Scan a specific directory
npx @vibecodeqa/cli /path/to/project
```

Output goes to `.vibe-check/`:
- `report.html` — navigable multi-page dashboard (open in browser)
- `report.json` — machine-readable results
- `history/` — last 30 reports for trend tracking

## Checks

### Foundations (23%)

| Check | Weight | What it measures |
|-------|--------|-----------------|
| **Structure** | 6% | Standard files (package.json, tsconfig, LICENSE, README, .gitignore), lockfile, test-to-source ratio |
| **Lint** | 5% | Biome or ESLint errors/warnings (auto-detected) |
| **Types** | 6% | TypeScript compilation errors (`tsc --noEmit`) |
| **Type Safety** | 3% | `as any`, `: any`, `@ts-ignore`, `@ts-nocheck` counts |
| **Standards** | 3% | File naming, large files (>300 lines), code smells (console.log, var, ==, eval, innerHTML), config hygiene |

### Quality (15%)

| Check | Weight | What it measures |
|-------|--------|-----------------|
| **Complexity** | 7% | Cognitive complexity per function, functions >60 lines |
| **Duplication** | 5% | Copy-pasted 6+ line blocks |
| **Docs** | 3% | README quality, JSDoc coverage of exports |

### Testing (22%)

One deep check with 6 sub-dimensions:

- **Pyramid presence** — unit, integration, component, E2E layers detected
- **Execution** — pass/fail from vitest/jest
- **Coverage** — statement, branch, line, function (v8/istanbul)
- **File pairing** — test file per source file
- **Quality** — assertion density, mock ratio, snapshot ratio
- **E2E detection** — Playwright/Cypress configured?

### Architecture (7%)

| Check | Weight | What it measures |
|-------|--------|-----------------|
| **Architecture** | 7% | Import graph, circular deps, god modules, orphan files, fan-out, SVG diagram |

### Security (18%)

| Check | Weight | What it measures |
|-------|--------|-----------------|
| **Secrets** | 6% | 13 patterns (AWS, GitHub, Stripe, OpenAI, private keys) |
| **Security** | 7% | 15 CWE-mapped patterns (XSS, injection, crypto, SSRF) |
| **Dependencies** | 5% | npm audit vulnerabilities + outdated packages |

### LLM Readiness (15%)

Novel checks that no other tool offers:

| Check | Weight | What it measures |
|-------|--------|-----------------|
| **Confusion Index** | 8% | File name similarity, generic names, export collisions, ambiguous abbreviations |
| **Context Locality** | 7% | Token density, import depth, circular deps, context sinks |

**Research backing:**
- "When Names Disappear" (arXiv:2510.03178): GPT-4o drops 28.6% on summarization with ambiguous names
- "Lost in the Middle" (Liu et al. 2023): 30%+ accuracy drop for mid-context information
- "Context Rot" (Chroma 2025): all frontier models degrade with input length
- "Variable Naming Impact" (Research Square 2024): descriptive names = 8.9% better AI performance

## Scoring

Each check produces a score from 0-100. The composite score is a weighted average (weights shown above, sum to 100%). Grades:

| Grade | Score | Meaning |
|-------|-------|---------|
| **A** | 90-100 | Excellent — production-ready |
| **B** | 75-89 | Good — minor issues |
| **C** | 60-74 | Fair — needs attention |
| **D** | 40-59 | Poor — significant issues |
| **F** | 0-39 | Critical — major problems |

## Report features

The report is a multi-page navigable dashboard:

- **10 pages**: Overview, Foundations, Quality, Testing, Architecture, Security, LLM Readiness, Issues, File Map, Heatmap
- **Top nav + sidebar** — navigate by category and check
- **Radar chart** — 6-axis view of category scores
- **Architecture SVG diagram** — modules grouped by directory, import edges, node size by fan-in
- **Code heatmap** — colored bars showing issue density per file
- **Trend comparison** — score delta vs. previous run (reads previous report.json)
- **File map** — top files by issue count across all checks
- **GitHub links** — click any file:line to open in GitHub (auto-detected from git remote)
- **Actionable prompts** — 📋 button on every issue copies a fix prompt for Claude/Codex
- **Info panels** — each check has What/Risk/Fix explanations with research citations
- **Priority badges** — critical/high/medium/low on each check

## Trend tracking

vcqa reads the previous `.vibe-check/report.json` on each run and shows:
- Score change (↑ improved / ↓ declined)
- Per-check deltas
- New vs. fixed issue counts

## CLI options

| Flag | Description |
|------|-------------|
| `--skip-tests` | Skip test execution and coverage (fast mode) |
| `--watch` | Re-scan automatically on file changes |
| `--ci` | Exit code 1 if composite score < 60 |
| `--json` | Output JSON to stdout (no HTML, no browser) |

## Stack detection

Auto-detects from `package.json` and config files:
- **Language:** TypeScript, JavaScript
- **Framework:** React, Vue, Svelte
- **Bundler:** Vite, Webpack, esbuild
- **Test runner:** vitest, jest
- **Linter:** Biome, ESLint
- **Package manager:** pnpm, npm, yarn, bun

## References

Standards and research cited in vibe-check's analysis:

- ISO/IEC 25010:2023 — Software product quality model
- McCabe, T.J. "A Complexity Measure" (IEEE, 1976) — Cyclomatic complexity
- Campbell, G.A. "Cognitive Complexity" (SonarSource, 2017) — Understandability metric
- Martin, R.C. "Clean Code" (2008) — Naming principles
- OWASP Top 10 — Web application security risks
- CWE Top 25 — Most dangerous software weaknesses
- Liu et al. "Lost in the Middle" (TACL, 2023) — LLM context attention
- Chroma Research "Context Rot" (2025) — LLM degradation with input length
- Wang et al. "How Does Naming Affect LLMs?" (JSEA, 2024) — Naming impact on AI
- arXiv:2510.03178 "When Names Disappear" (2025) — 28.6% accuracy drop
- Arnaoudova et al. "Linguistic Antipatterns" — 17-pattern naming catalog
- Vassilev "Codified Context" (arXiv, 2025) — AI agent context architecture

## License

MIT — Free forever as a CLI tool.

## Links

- **GitHub:** https://github.com/freeappstore-online/vibe-check
- **Website:** https://vibecodeqa.online
- **Issues:** https://github.com/freeappstore-online/vibe-check/issues
