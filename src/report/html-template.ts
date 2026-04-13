import { AuditReport, CategoryScore, CheckResult, CATEGORY_LABELS } from '../types';
import { getScoreGrade } from '../utils/scorer';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function severityBadge(sev: string): string {
  const colors: Record<string, string> = {
    high: '#dc2626',
    medium: '#ea580c',
    low: '#ca8a04',
  };
  return `<span style="background:${colors[sev] || '#6b7280'};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">${sev}</span>`;
}

function statusBadge(status: string): string {
  const styles: Record<string, string> = {
    pass:    'background:#dcfce7;color:#16a34a;border:1px solid #86efac',
    fail:    'background:#fee2e2;color:#dc2626;border:1px solid #fca5a5',
    warning: 'background:#fef9c3;color:#ca8a04;border:1px solid #fde047',
  };
  const labels: Record<string, string> = { pass: '✓ PASS', fail: '✗ FAIL', warning: '⚠ WARN' };
  return `<span style="${styles[status] || ''};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">${labels[status] || status}</span>`;
}

/** SVG donut gauge for a score 0-100 */
function scoreGauge(score: number, size = 120): string {
  const grade = getScoreGrade(score);
  const radius = 46;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;
  return `
  <svg width="${size}" height="${size}" viewBox="0 0 120 120" style="transform:rotate(-90deg)">
    <circle cx="60" cy="60" r="${radius}" fill="none" stroke="#e5e7eb" stroke-width="12"/>
    <circle cx="60" cy="60" r="${radius}" fill="none" stroke="${grade.color}"
      stroke-width="12" stroke-linecap="round"
      stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"/>
    <text x="60" y="60" text-anchor="middle" dominant-baseline="central"
      style="transform:rotate(90deg) translate(0, -120px);font-size:22px;font-weight:800;fill:${grade.color};font-family:sans-serif">${score}</text>
    <text x="60" y="78" text-anchor="middle" dominant-baseline="central"
      style="transform:rotate(90deg) translate(0, -120px);font-size:11px;fill:#6b7280;font-family:sans-serif">${grade.grade}</text>
  </svg>`;
}

/** Horizontal bar chart for category scores */
function categoryBars(scores: CategoryScore[]): string {
  const bars = scores.map((cs) => {
    const grade = getScoreGrade(cs.score);
    const label = CATEGORY_LABELS[cs.category];
    const pct = cs.score;
    return `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:13px;font-weight:600;color:#374151">${label}</span>
        <span style="font-size:13px;font-weight:700;color:${grade.color}">${pct}</span>
      </div>
      <div style="background:#e5e7eb;border-radius:6px;height:10px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${grade.color};border-radius:6px;transition:width 0.3s"></div>
      </div>
      <div style="font-size:11px;color:#9ca3af;margin-top:2px">
        ${cs.checksPassed} passed · ${cs.checksFailed} failed · ${cs.checksWarning} warnings
      </div>
    </div>`;
  }).join('');
  return `<div>${bars}</div>`;
}

