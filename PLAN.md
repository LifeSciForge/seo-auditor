# SEO Auditor — Implementation Plan

## Objective
Build a standalone TypeScript CLI application that performs comprehensive SEO audits on any URL and generates a professional PDF report with AI-powered recommendations via Ollama.

## Files to Create

### Config
- `package.json` — Dependencies (axios, cheerio, playwright, ollama, commander, chalk, ora, p-limit)
- `tsconfig.json` — TypeScript CommonJS config

### Source
- `src/types/index.ts` — All TypeScript interfaces (CheckResult, FetchResult, ParsedPage, AuditReport, AuditOptions)
- `src/utils/crawler.ts` — HTTP fetcher with redirect tracking, SSRF protection, HEAD requests
- `src/utils/html-parser.ts` — Cheerio-based HTML parser extracting all SEO signals
- `src/utils/scorer.ts` — Weighted score aggregation per category and overall

### Checks (each returns CheckResult[])
- `src/checks/technical.ts` — HTTPS, robots.txt, sitemap.xml, canonical, viewport, redirect chain, response time, security headers
- `src/checks/on-page.ts` — Title tag, meta description, H1 structure, image alt text, URL length, schema markup
- `src/checks/content.ts` — Word count, Flesch-Kincaid readability, content freshness
- `src/checks/links.ts` — Broken internal links (HEAD requests), broken external links, anchor text quality
- `src/checks/accessibility.ts` — HTML lang attribute, form labels, ARIA landmarks, skip links
- `src/checks/performance.ts` — Response time, image formats, caching headers, page size
- `src/checks/index.ts` — Re-exports all check runners

### AI
- `src/ai/ollama-client.ts` — Ollama integration, generates prioritized recommendations from audit results

### Report
- `src/report/html-template.ts` — Full HTML/CSS report template with inline SVG charts (no external deps)
- `src/report/pdf-generator.ts` — Playwright-based PDF generation from HTML template

### Entrypoints
- `src/auditor.ts` — Main orchestrator: fetch → parse → run checks → score → AI → report
- `src/index.ts` — Commander.js CLI, accepts multiple URLs, shows progress with ora

## Check Output Format
Every check returns this consistent shape:
```json
{
  "checkId": "title-tag-length",
  "name": "Title Tag Length",
  "category": "on-page-seo",
  "severity": "high|medium|low",
  "status": "pass|fail|warning",
  "currentValue": "actual value found",
  "recommendedValue": "what it should be",
  "affectedElements": ["<title>Old Title</title>"],
  "explanation": "human-readable explanation",
  "impactScore": 8,
  "effortScore": 2
}
```

## Scoring Weights
- Technical SEO: 25%
- On-Page SEO: 25%
- Content Quality: 20%
- Link Profile: 10%
- Accessibility: 10%
- Performance: 10%

## CLI Usage
```
seo-audit --url https://example.com
seo-audit --url https://site1.com --url https://site2.com --output ./report.pdf
seo-audit --url https://example.com --model llama3.2 --skip-ai
```

## Tests (after each change)
- `ts-node src/index.ts --url https://example.com --skip-ai` (quick smoke test)
- Verify PDF output exists and is non-empty
- Verify JSON structure of checks output

## Rollback Notes
- Each check module is independent; revert individual files if a check breaks
- Ollama is optional (--skip-ai flag) so AI failures never block report generation
