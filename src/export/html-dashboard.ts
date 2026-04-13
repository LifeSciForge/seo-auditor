import { AuditReport, CategoryScore } from '../types';

function esc(str: string | number | boolean | null | undefined): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function scoreColor(n: number): string {
  if (n >= 80) return '#16a34a';
  if (n >= 60) return '#ca8a04';
  return '#dc2626';
}

function scoreBg(n: number): string {
  if (n >= 80) return '#dcfce7';
  if (n >= 60) return '#fef9c3';
  return '#fee2e2';
}

function gauge(score: number, label: string, size = 100): string {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = scoreColor(score);
  return `
  <div style="text-align:center">
    <svg width="${size}" height="${size}" viewBox="0 0 100 100" style="transform:rotate(-90deg)">
      <circle cx="50" cy="50" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="10"/>
      <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}"
        stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"/>
      <text x="50" y="50" text-anchor="middle" dominant-baseline="central"
        style="transform:rotate(90deg) translate(0,-100px);font-size:18px;font-weight:800;fill:${color};font-family:sans-serif">${score}</text>
    </svg>
    <div style="font-size:12px;font-weight:600;color:#6b7280;margin-top:4px">${label}</div>
  </div>`;
}

function categoryBar(cs: CategoryScore): string {
  const color = scoreColor(cs.score);
  return `
  <div style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="font-size:13px;font-weight:600;color:#374151">${esc(cs.category.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()))}</span>
      <span style="font-size:13px;font-weight:700;color:${color}">${cs.score}/100</span>
    </div>
    <div style="background:#e5e7eb;border-radius:6px;height:8px;overflow:hidden">
      <div style="width:${cs.score}%;height:100%;background:${color};border-radius:6px"></div>
    </div>
    <div style="font-size:11px;color:#9ca3af;margin-top:2px">${cs.checksPassed}✓  ${cs.checksFailed}✗  ${cs.checksWarning}⚠</div>
  </div>`;
}

