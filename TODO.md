# VibeCode QA — TODO

## Done

### CLI (v0.18.0 — current)

**25 checks across 7 categories:**
- Foundations (21%): Structure, Lint, Type Check, Type Safety, Code Standards
- Quality (29%): Complexity, Duplication, Error Handling, React Patterns, Accessibility, Performance, iOS Safe Area, PWA Manifest, Meta Tags, Docs
- Testing (17%): Testing (6 sub-dimensions: pyramid, execution, coverage, pairing, quality, E2E)
- Security (17%): Secrets, Security Patterns, Dependencies
- Architecture (5%): Architecture (import graph + SVG diagram)
- LLM Readiness (11%): Confusion Index, Context Locality
- AI Analysis (premium, weight 0): Doc Coherence, Code Coherence

**Reporting & infrastructure:**
- [x] Self-contained HTML report — multi-page SPA with hash routing
- [x] Top nav + sidebar navigation, sub-tabs per check
- [x] Radar chart, architecture SVG diagram, code heatmap, score timeline
- [x] Category score cards, bar chart, file map (top 20 files by issue count)
- [x] Trend comparison vs previous run (score delta, new/fixed issues)
- [x] History persistence (.vibe-check/history/, last 30)
- [x] Info panels with What/Risk/Fix for every check + research citations
- [x] Priority badges (critical/high/medium/low)
- [x] GitHub file links (auto-detected from git remote)
- [x] Actionable copy-prompt buttons per issue (for Claude/Codex)
- [x] Watch mode (`--watch`), `--skip-tests`, `--ci`, `--json`, `--badge` flags
- [x] Auto-detect stack (TS/React/Vite/vitest/Biome/pnpm/npm/yarn/bun)
- [x] Check metadata with weighted scoring (weights sum to 100)
- [x] 246 tests across 28 test files
- [x] Zero runtime dependencies
- [x] Published to npm as @vibecodeqa/cli (auto-deploys on version bump)
- [x] README with full documentation
- [x] All runners use shared `fs-utils.ts` (symlink protection, 1MB limit, consistent skip-dirs)

### Infrastructure
- [x] npm: @vibecodeqa/cli
- [x] GitHub org: vibecodeqa
- [x] Landing page: vibecodeqa.online (CF Pages)
- [x] Dashboard app: app.vibecodeqa.online (React SPA, CF Pages)
- [x] Product vision document (~/dev/vibecodeqa/PRODUCT-VISION.md)

## Bugs to fix

- [ ] Architecture SVG has fallback for >50 modules (renders a message) — could be smarter (clustering, zoom)
- [ ] Duplication check can report many overlapping pairs for the same logical duplicate (e.g. 7 issues for one repeated block)
- [ ] Report says "vibe-check" in some SVG tooltips — should be "vcqa"

## Next features — Free CLI

### High priority
- [ ] Bundle size check (read `dist/` after build, warn on >500KB total or >250KB single chunk)
- [ ] Service worker check (detect SW registration, offline capability)
- [ ] Dead exports check (find `export`s nothing imports — complementary to architecture's orphan-module)
- [ ] Interactive architecture graph (force-directed layout, draggable nodes)
- [ ] Testing pyramid SVG (proportional triangle visualization)

### Medium priority
- [ ] "Vibe Score" readability metric (nesting depth, naming quality, comment ratio, whitespace)
- [ ] AI code smell detection (over-documentation, copy-paste error handling, generic variable density)
- [ ] Config drift detection (inconsistent tsconfig/biome across monorepo packages)
- [ ] Bundle analysis (barrel imports, unused re-exports)
- [ ] Developer experience score (setup steps, .env.example, contributing guide)
- [ ] Coverage gauge cluster (4 arc charts for stmts/branches/lines/fns)
- [ ] PDF export
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
- [ ] Doc Coherence (currently placeholder — needs LLM integration)
- [ ] Code Coherence (currently placeholder — needs LLM integration)

### Real-time monitoring
- [ ] Watch mode that updates hosted dashboard live
- [ ] Show code changes in real-time (lines added/removed)
- [ ] Heatmap of recent activity (which files touched most)
- [ ] Coverage of new code (are new changes tested?)

## Refactoring needed

- [ ] HTML report generator is 400+ lines — extract SVG builders to separate module (partially done — svg.ts exists)
- [ ] Report HTML template has hardcoded styles — extract to CSS template
- [ ] Architecture SVG generator should handle large graphs (clustering, zoom)
- [ ] Clean up `as any` casts in runners (use proper types for CF API responses etc)
