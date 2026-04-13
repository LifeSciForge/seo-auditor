import { AuditReport } from '../types';

export function exportToJSON(report: AuditReport): string {
  const exportData = {
    metadata: {
      url: report.url,
      domain: report.domain,
      auditedAt: report.auditedAt,
      durationMs: report.durationMs,
      industry: report.industry,
      totalChecks: report.checks.length,
    },
    scores: {
      overall: report.overallScore,
      seo: report.overallScore,
      aeo: report.aeoScore,
      geo: report.geoScore,
      byCategory: report.categoryScores.map((cs) => ({
        category: cs.category,
        score: cs.score,
        weight: cs.weight,
        passed: cs.checksPassed,
        failed: cs.checksFailed,
        warnings: cs.checksWarning,
      })),
    },
    summary: report.summary,
    technicalDetails: report.technicalDetails,
    topIssues: report.topIssues.map((c) => ({
      id: c.checkId,
      name: c.name,
      category: c.category,
      severity: c.severity,
      status: c.status,
      explanation: c.explanation,
      currentValue: c.currentValue,
      recommendedValue: c.recommendedValue,
      impactScore: c.impactScore,
      effortScore: c.effortScore,
    })),
    quickWins: report.quickWins.map((c) => ({
      id: c.checkId,
      name: c.name,
      category: c.category,
      impactScore: c.impactScore,
      effortScore: c.effortScore,
      explanation: c.explanation,
    })),
    allChecks: report.checks.map((c) => ({
      id: c.checkId,
      name: c.name,
      category: c.category,
      severity: c.severity,
      status: c.status,
      currentValue: c.currentValue,
      recommendedValue: c.recommendedValue,
      impactScore: c.impactScore,
      effortScore: c.effortScore,
      explanation: c.explanation,
    })),
    roadmap: report.roadmap.map((phase) => ({
      phase: phase.phase,
      name: phase.name,
      timeframe: phase.timeframe,
      totalHours: phase.totalHours,
      trafficBoost: phase.trafficBoost,
      revenueBoost: phase.revenueBoost,
      items: phase.items.map((item) => ({
        title: item.title,
        description: item.description,
        effortHours: item.effortHours,
        impactScore: item.impactScore,
        category: item.category,
      })),
    })),
    aiRecommendations: report.aiRecommendations || null,
  };

  return JSON.stringify(exportData, null, 2);
}
