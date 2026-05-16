# VibeCode QA — TODO

## Done

### CLI (v0.11.0)
- [x] 15 checks across 6 categories (Foundations, Quality, Testing, Architecture, Security, LLM Readiness)
- [x] Auto-detect stack (TS/React/Vite/vitest/Biome/pnpm/npm/yarn/bun)
- [x] Self-contained HTML report — multi-page SPA with hash routing
- [x] Top nav + sidebar navigation
- [x] Sub-tabs for checks within categories
- [x] Radar chart (6-axis category scores)
- [x] Architecture SVG diagram (modules grouped by directory, import edges)
- [x] Code heatmap page (colored density bars per file)
- [x] Bar chart (all checks ranked by score)
- [x] Category score cards on overview
- [x] Trend comparison vs previous run (score delta, new/fixed issues)
- [x] History persistence (.vibe-check/history/, keeps last 30)
- [x] Info panels with What/Risk/Fix for every check (with research citations)
- [x] Priority badges (critical/high/medium/low)
- [x] GitHub file links (auto-detected from git remote)
- [x] Actionable prompts (📋 copy button generates fix prompt for Claude/Codex)
- [x] Issues grouped by file on detail pages
- [x] File map (top 20 files by issue count)
- [x] Watch mode (--watch, re-scans on file changes)
- [x] --skip-tests, --ci, --json flags
- [x] Check metadata with weighted scoring (weights sum to 100, visible in report)
- [x] 33 tests across 6 test files
- [x] Zero runtime dependencies
- [x] Published to npm as @vibecodeqa/cli (auto-deploy via GH Actions)
- [x] README with full documentation
- [x] Confusion Index (novel — naming ambiguity for LLM comprehension)
- [x] Context Locality (novel — file self-containment for LLM consumption)
- [x] Architecture analysis (import graph, circular deps, god modules, orphans)

### Infrastructure
- [x] npm: @vibecodeqa/cli (published, auto-deploys on version bump)
- [x] GitHub org: vibecodeqa
- [x] Landing page: vibecodeqa.online (CF Pages)
- [x] Dashboard app: app.vibecodeqa.online (React SPA, CF Pages)
- [x] Product vision document (~/dev/vibecodeqa/PRODUCT-VISION.md)

## Bugs to fix

- [ ] Architecture SVG doesn't render when there are >40 modules — need to handle large codebases
- [ ] Security check flags innerHTML in the HTML report generator itself (false positive for generated HTML)
- [ ] Standards check flags console.log in test helpers (should exclude .test. files)
- [ ] Duplication check reports false positives for similar import blocks
- [ ] src/runners/tests.ts and src/runners/coverage.ts are unused (replaced by testing.ts) — remove
- [ ] jscpd removed from deps but import might still be referenced somewhere
- [ ] Version hardcoded in CLI — should read from package.json
- [ ] Report says "vibe-check" in some SVG tooltips — should be "vcqa"

## Next features — Free CLI

### High priority
- [ ] Trend sparklines in report (read .vibe-check/history/, render mini line charts)
- [ ] Score timeline chart (last 30 runs, visible on overview page)
- [ ] Error handling check (empty catch blocks, missing React error boundaries, unhandled promises)
- [ ] React-specific checks (hooks rules, conditional hooks, missing keys in .map())
- [ ] Interactive architecture graph (force-directed layout, draggable nodes)
- [ ] Testing pyramid SVG (proportional triangle visualization)

### Medium priority
- [ ] Accessibility check (img alt, button labels, click on div, aria-label)
- [ ] "Vibe Score" readability metric (nesting depth, naming quality, comment ratio, whitespace)
- [ ] AI code smell detection (over-documentation, copy-paste error handling, generic variable density)
- [ ] Config drift detection (inconsistent tsconfig/biome across monorepo packages)
- [ ] Bundle analysis (barrel imports, unused re-exports)
- [ ] Developer experience score (setup steps, .env.example, contributing guide)
- [ ] Coverage gauge cluster (4 arc charts for stmts/branches/lines/fns)
- [ ] PDF export
- [ ] Badge SVG generation for README embedding
- [ ] SARIF output for GitHub Security tab integration

### Low priority
- [ ] Sequence diagrams between modules
- [ ] Light theme option
- [ ] Mobile-responsive sidebar (hamburger menu)
- [ ] Score benchmark comparison ("you're in the 85th percentile")
- [ ] 3D codebase visualization (Three.js)
- [ ] Sunburst chart (category → check → file → issues)

## Next features — PRO (hosted)

### GitHub App
- [ ] Install GitHub App → auto-scan on every PR
- [ ] PR comment with score delta and new issues
- [ ] Quality gate (block merge if score < threshold)
- [ ] GitHub Actions workflow template

### Hosted dashboard
- [ ] GitHub OAuth integration for app.vibecodeqa.online
- [ ] Repo list with scores and grades
- [ ] Score trend charts (line chart, last 30 reports per repo)
- [ ] Per-file trend (was this file getting worse or better?)
- [ ] Version-to-version comparison (tag A vs tag B)
- [ ] Team/org dashboard (aggregate scores across repos)
- [ ] Regression alerts ("repo X dropped 10 pts this week")
- [ ] Slack/Discord notifications

### AI features
- [ ] Agent-powered auto-fix (click "Fix it" → AI creates PR)
- [ ] LLM-powered code review (architecture fitness, stack choice)
- [ ] Product/competition analysis
- [ ] AI-generated fix suggestions per issue
- [ ] Codebase summary generation (auto ARCHITECTURE.md)
- [ ] Custom rules via natural language

### Real-time monitoring
- [ ] Watch mode that updates hosted dashboard live
- [ ] Show code changes in real-time (lines added/removed)
- [ ] Heatmap of recent activity (which files touched most)
- [ ] Coverage of new code (are new changes tested?)

## Refactoring needed

- [ ] Many runners duplicate file-walking logic — migrate all to use fs-utils.ts
- [ ] Remove unused src/runners/tests.ts and src/runners/coverage.ts
- [ ] HTML report generator is 400+ lines — extract SVG builders to separate module
- [ ] Report HTML template has hardcoded styles — extract to CSS template
- [ ] Architecture SVG generator should handle large graphs (clustering, zoom)
- [ ] Clean up `as any` casts in runners (use proper types for CF API responses etc)