export function exportToHTML(report: AuditReport): string {
  const roadmap = report.roadmap || [];

  const geoDisplay = report.geoScore !== null ? `${report.geoScore}` : 'N/A';

  const issueRows = report.checks
    .filter((c) => c.status !== 'pass')
    .sort((a, b) => b.impactScore - a.impactScore)
    .map((c) => {
      const statusColor = c.status === 'fail' ? '#dc2626' : '#ca8a04';
      const sevColor = c.severity === 'high' ? '#dc2626' : c.severity === 'medium' ? '#ea580c' : '#ca8a04';
      return `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:10px;font-size:12px"><span style="background:${sevColor};color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;text-transform:uppercase">${c.severity}</span></td>
        <td style="padding:10px;font-size:12px;color:#6b7280">${esc(c.category.replace(/-/g, ' '))}</td>
        <td style="padding:10px;font-size:13px;font-weight:600;color:#111827">${esc(c.name)}</td>
        <td style="padding:10px;font-size:11px;color:#6b7280;max-width:300px">${esc(c.explanation)}</td>
        <td style="padding:10px;text-align:center"><span style="background:#f3f4f6;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:700">${c.impactScore}</span></td>
        <td style="padding:10px;text-align:center"><span style="background:#f3f4f6;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:700">${c.effortScore}</span></td>
      </tr>`;
    }).join('');

  const roadmapHtml = roadmap.map((phase) => {
    const phaseColor = phase.phase === 1 ? '#16a34a' : phase.phase === 2 ? '#2563eb' : '#7c3aed';
    const items = phase.items.map((item) => `
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;padding:10px;background:#f9fafb;border-radius:6px">
        <div style="min-width:32px;height:32px;background:${phaseColor};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${item.impactScore}</div>
        <div>
          <div style="font-size:13px;font-weight:600;color:#111827">${esc(item.title)}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">${esc(item.description.slice(0, 120))}${item.description.length > 120 ? '...' : ''}</div>
          <div style="font-size:11px;color:${phaseColor};margin-top:4px;font-weight:600">~${item.effortHours}h effort</div>
        </div>
      </div>`).join('');

    return `
    <div style="margin-bottom:28px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
      <div style="background:${phaseColor};padding:14px 18px;display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="color:rgba(255,255,255,0.8);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px">Phase ${phase.phase}</div>
          <div style="color:#fff;font-size:16px;font-weight:700">${esc(phase.name)}</div>
        </div>
        <div style="text-align:right">
          <div style="color:rgba(255,255,255,0.9);font-size:13px;font-weight:600">${esc(phase.timeframe)}</div>
          <div style="color:rgba(255,255,255,0.8);font-size:12px">${phase.totalHours}h total · ${esc(phase.trafficBoost)} traffic</div>
        </div>
      </div>
      <div style="padding:16px">${items}</div>
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Dashboard — ${esc(report.domain)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1f2937; }
    .container { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
    h2 { font-size: 18px; font-weight: 700; color: #1e3a5f; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
    .card { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f9fafb; padding: 10px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
  </style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <div style="margin-bottom:28px">
    <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">SEO Audit Dashboard</div>
    <h1 style="font-size:28px;font-weight:800;color:#111827">${esc(report.domain)}</h1>
    <div style="font-size:13px;color:#6b7280;margin-top:4px">${esc(report.url)} · Audited ${new Date(report.auditedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · Industry: ${esc(report.industry)}</div>
  </div>

  <!-- 3D Scores -->
  <div class="card">
    <h2>Score Overview</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;text-align:center">
      ${gauge(report.overallScore, 'SEO (Google)', 120)}
      ${gauge(report.aeoScore, 'AEO (AI Search)', 120)}
      <div style="text-align:center">
        <div style="width:120px;height:120px;display:flex;align-items:center;justify-content:center;margin:0 auto">
          <div style="font-size:32px;font-weight:800;color:${report.geoScore !== null ? scoreColor(report.geoScore) : '#6b7280'}">${geoDisplay}</div>
        </div>
        <div style="font-size:12px;font-weight:600;color:#6b7280;margin-top:4px">GEO (Local)</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:24px">
      <div style="text-align:center;padding:12px;background:#fee2e2;border-radius:8px">
        <div style="font-size:24px;font-weight:800;color:#dc2626">${report.summary.high}</div>
        <div style="font-size:12px;color:#6b7280">High Issues</div>
      </div>
      <div style="text-align:center;padding:12px;background:#fef9c3;border-radius:8px">
        <div style="font-size:24px;font-weight:800;color:#ca8a04">${report.summary.medium}</div>
        <div style="font-size:12px;color:#6b7280">Medium Issues</div>
      </div>
      <div style="text-align:center;padding:12px;background:#dcfce7;border-radius:8px">
        <div style="font-size:24px;font-weight:800;color:#16a34a">${report.summary.passed}</div>
        <div style="font-size:12px;color:#6b7280">Passed</div>
      </div>
      <div style="text-align:center;padding:12px;background:#f3f4f6;border-radius:8px">
        <div style="font-size:24px;font-weight:800;color:#374151">${report.checks.length}</div>
        <div style="font-size:12px;color:#6b7280">Total Checks</div>
      </div>
    </div>
  </div>

  <!-- Category Breakdown -->
  <div class="card">
    <h2>Category Breakdown</h2>
    ${report.categoryScores.map(categoryBar).join('')}
  </div>

  <!-- Issues Table -->
  <div class="card">
    <h2>Issues &amp; Recommendations</h2>
    <div style="overflow-x:auto">
      <table>
        <thead><tr>
          <th>Severity</th><th>Category</th><th>Check</th><th>Explanation</th>
          <th style="text-align:center">Impact</th><th style="text-align:center">Effort</th>
        </tr></thead>
        <tbody>${issueRows}</tbody>
      </table>
    </div>
  </div>

  <!-- Phased Roadmap -->
  ${roadmap.length > 0 ? `
  <div class="card">
    <h2>Phased Implementation Roadmap</h2>
    ${roadmapHtml}
  </div>` : ''}

  <!-- Footer -->
  <div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px;border-top:1px solid #e5e7eb;margin-top:24px">
    <a href="https://www.linkedin.com/in/pranjal-das1/" style="color:#7eb3f7;text-decoration:none">linkedin.com/in/pranjal-das1</a>
    &nbsp;·&nbsp; +91-9707936319
  </div>

</div>
</body>
</html>`;
}
