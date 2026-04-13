/**
 * Phased Implementation Roadmap Generator
 * Creates a 3-phase SEO action plan from audit check results
 */

import { CheckResult, RoadmapItem, RoadmapPhase } from '../types';

// ─── Phase classification ─────────────────────────────────────────────────────

/** Phase 1: Quick Wins — effort ≤ 2, can be done in 1-2 days */
function isPhase1(c: CheckResult): boolean {
  return c.status !== 'pass' && c.effortScore <= 2 && c.impactScore >= 5;
}

/** Phase 2: High Impact, Medium Effort — effort 3-5, high impact */
function isPhase2(c: CheckResult): boolean {
  return c.status !== 'pass' && c.effortScore >= 3 && c.effortScore <= 5 && c.impactScore >= 6;
}

/** Phase 3: Strategic / Long-term — effort > 5, or complex content work */
function isPhase3(c: CheckResult): boolean {
  return c.status !== 'pass' && (c.effortScore > 5 || (c.effortScore >= 4 && c.impactScore < 6));
}

// ─── Check → RoadmapItem mapping ─────────────────────────────────────────────

function checkToRoadmapItem(c: CheckResult): RoadmapItem {
  const hoursMap: Record<number, number> = { 1: 0.5, 2: 1, 3: 3, 4: 6, 5: 12, 6: 20, 7: 30, 8: 40, 9: 60, 10: 80 };
  return {
    title: c.name,
    description: c.explanation,
    effortHours: hoursMap[c.effortScore] ?? c.effortScore * 5,
    impactScore: c.impactScore,
    category: c.category,
    checkId: c.checkId,
  };
}

// ─── Traffic/revenue boost estimates per phase ────────────────────────────────

function phase1Boost(items: RoadmapItem[]): { traffic: string; revenue: string } {
  const avgImpact = items.length > 0
    ? items.reduce((s, i) => s + i.impactScore, 0) / items.length : 0;
  if (avgImpact >= 8) return { traffic: '+15-20%', revenue: '+10-15%' };
  if (avgImpact >= 6) return { traffic: '+10-15%', revenue: '+8-12%' };
  return { traffic: '+5-10%', revenue: '+5-8%' };
}

function phase2Boost(items: RoadmapItem[]): { traffic: string; revenue: string } {
  const avgImpact = items.length > 0
    ? items.reduce((s, i) => s + i.impactScore, 0) / items.length : 0;
  if (avgImpact >= 8) return { traffic: '+25-35%', revenue: '+20-28%' };
  if (avgImpact >= 6) return { traffic: '+20-30%', revenue: '+15-22%' };
  return { traffic: '+15-20%', revenue: '+10-16%' };
}

function phase3Boost(items: RoadmapItem[]): { traffic: string; revenue: string } {
  return { traffic: '+30-50%', revenue: '+25-40%' };
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generatePhasedRoadmap(checks: CheckResult[]): RoadmapPhase[] {
  const failed = checks.filter((c) => c.status !== 'pass' && c.category !== 'geo-local-seo');
  // For GEO N/A checks, skip them
  const geoFailed = checks.filter((c) => c.status === 'fail' && c.category === 'geo-local-seo'
    && !String(c.currentValue).startsWith('N/A'));

  const allFailed = [...failed, ...geoFailed];

  // Categorize into 3 phases
  const phase1Items = allFailed.filter(isPhase1)
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 8)
    .map(checkToRoadmapItem);

  const phase2Items = allFailed.filter(isPhase2)
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 8)
    .map(checkToRoadmapItem);

  // Phase 3 gets everything not in phase 1 or 2, plus complex items
  const phase12Ids = new Set([...phase1Items, ...phase2Items].map((i) => i.checkId));
  const phase3Items = allFailed
    .filter((c) => !phase12Ids.has(c.checkId) && (isPhase3(c) || (!isPhase1(c) && !isPhase2(c))))
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 8)
    .map(checkToRoadmapItem);

  // Ensure each phase has at least 3 generic strategic items if empty
  const fallbackPhase3Items: RoadmapItem[] = [
    {
      title: 'Content Cluster Strategy',
      description: 'Build topical authority with interconnected content clusters around your core topics.',
      effortHours: 40, impactScore: 9, category: 'content-quality',
    },
    {
      title: 'Backlink Acquisition Campaign',
      description: 'Develop a link-building strategy targeting industry publications and directories.',
      effortHours: 60, impactScore: 8, category: 'link-profile',
    },
    {
      title: 'AEO Content Overhaul',
      description: 'Rewrite key pages with FAQ sections, direct answers, and AI-optimized formatting.',
      effortHours: 30, impactScore: 8, category: 'aeo-ai-search',
    },
    {
      title: 'Core Web Vitals Optimization',
      description: 'Optimize LCP, FID, and CLS scores through technical performance improvements.',
      effortHours: 20, impactScore: 7, category: 'performance',
    },
    {
      title: 'Structured Data Expansion',
      description: 'Add comprehensive JSON-LD schema across all key page types.',
      effortHours: 15, impactScore: 7, category: 'technical-seo',
    },
  ];

  const ph1Boost = phase1Boost(phase1Items);
  const ph2Boost = phase2Boost(phase2Items);
  const ph3Items = phase3Items.length >= 3 ? phase3Items : [...phase3Items, ...fallbackPhase3Items].slice(0, 6);
  const ph3Boost = phase3Boost(ph3Items);

  const phases: RoadmapPhase[] = [
    {
      phase: 1,
      name: 'Quick Wins',
      timeframe: 'Week 1-2',
      totalHours: Math.round(phase1Items.reduce((s, i) => s + i.effortHours, 0)),
      items: phase1Items.length > 0 ? phase1Items : [
        { title: 'Audit & Prioritize', description: 'Review all audit findings and prioritize fixes.', effortHours: 2, impactScore: 5, category: 'technical-seo' },
        { title: 'Fix Missing Meta Tags', description: 'Add or optimize title, description, and Open Graph tags.', effortHours: 1, impactScore: 7, category: 'on-page-seo' },
      ],
      trafficBoost: ph1Boost.traffic,
      revenueBoost: ph1Boost.revenue,
    },
    {
      phase: 2,
      name: 'High Impact Improvements',
      timeframe: 'Week 3-6',
      totalHours: Math.round(phase2Items.reduce((s, i) => s + i.effortHours, 0)),
      items: phase2Items.length > 0 ? phase2Items : [
        { title: 'Schema Implementation', description: 'Add structured data across product, FAQ, and article pages.', effortHours: 8, impactScore: 8, category: 'technical-seo' },
        { title: 'Content Depth Expansion', description: 'Expand thin pages to 1500+ words with comprehensive coverage.', effortHours: 20, impactScore: 8, category: 'content-quality' },
      ],
      trafficBoost: ph2Boost.traffic,
      revenueBoost: ph2Boost.revenue,
    },
    {
      phase: 3,
      name: 'Strategic & Long-Term Growth',
      timeframe: 'Month 2-3+',
      totalHours: Math.round(ph3Items.reduce((s, i) => s + i.effortHours, 0)),
      items: ph3Items,
      trafficBoost: ph3Boost.traffic,
      revenueBoost: ph3Boost.revenue,
    },
  ];

  return phases;
}