/** Renders a table of check results for a category */
function checkTable(checks: CheckResult[]): string {
  if (checks.length === 0) return '<p style="color:#9ca3af;font-style:italic">No checks in this category.</p>';

  const rows = checks.map((c) => {
    const curVal = c.currentValue !== null ? escapeHtml(String(c.currentValue)) : '—';
    const recVal = c.recommendedValue !== null ? escapeHtml(String(c.recommendedValue)) : '—';
    const affected = c.affectedElements.length > 0
      ? `<details><summary style="cursor:pointer;color:#6b7280;font-size:11px">${c.affectedElements.length} element(s)</summary><pre style="font-size:10px;background:#f9fafb;padding:6px;border-radius:4px;white-space:pre-wrap;word-break:break-all">${c.affectedElements.slice(0, 3).map(escapeHtml).join('\n')}</pre></details>`
      : '';
    const rowBg = c.status === 'pass' ? '#f0fdf4' : c.status === 'warning' ? '#fffbeb' : '#fef2f2';

    return `
    <tr style="background:${rowBg};border-bottom:1px solid #e5e7eb">
      <td style="padding:10px 12px;vertical-align:top;min-width:130px">
        ${statusBadge(c.status)}<br>
        <span style="margin-top:4px;display:block">${severityBadge(c.severity)}</span>
      </td>
      <td style="padding:10px 12px;vertical-align:top">
        <strong style="font-size:13px;color:#111827">${escapeHtml(c.name)}</strong><br>
        <span style="font-size:12px;color:#6b7280;line-height:1.5">${escapeHtml(c.explanation)}</span>
        ${affected}
      </td>
      <td style="padding:10px 12px;vertical-align:top;font-size:12px;color:#374151;white-space:nowrap">${curVal}</td>
      <td style="padding:10px 12px;vertical-align:top;font-size:12px;color:#374151;white-space:nowrap">${recVal}</td>
      <td style="padding:10px 12px;vertical-align:top;text-align:center">
        <span title="Impact on rankings" style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;background:#f3f4f6;border-radius:50%;font-size:11px;font-weight:700;color:#374151">${c.impactScore}</span>
      </td>
      <td style="padding:10px 12px;vertical-align:top;text-align:center">
        <span title="Fix effort" style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;background:#f3f4f6;border-radius:50%;font-size:11px;font-weight:700;color:#374151">${c.effortScore}</span>
      </td>
    </tr>`;
  }).join('');

  return `
  <table style="width:100%;border-collapse:collapse;font-family:sans-serif">
    <thead>
      <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb">
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;min-width:130px">Status</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Check / Explanation</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Current</th>
        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Target</th>
        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px" title="Impact on rankings (1-10)">Impact</th>
        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px" title="Fix effort (1-10)">Effort</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ─── Main template ─────────────────────────────────────────────────────────────

export function buildHtmlReport(report: AuditReport): string {
  const grade = getScoreGrade(report.overallScore);
  const auditDate = new Date(report.auditedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const auditTime = new Date(report.auditedAt).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit',
  });
  const durationSec = (report.durationMs / 1000).toFixed(1);

  const categories = Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>;

  const categorySections = categories.map((cat) => {
    const catLabel = CATEGORY_LABELS[cat];
    const catScore = report.categoryScores.find((cs) => cs.category === cat);
    const catChecks = report.checks.filter((c) => c.category === cat);
    const catGrade = getScoreGrade(catScore?.score ?? 0);

    // Sort: failed first, then warnings, then passed
    const sorted = [...catChecks].sort((a, b) => {
      const order: Record<string, number> = { fail: 0, warning: 1, pass: 2 };
      return order[a.status] - order[b.status];
    });

    return `
    <div style="margin-bottom:40px;page-break-inside:avoid">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;padding:12px 16px;background:${catGrade.bg};border-radius:8px;border-left:4px solid ${catGrade.color}">
        <div style="font-size:28px;font-weight:800;color:${catGrade.color}">${catScore?.score ?? 0}</div>
        <div>
          <h2 style="margin:0;font-size:18px;color:#111827">${catLabel}</h2>
          <p style="margin:2px 0 0;font-size:12px;color:#6b7280">
            ${catScore?.checksPassed ?? 0} passed · ${catScore?.checksFailed ?? 0} failed · ${catScore?.checksWarning ?? 0} warnings
            · Weight: ${((catScore?.weight ?? 0) * 100).toFixed(0)}%
          </p>
        </div>
      </div>
      ${checkTable(sorted)}
    </div>`;
  }).join('');

  const aiSection = report.aiRecommendations
    ? `
    <div style="margin-bottom:40px">
      <h2 style="font-size:20px;color:#1e3a5f;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:16px">
        AI-Powered Recommendations
      </h2>
      <div style="background:#f8faff;border:1px solid #dbeafe;border-radius:8px;padding:20px">
        <pre style="white-space:pre-wrap;word-wrap:break-word;font-family:inherit;font-size:13px;line-height:1.7;color:#1e3a5f;margin:0">${escapeHtml(report.aiRecommendations)}</pre>
      </div>
    </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Audit Report — ${escapeHtml(report.domain)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; background: #fff; }
    @page { margin: 15mm 12mm; size: A4; }
    @media print { .page-break { page-break-before: always; } }
    h1, h2, h3 { line-height: 1.3; }
    details summary::-webkit-details-marker { display: none; }
  </style>
</head>
<body>

<!-- ═══════════════ COVER PAGE ═══════════════ -->
<div style="min-height:100vh;background:linear-gradient(135deg,#1e3a5f 0%,#2d6a4f 100%);display:flex;flex-direction:column;justify-content:center;align-items:center;padding:60px 40px;text-align:center;page-break-after:always">
  <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:48px 56px;max-width:680px;width:100%">
    <div style="font-size:12px;color:rgba(255,255,255,0.6);letter-spacing:2px;text-transform:uppercase;margin-bottom:16px">Comprehensive SEO + AEO + GEO Audit</div>
    <h1 style="font-size:32px;color:#fff;margin-bottom:8px;word-break:break-all">${escapeHtml(report.domain)}</h1>
    <p style="font-size:14px;color:rgba(255,255,255,0.6);margin-bottom:32px;word-break:break-all">${escapeHtml(report.url)}</p>

    <!-- 3D Score Gauges -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
      <div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:16px">
        <div style="font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">SEO Score</div>
        ${scoreGauge(report.overallScore, 110)}
        <div style="font-size:13px;font-weight:700;color:${grade.color};background:rgba(255,255,255,0.9);display:inline-block;padding:3px 12px;border-radius:12px;margin-top:8px">${grade.grade} — ${grade.label}</div>
      </div>
      <div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:16px">
        <div style="font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">AEO (AI Search)</div>
        ${scoreGauge(report.aeoScore, 110)}
        <div style="font-size:13px;font-weight:700;color:${getScoreGrade(report.aeoScore).color};background:rgba(255,255,255,0.9);display:inline-block;padding:3px 12px;border-radius:12px;margin-top:8px">${getScoreGrade(report.aeoScore).grade} — ${getScoreGrade(report.aeoScore).label}</div>
      </div>
      <div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <div style="font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">GEO (Local)</div>
        <div style="font-size:48px;font-weight:800;color:${report.geoScore !== null ? getScoreGrade(report.geoScore).color : '#94a3b8'}">${report.geoScore !== null ? report.geoScore : 'N/A'}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:8px">${report.geoScore !== null ? `${getScoreGrade(report.geoScore).grade} — ${getScoreGrade(report.geoScore).label}` : 'Not applicable'}</div>
      </div>
    </div>

    <!-- Summary boxes -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
      <div style="background:rgba(220,38,38,0.15);border:1px solid rgba(220,38,38,0.3);border-radius:8px;padding:12px">
        <div style="font-size:24px;font-weight:800;color:#fca5a5">${report.summary.high}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:2px">High Issues</div>
      </div>
      <div style="background:rgba(234,88,12,0.15);border:1px solid rgba(234,88,12,0.3);border-radius:8px;padding:12px">
        <div style="font-size:24px;font-weight:800;color:#fdba74">${report.summary.medium}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:2px">Medium Issues</div>
      </div>
      <div style="background:rgba(22,163,74,0.15);border:1px solid rgba(22,163,74,0.3);border-radius:8px;padding:12px">
        <div style="font-size:24px;font-weight:800;color:#86efac">${report.summary.passed}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:2px">Passed</div>
      </div>
      <div style="background:rgba(202,138,4,0.15);border:1px solid rgba(202,138,4,0.3);border-radius:8px;padding:12px">
        <div style="font-size:24px;font-weight:800;color:#fde047">${report.checks.length}</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.7);margin-top:2px">Total Checks</div>
      </div>
    </div>
  </div>

  <div style="margin-top:32px;color:rgba(255,255,255,0.5);font-size:12px">
    Audited on ${auditDate} at ${auditTime} · Completed in ${durationSec}s · Industry: ${escapeHtml(report.industry)}
  </div>
</div>

<!-- ═══════════════ MAIN CONTENT ═══════════════ -->
<div style="padding:40px 48px;max-width:1000px;margin:0 auto">

  <!-- Executive Summary -->
  <div style="margin-bottom:40px">
    <h2 style="font-size:20px;color:#1e3a5f;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:20px">Executive Summary</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">

      <!-- Score Overview -->
      <div style="background:#f9fafb;border-radius:8px;padding:20px">
        <h3 style="font-size:14px;color:#6b7280;margin-bottom:16px;text-transform:uppercase;letter-spacing:0.5px">Score by Category</h3>
        ${categoryBars(report.categoryScores)}
      </div>

      <!-- Top Issues & Quick Wins -->
      <div>
        <div style="background:#fef2f2;border-radius:8px;padding:16px;margin-bottom:16px">
          <h3 style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:10px">Top Priority Fixes</h3>
          ${report.topIssues.slice(0, 5).map((c) =>
            `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
              ${severityBadge(c.severity)}
              <span style="font-size:12px;color:#374151">${escapeHtml(c.name)}</span>
            </div>`
          ).join('') || '<p style="font-size:12px;color:#9ca3af">No critical issues found.</p>'}
        </div>
        <div style="background:#f0fdf4;border-radius:8px;padding:16px">
          <h3 style="font-size:13px;font-weight:700;color:#16a34a;margin-bottom:10px">Quick Wins (Low Effort)</h3>
          ${report.quickWins.slice(0, 5).map((c) =>
            `<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
              <span style="background:#dcfce7;color:#16a34a;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:700;white-space:nowrap">effort: ${c.effortScore}</span>
              <span style="font-size:12px;color:#374151">${escapeHtml(c.name)}</span>
            </div>`
          ).join('') || '<p style="font-size:12px;color:#9ca3af">No quick wins identified.</p>'}
        </div>
      </div>
    </div>
  </div>

  <!-- Technical Details Bar -->
  <div style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:40px;display:flex;flex-wrap:wrap;gap:24px">
    <div><span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Status Code</span>
      <div style="font-size:16px;font-weight:700;color:#111827">${report.technicalDetails.statusCode || '—'}</div></div>
    <div><span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Response Time</span>
      <div style="font-size:16px;font-weight:700;color:#111827">${report.technicalDetails.responseTimeMs}ms</div></div>
    <div><span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">HTTPS</span>
      <div style="font-size:16px;font-weight:700;color:${report.technicalDetails.isHttps ? '#16a34a' : '#dc2626'}">${report.technicalDetails.isHttps ? '✓ Yes' : '✗ No'}</div></div>
    <div><span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Page Size</span>
      <div style="font-size:16px;font-weight:700;color:#111827">${Math.round(report.technicalDetails.pageSize / 1024)}KB</div></div>
    <div><span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Redirects</span>
      <div style="font-size:16px;font-weight:700;color:#111827">${report.technicalDetails.redirectChain.length}</div></div>
    <div><span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Total Checks</span>
      <div style="font-size:16px;font-weight:700;color:#111827">${report.checks.length}</div></div>
    <div><span style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Audit Duration</span>
      <div style="font-size:16px;font-weight:700;color:#111827">${durationSec}s</div></div>
  </div>

  <!-- Implementation Timeline -->
  <div style="margin-bottom:40px">
    <h2 style="font-size:20px;color:#1e3a5f;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:20px">Implementation Timeline</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:20px;text-align:center">
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Quick Wins</div>
        <div style="font-size:28px;font-weight:800;color:#16a34a">2–4h</div>
        <div style="font-size:12px;color:#6b7280;margin-top:6px">Low-effort, high-impact fixes you can ship this week</div>
      </div>
      <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:20px;text-align:center">
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Medium Effort</div>
        <div style="font-size:28px;font-weight:800;color:#ca8a04">10–20h</div>
        <div style="font-size:12px;color:#6b7280;margin-top:6px">Structural improvements for a 2–4 week sprint</div>
      </div>
      <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;padding:20px;text-align:center">
        <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Strategic Work</div>
        <div style="font-size:28px;font-weight:800;color:#2563eb">40+h</div>
        <div style="font-size:12px;color:#6b7280;margin-top:6px">Deep technical and content overhauls for long-term growth</div>
      </div>
    </div>
  </div>

  <!-- Phased Roadmap -->
  ${report.roadmap?.length ? `
  <div style="margin-bottom:40px">
    <h2 style="font-size:20px;color:#1e3a5f;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:20px">Phased Implementation Roadmap</h2>
    ${report.roadmap.map((phase) => {
      const phaseColors: Record<number, { bg: string; border: string; text: string }> = {
        1: { bg: '#f0fdf4', border: '#86efac', text: '#16a34a' },
        2: { bg: '#eff6ff', border: '#93c5fd', text: '#2563eb' },
        3: { bg: '#faf5ff', border: '#d8b4fe', text: '#7c3aed' },
      };
      const c = phaseColors[phase.phase] || phaseColors[3];
      const items = phase.items.slice(0, 6).map((item) =>
        `<div style="display:flex;gap:10px;margin-bottom:8px;padding:8px;background:#fff;border-radius:6px;border:1px solid #f3f4f6">
          <div style="min-width:28px;height:28px;background:${c.text};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${item.impactScore}</div>
          <div>
            <div style="font-size:13px;font-weight:600;color:#111827">${escapeHtml(item.title)}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px">~${item.effortHours}h effort · ${escapeHtml(item.category.replace(/-/g, ' '))}</div>
          </div>
        </div>`
      ).join('');
      return `
      <div style="margin-bottom:20px;border:1px solid ${c.border};border-radius:10px;overflow:hidden">
        <div style="background:${c.bg};padding:14px 18px;border-bottom:1px solid ${c.border};display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:11px;color:${c.text};font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Phase ${phase.phase}</div>
            <div style="font-size:16px;font-weight:700;color:#111827">${escapeHtml(phase.name)}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:13px;font-weight:600;color:#374151">${escapeHtml(phase.timeframe)}</div>
            <div style="font-size:12px;color:#6b7280">${phase.totalHours}h total · ${escapeHtml(phase.trafficBoost)} traffic boost</div>
          </div>
        </div>
        <div style="padding:14px">${items}</div>
      </div>`;
    }).join('')}
  </div>` : ''}

  <!-- AI Recommendations -->
  ${aiSection}

  <!-- Category Detail Sections -->
  <div class="page-break">
    <h2 style="font-size:22px;color:#1e3a5f;margin-bottom:24px;padding-bottom:8px;border-bottom:3px solid #1e3a5f">Detailed Audit Results</h2>
    ${categorySections}
  </div>

</div>

<!-- ═══════════════ FOOTER ═══════════════ -->
<div style="background:#1e3a5f;padding:24px 48px;text-align:center;margin-top:40px">
  <p style="color:rgba(255,255,255,0.6);font-size:12px;margin-bottom:6px">
    SEO Audit Report for <strong style="color:#fff">${escapeHtml(report.domain)}</strong> · Generated ${auditDate}
  </p>
  <p style="font-size:12px;display:flex;align-items:center;justify-content:center;gap:20px;flex-wrap:wrap;margin-top:10px">
    <a href="https://www.linkedin.com/in/pranjal-das1/"
       style="color:#7eb3f7;text-decoration:none;display:inline-flex;align-items:center;gap:5px"
       target="_blank" rel="noopener">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
      linkedin.com/in/pranjal-das1
    </a>
    <a href="tel:+919707936319"
       style="color:#7eb3f7;text-decoration:none;display:inline-flex;align-items:center;gap:5px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
      </svg>
      +91-9707936319
    </a>
  </p>
</div>

</body>
</html>`;
}
