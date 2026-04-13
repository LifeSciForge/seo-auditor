import { AuditReport } from '../types';

function escapeCsv(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(...cells: Array<string | number | boolean | null | undefined>): string {
  return cells.map(escapeCsv).join(',');
}

export function exportToCSV(report: AuditReport): string {
  const lines: string[] = [];

  // Header block
  lines.push(row('SEO Audit Report'));
  lines.push(row('URL', report.url));
  lines.push(row('Domain', report.domain));
  lines.push(row('Audited At', report.auditedAt));
  lines.push(row('Industry', report.industry));
  lines.push(row('Overall Score', report.overallScore));
  lines.push(row('SEO Score', report.overallScore));
  lines.push(row('AEO Score', report.aeoScore));
  lines.push(row('GEO Score', report.geoScore ?? 'N/A'));
  lines.push(row('Total Checks', report.checks.length));
  lines.push('');

  // Category scores
  lines.push(row('CATEGORY SCORES'));
  lines.push(row('Category', 'Score', 'Weight', 'Passed', 'Failed', 'Warnings'));
  for (const cs of report.categoryScores) {
    lines.push(row(cs.category, cs.score, `${(cs.weight * 100).toFixed(0)}%`, cs.checksPassed, cs.checksFailed, cs.checksWarning));
  }
  lines.push('');

  // All checks
  lines.push(row('ALL CHECKS'));
  lines.push(row('Priority', 'Category', 'Check Name', 'Status', 'Severity', 'Current Value', 'Recommended Value', 'Explanation', 'Impact (1-10)', 'Effort (1-10)', 'Phase'));

  // Sort: fail high > fail medium > warning > pass
  const priorityOrder: Record<string, number> = { fail: 0, warning: 1, pass: 2 };
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const sorted = [...report.checks].sort((a, b) => {
    const statusDiff = priorityOrder[a.status] - priorityOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  for (const c of sorted) {
    // Determine phase
    let phase = 'Phase 3';
    if (c.status !== 'pass') {
      if (c.effortScore <= 2 && c.impactScore >= 5) phase = 'Phase 1';
      else if (c.effortScore <= 5 && c.impactScore >= 6) phase = 'Phase 2';
    } else {
      phase = 'Done';
    }

    lines.push(row(
      c.status === 'fail' && c.severity === 'high' ? 'CRITICAL' :
        c.status === 'fail' ? 'HIGH' :
          c.status === 'warning' ? 'MEDIUM' : 'DONE',
      c.category,
      c.name,
      c.status.toUpperCase(),
      c.severity.toUpperCase(),
      c.currentValue,
      c.recommendedValue,
      c.explanation,
      c.impactScore,
      c.effortScore,
      phase,
    ));
  }
  lines.push('');

  // Roadmap
  if (report.roadmap?.length) {
    lines.push(row('PHASED ROADMAP'));
    lines.push(row('Phase', 'Timeframe', 'Task', 'Category', 'Hours', 'Impact (1-10)', 'Traffic Boost'));
    for (const phase of report.roadmap) {
      for (const item of phase.items) {
        lines.push(row(
          `Phase ${phase.phase}: ${phase.name}`,
          phase.timeframe,
          item.title,
          item.category,
          item.effortHours,
          item.impactScore,
          phase.trafficBoost,
        ));
      }
    }
  }

  return lines.join('\n');
}
