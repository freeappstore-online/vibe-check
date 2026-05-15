# vibe-check — TODO

## Done (v0.8.0)

- [x] 15 checks across 6 categories
- [x] Auto-detect stack (TS/React/Vite/vitest/Biome/pnpm)
- [x] Self-contained HTML report with sidebar + top nav + sub-tabs
- [x] Radar chart (6-axis category scores)
- [x] Architecture SVG diagram (modules + import edges)
- [x] Bar chart (all checks ranked by score)
- [x] Category score cards on overview
- [x] Trend comparison vs previous run (score delta, new/fixed issues)
- [x] Info panels with What/Risk/Fix for every check
- [x] Priority badges (critical/high/medium/low)
- [x] GitHub file links (clickable file:line → repo)
- [x] Issues grouped by file on detail pages
- [x] File heatmap (top 20 files by issue count)
- [x] 33 tests across 6 test files
- [x] Check metadata with research citations
- [x] Weighted scoring (weights sum to 100, visible in report)
- [x] --skip-tests, --ci, --json flags
- [x] README with full documentation

## Not done yet — Report & UX

- [ ] Sidebar shows different content per page (contextual)
- [ ] Testing pyramid SVG visualization (proportional triangle)
- [ ] Issue treemap (file size × severity color, squarified algorithm)
- [ ] Coverage gauge cluster (4 arc charts: stmts, branches, lines, fns)
- [ ] Score benchmark comparison ("you're in the 85th percentile")
- [ ] PDF export
- [ ] Badge SVG generation for README embedding
- [ ] Sequence diagrams between modules
- [ ] Light theme option
- [ ] Mobile-responsive sidebar (hamburger menu)

## Not done yet — Checks

- [ ] Error handling check (empty catch, missing React error boundaries, unhandled promises)
- [ ] React-specific checks (hooks rules, a11y, conditional hooks, missing keys)
- [ ] Accessibility check (img alt, button labels, click on div, aria-label)
- [ ] "Vibe Score" readability metric (nesting depth, naming quality, comment ratio, whitespace)
- [ ] AI code smell detection (over-documentation, copy-paste error handling, generic variable density)
- [ ] Config drift detection (inconsistent tsconfig/biome across monorepo packages)
- [ ] Bundle/build analysis (barrel imports, unused re-exports)
- [ ] Developer experience score (setup steps, .env.example, contributing guide)

## Not done yet — Infrastructure

- [ ] npm publish (`npx vibe-check` zero-install)
- [ ] GitHub App (run on PR, post comment with score delta)
- [ ] Hosted dashboard (CF Pages/Workers, trend charts over time)
- [ ] SARIF output (GitHub Security tab integration)
- [ ] GitHub Actions workflow template
- [ ] Move repo to vibechecker-online org
- [ ] Website at vibechecker.online (landing page + docs)
- [ ] Pricing page (free CLI / Team $12/mo / Org $29/mo)

## Not done yet — History & Trends (PRO)

- [ ] Persist report history (last N reports in .vibe-check/history/)
- [ ] Sparkline per check showing trend over time
- [ ] Score timeline chart (line chart, last 30 reports)
- [ ] Regression detection ("lint dropped 10 pts since last week")
- [ ] Per-file trend (was this file getting worse or better?)
- [ ] Version-to-version comparison (tag A vs tag B)
- [ ] Team dashboard (aggregate scores across repos)

## Not done yet — LLM Assessment (PRO)

- [ ] LLM-powered code review (architecture fitness, stack choice, patterns)
- [ ] Product/competition analysis
- [ ] AI-generated fix suggestions per issue
- [ ] Codebase summary (auto-generated, like ARCHITECTURE.md)
- [ ] Custom rules via natural language ("flag any function that calls fetch without error handling")

## Not done yet — Visualization (ambitious)

- [ ] 3D codebase visualization (Three.js — files as buildings, height = lines, color = score)
- [ ] Dependency graph force layout (interactive, draggable nodes)
- [ ] Sunburst chart (category → check → file → issues)
- [ ] Animated score ring on load
- [ ] Comparison mode (side-by-side two reports)

## Refactoring needed

- [ ] Runners still have duplicate `collectFiles` — migrate all to use fs-utils.ts
- [ ] coverage.ts and tests.ts runners are unused (replaced by testing.ts) — remove
- [ ] HTML report generator is 400+ lines — extract SVG builders to separate module
- [ ] Version in CLI is hardcoded "0.2.0" — should read from package.json
- [ ] jscpd is in dependencies but unused — remove or integrate
