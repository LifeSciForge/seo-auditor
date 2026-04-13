import { AuditReport, AuditOptions } from './types';
import { fetchPage, normalizeUrl } from './utils/crawler';
import { parseHtml } from './utils/html-parser';
import {
  calculateCategoryScores,
  calculateOverallScore,
  summarize,
} from './utils/scorer';
import {
  runTechnicalChecks,
  runOnPageChecks,
  runContentChecks,
  runLinkChecks,
  runAccessibilityChecks,
  runPerformanceChecks,
  runAEOChecks,
  runGEOChecks,
  calculateGEOScore,
} from './checks';
import { generateRecommendations } from './ai/ollama-client';
import { generatePhasedRoadmap } from './recommendations/phased-roadmap';

export async function auditUrl(
  rawUrl: string,
  options: AuditOptions,
  onProgress?: (step: string) => void
): Promise<AuditReport> {
  const startTime = Date.now();
  const url = normalizeUrl(rawUrl);
  const industry = options.industry || 'generic';

  const progress = (msg: string) => onProgress && onProgress(msg);

  // ── 1. Fetch the page ───────────────────────────────────────────────────────
  progress('Fetching page...');
  const fetchResult = await fetchPage(url, options.timeout);

  if (fetchResult.error && !fetchResult.html) {
    const dummy: AuditReport = {
      url,
      domain: new URL(url).hostname,
      auditedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      overallScore: 0,
      aeoScore: 0,
      geoScore: null,
      industry,
      categoryScores: [],
      checks: [],
      summary: { high: 0, medium: 0, low: 0, passed: 0, warnings: 0 },
      technicalDetails: {
        statusCode: 0,
        responseTimeMs: fetchResult.responseTimeMs,
        redirectChain: fetchResult.redirectChain,
        isHttps: url.startsWith('https://'),
        pageSize: 0,
        headers: {},
      },
      aiRecommendations: '',
      topIssues: [],
      quickWins: [],
      roadmap: [],
    };
    return dummy;
  }

  // ── 2. Parse HTML ───────────────────────────────────────────────────────────
  progress('Parsing HTML...');
  const parsed = parseHtml(fetchResult.html, fetchResult.finalUrl || url);

  // ── 3. Run all checks in parallel ──────────────────────────────────────────
  progress('Running SEO checks...');
  const [
    technicalChecks,
    onPageChecks,
    contentChecks,
    accessibilityChecks,
    performanceChecks,
    aeoChecks,
    geoChecks,
  ] = await Promise.all([
    runTechnicalChecks(url, fetchResult, parsed),
    Promise.resolve(runOnPageChecks(parsed)),
    Promise.resolve(runContentChecks(parsed)),
    Promise.resolve(runAccessibilityChecks(parsed)),
    Promise.resolve(runPerformanceChecks(fetchResult, parsed)),
    Promise.resolve(runAEOChecks(url, fetchResult, parsed)),
    Promise.resolve(runGEOChecks(url, fetchResult, parsed)),
  ]);

  // ── 4. Link checks (requires HTTP requests) ─────────────────────────────────
  progress(`Checking links (up to ${options.maxLinksToCheck})...`);
  const linkChecks = await runLinkChecks(
    url, parsed, options.maxLinksToCheck, options.checkExternalLinks, options.timeout
  );

  // ── 5. Aggregate all checks ─────────────────────────────────────────────────
  const allChecks = [
    ...technicalChecks,
    ...onPageChecks,
    ...contentChecks,
    ...linkChecks,
    ...accessibilityChecks,
    ...performanceChecks,
    ...aeoChecks,
    ...geoChecks,
  ];

  // ── 6. Calculate scores ─────────────────────────────────────────────────────
  progress('Calculating scores...');
  const categoryScores = calculateCategoryScores(allChecks, industry);
  const overallScore = calculateOverallScore(categoryScores);
  const summary = summarize(allChecks);

  // AEO score (from aeo-ai-search category)
  const aeoCategory = categoryScores.find((cs) => cs.category === 'aeo-ai-search');
  const aeoScore = aeoCategory?.score ?? 0;

  // GEO score (null if not applicable)
  const geoScore = calculateGEOScore(allChecks);

  // ── 7. Top issues and quick wins ─────────────────────────────────────────────
  const failed = allChecks.filter((c) => c.status !== 'pass');
  const topIssues = [...failed]
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 10);

  const quickWins = [...failed]
    .filter((c) => c.effortScore <= 2)
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 8);

  // ── 8. Roadmap ───────────────────────────────────────────────────────────────
  progress('Generating roadmap...');
  const domain = new URL(fetchResult.finalUrl || url).hostname;
  const roadmap = generatePhasedRoadmap(allChecks);

  // ── 9. Build report skeleton ─────────────────────────────────────────────────
  const reportWithoutAI: Omit<AuditReport, 'aiRecommendations'> = {
    url: fetchResult.finalUrl || url,
    domain,
    auditedAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    overallScore,
    aeoScore,
    geoScore,
    industry,
    categoryScores,
    checks: allChecks,
    summary,
    technicalDetails: {
      statusCode: fetchResult.statusCode,
      responseTimeMs: fetchResult.responseTimeMs,
      redirectChain: fetchResult.redirectChain,
      isHttps: (fetchResult.finalUrl || url).startsWith('https://'),
      pageSize: fetchResult.contentLength,
      headers: fetchResult.headers,
    },
    topIssues,
    quickWins,
    roadmap,
  };

  // ── 10. AI recommendations ──────────────────────────────────────────────────
  let aiRecommendations = '';
  if (!options.skipAI) {
    progress(`Generating AI recommendations with ${options.ollamaModel}...`);
    aiRecommendations = await generateRecommendations(
      reportWithoutAI,
      options.ollamaModel,
      options.ollamaHost
    );
  }

  return {
    ...reportWithoutAI,
    durationMs: Date.now() - startTime,
    aiRecommendations,
  };
}
