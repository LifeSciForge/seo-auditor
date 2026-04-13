import express, { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import { auditUrl } from './auditor';
import { generatePdfReport } from './report/pdf-generator';
import { DEFAULT_OPTIONS, AuditOptions, AuditReport, IndustryType } from './types';
import { normalizeUrl } from './utils/crawler';
import { exportToJSON } from './export/json-exporter';
import { exportToCSV } from './export/csv-exporter';
import { exportToHTML } from './export/html-dashboard';

const app = express();
const PORT = 3000;

// ── Temp storage for reports ──────────────────────────────────────────────────
const REPORTS_DIR = path.join(os.tmpdir(), 'seo-auditor-reports');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// In-memory report store (for the lifetime of the server process)
const reportStore = new Map<string, AuditReport>();

/** Sanitise a report ID to prevent path traversal */
function safeId(raw: string): string | null {
  const id = String(raw).replace(/[^a-zA-Z0-9_-]/g, '');
  return id.length > 0 && id.length < 64 ? id : null;
}

const VALID_INDUSTRIES: IndustryType[] = ['generic', 'ecommerce', 'saas', 'content', 'local', 'research'];

// ── Home page ─────────────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.send(HOME_HTML);
});

// ── SSE audit endpoint ────────────────────────────────────────────────────────
app.get('/audit', async (req: Request, res: Response) => {
  const rawUrl  = String(req.query.url   || '').trim();
  const skipAI  = req.query.skipAI === 'true';
  const model   = String(req.query.model || DEFAULT_OPTIONS.ollamaModel);
  const rawInd  = String(req.query.industry || 'generic');
  const industry: IndustryType = VALID_INDUSTRIES.includes(rawInd as IndustryType)
    ? (rawInd as IndustryType) : 'generic';

  if (!rawUrl) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event: string, data: Record<string, unknown>) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (typeof (res as unknown as { flush?: () => void }).flush === 'function') {
      (res as unknown as { flush: () => void }).flush();
    }
  };

  try {
    const reportId   = `audit-${Date.now()}`;
    const outputPath = path.join(REPORTS_DIR, `${reportId}.pdf`);

    const options: AuditOptions = {
      ...DEFAULT_OPTIONS,
      skipAI,
      ollamaModel: model,
      checkExternalLinks: false,
      maxLinksToCheck: 30,
      timeout: 10000,
      outputPath,
      verbose: false,
      industry,
    };

    send('progress', { step: 'fetch', message: `Fetching ${normalizeUrl(rawUrl)}…` });

    const report = await auditUrl(rawUrl, options, (step) => {
      send('progress', { step: 'check', message: step });
    });

    // Store report in memory for export endpoints
    reportStore.set(reportId, report);

    send('progress', { step: 'pdf', message: 'Generating PDF report…' });
    await generatePdfReport(report, outputPath);

    send('complete', {
      score:      report.overallScore,
      aeoScore:   report.aeoScore,
      geoScore:   report.geoScore,
      domain:     report.domain,
      checks:     report.checks.length,
      durationMs: report.durationMs,
      high:       report.summary.high,
      medium:     report.summary.medium,
      passed:     report.summary.passed,
      reportId,
      reportUrl:   `/report/${reportId}`,
      downloadUrl: `/download/${reportId}`,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    send('error', { message });
  }

  res.end();
});

// ── Serve HTML report ─────────────────────────────────────────────────────────
app.get('/report/:id', (req: Request, res: Response) => {
  const id = safeId(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  if (!id) { res.status(400).send('Invalid report ID'); return; }

  const htmlPath = path.join(REPORTS_DIR, `${id}.html`);
  if (!fs.existsSync(htmlPath)) { res.status(404).send('Report not found'); return; }

  res.sendFile(htmlPath);
});

// ── Download PDF ──────────────────────────────────────────────────────────────
app.get('/download/:id', (req: Request, res: Response) => {
  const id = safeId(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  if (!id) { res.status(400).send('Invalid report ID'); return; }

  const pdfPath = path.join(REPORTS_DIR, `${id}.pdf`);
  if (!fs.existsSync(pdfPath)) { res.status(404).send('PDF not found'); return; }

  res.download(pdfPath, `seo-audit-${id}.pdf`);
});

// ── Export endpoints ──────────────────────────────────────────────────────────
app.get('/api/audit/:id/export', (req: Request, res: Response) => {
  const id = safeId(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
  if (!id) { res.status(400).json({ error: 'Invalid ID' }); return; }

  const format = String(req.query.format || 'json').toLowerCase();
  const report = reportStore.get(id);
  if (!report) { res.status(404).json({ error: 'Report not found (server may have restarted)' }); return; }

  switch (format) {
    case 'json': {
      const json = exportToJSON(report);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="seo-audit-${report.domain}.json"`);
      res.send(json);
      break;
    }
    case 'csv': {
      const csv = exportToCSV(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="seo-audit-${report.domain}.csv"`);
      res.send(csv);
      break;
    }
    case 'html': {
      const html = exportToHTML(report);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
      break;
    }
    case 'pdf': {
      const pdfPath = path.join(REPORTS_DIR, `${id}.pdf`);
      if (!fs.existsSync(pdfPath)) { res.status(404).send('PDF not found'); return; }
      res.download(pdfPath, `seo-audit-${report.domain}.pdf`);
      break;
    }
    default:
      res.status(400).json({ error: `Unknown format: ${format}. Use json, csv, html, or pdf.` });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n' + '═'.repeat(50));
  console.log('  SEO Auditor  ·  http://localhost:' + PORT);
  console.log('═'.repeat(50) + '\n');
});

// ═════════════════════════════════════════════════════════════════════════════
// Embedded HTML
// ═════════════════════════════════════════════════════════════════════════════
const HOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Auditor</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:       #0f1117;
      --surface:  #1a1d27;
      --border:   #2d3146;
      --accent:   #4f7ef8;
      --accent2:  #7c3aed;
      --text:     #e8eaf0;
      --muted:    #6b7280;
      --success:  #16a34a;
      --warn:     #ca8a04;
      --danger:   #dc2626;
      --radius:   10px;
    }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    header {
      padding: 20px 32px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    header .logo {
      width: 36px; height: 36px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
    }
    header h1 { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
    header p  { font-size: 12px; color: var(--muted); margin-left: auto; }

    main {
      flex: 1;
      display: grid;
      grid-template-columns: 400px 1fr;
      gap: 0;
      min-height: 0;
    }

    .panel-left {
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      height: calc(100vh - 73px);
    }

    .form-area {
      padding: 24px 24px 20px;
      border-bottom: 1px solid var(--border);
    }
    .form-area h2 {
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 16px;
    }

    label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }
    input[type="url"], select, input[type="text"] {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      color: var(--text);
      font-size: 13px;
      padding: 9px 12px;
      outline: none;
      transition: border-color 0.15s;
      margin-bottom: 12px;
    }
    input[type="url"]:focus, select:focus, input[type="text"]:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(79,126,248,0.15);
    }
    input::placeholder { color: var(--muted); }
    select option { background: var(--surface); }

    .row2 {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .row2 label { margin: 0; }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 12px;
      color: var(--text);
      cursor: pointer;
      user-select: none;
      text-transform: none;
      letter-spacing: 0;
      font-weight: 400;
      white-space: nowrap;
    }
    .checkbox-label input { accent-color: var(--accent); width: 14px; height: 14px; }

    .model-input {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--muted);
      font-size: 11px;
      padding: 4px 8px;
      outline: none;
      width: 150px;
      margin-bottom: 0;
    }
    .model-input:focus { border-color: var(--accent); color: var(--text); }

    #run-btn {
      width: 100%;
      padding: 11px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      border: none;
      border-radius: var(--radius);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      letter-spacing: 0.2px;
      transition: opacity 0.15s, transform 0.1s;
      margin-top: 4px;
    }
    #run-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
    #run-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    .log-area {
      flex: 1;
      overflow-y: auto;
      padding: 14px 24px;
    }
    .log-area h3 {
      font-size: 11px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 600;
      margin-bottom: 10px;
    }

    #log { list-style: none; }
    #log li {
      font-size: 12px;
      color: var(--muted);
      padding: 5px 0;
      border-bottom: 1px solid rgba(45,49,70,0.5);
      display: flex;
      align-items: flex-start;
      gap: 8px;
      line-height: 1.5;
    }
    #log li .dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--accent);
      margin-top: 5px;
      flex-shrink: 0;
    }
    #log li.done   .dot { background: var(--success); }
    #log li.err    .dot { background: var(--danger); }
    #log li.active .dot { animation: pulse 1s infinite; background: var(--accent); }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    #log li .text { color: var(--text); }

    /* Score bar */
    #score-bar {
      display: none;
      padding: 12px 24px;
      border-top: 1px solid var(--border);
      background: var(--surface);
      gap: 12px;
      flex-wrap: wrap;
      font-size: 12px;
    }
    #score-bar.visible { display: flex; align-items: center; }
    .score-chip { display: flex; align-items: center; gap: 5px; }
    .score-number { font-size: 20px; font-weight: 800; }
    .score-label { color: var(--muted); font-size: 11px; }
    .stat { color: var(--muted); font-size: 12px; }
    .stat strong { color: var(--text); }

    /* Export buttons */
    .export-btns {
      display: flex; gap: 6px; margin-left: auto; flex-wrap: wrap;
    }
    .export-btn {
      padding: 6px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--surface);
      transition: background 0.15s, border-color 0.15s;
      white-space: nowrap;
    }
    .export-btn:hover { background: var(--border); border-color: var(--accent); }
    .export-btn.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }
    .export-btn.primary:hover { opacity: 0.85; background: var(--accent); }

    /* Right panel */
    .panel-right {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 73px);
      overflow: hidden;
    }

    #placeholder {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      color: var(--muted);
    }
    #placeholder .icon { font-size: 56px; opacity: 0.3; }
    #placeholder p { font-size: 14px; max-width: 280px; text-align: center; line-height: 1.6; }
    #placeholder code {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 16px;
      font-size: 12px;
      color: var(--accent);
      font-family: 'SF Mono', 'Fira Code', monospace;
    }

    #report-frame {
      flex: 1;
      border: none;
      display: none;
      width: 100%;
    }
    #report-frame.visible { display: block; }

    #progress-bar-wrap {
      height: 3px;
      background: var(--border);
      overflow: hidden;
      display: none;
    }
    #progress-bar-wrap.visible { display: block; }
    #progress-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, var(--accent), var(--accent2));
      transition: width 0.4s ease;
    }
  </style>
</head>
<body>

<header>
  <div class="logo">🔍</div>
  <h1>SEO Auditor</h1>
  <p>Local &amp; Private</p>
</header>

<main>
  <!-- LEFT: form + log -->
  <div class="panel-left">
    <div class="form-area">
      <h2>New Audit</h2>

      <label for="url-input">Website URL</label>
      <input type="url" id="url-input" placeholder="https://example.com" autocomplete="off" spellcheck="false">

      <label for="industry-select">Business Type</label>
      <select id="industry-select">
        <option value="generic">Generic / General</option>
        <option value="ecommerce">E-Commerce / Retail</option>
        <option value="saas">B2B SaaS / Technology</option>
        <option value="content">Content / Media / Blog</option>
        <option value="local">Local Business</option>
        <option value="research">Research / Education / Non-Profit</option>
      </select>

      <div class="row2">
        <label class="checkbox-label">
          <input type="checkbox" id="skip-ai-check">
          Skip AI
        </label>
        <input type="text" class="model-input" id="model-input"
          placeholder="Ollama model"
          value="${DEFAULT_OPTIONS.ollamaModel}"
          title="Ollama model (ignored when Skip AI is checked)">
      </div>

      <button id="run-btn" onclick="runAudit()">Run Audit</button>
    </div>

    <!-- Progress log -->
    <div class="log-area">
      <h3>Activity Log</h3>
      <ul id="log">
        <li><span class="dot done"></span><span class="text">Ready — enter a URL and click Run Audit</span></li>
      </ul>
    </div>

    <!-- Score bar (shown after audit) -->
    <div id="score-bar">
      <div class="score-chip">
        <span class="score-number" id="score-num">—</span>
        <div>
          <div id="score-grade" style="font-size:10px;font-weight:700"></div>
          <div class="score-label">SEO</div>
        </div>
      </div>
      <div class="score-chip">
        <span class="score-number" id="aeo-num" style="color:#7c3aed">—</span>
        <div>
          <div class="score-label">AEO</div>
        </div>
      </div>
      <div class="score-chip">
        <span class="score-number" id="geo-num" style="color:#0891b2">—</span>
        <div>
          <div class="score-label">GEO</div>
        </div>
      </div>
      <div class="stat">High&nbsp;<strong id="stat-high">—</strong></div>
      <div class="stat">Medium&nbsp;<strong id="stat-med">—</strong></div>
      <div class="export-btns" id="export-btns" style="display:none">
        <a class="export-btn primary" id="download-btn" href="#" download>⬇ PDF</a>
        <a class="export-btn" id="json-btn" href="#">{ } JSON</a>
        <a class="export-btn" id="csv-btn" href="#">📋 CSV</a>
        <a class="export-btn" id="html-btn" href="#" target="_blank">🌐 HTML</a>
      </div>
    </div>
  </div>

  <!-- RIGHT: report iframe -->
  <div class="panel-right">
    <div id="progress-bar-wrap"><div id="progress-bar"></div></div>
    <div id="placeholder">
      <div class="icon">📊</div>
      <p>Your audit report will appear here once the audit is complete.</p>
      <code>http://localhost:3000</code>
    </div>
    <iframe id="report-frame" title="SEO Audit Report"></iframe>
  </div>
</main>

<script>
  let es = null;
  let progressStep = 0;
  let currentReportId = null;

  function scoreColor(n) {
    if (n >= 80) return '#16a34a';
    if (n >= 60) return '#ca8a04';
    return '#dc2626';
  }
  function scoreGrade(n) {
    if (n >= 90) return 'A — Excellent';
    if (n >= 80) return 'B — Good';
    if (n >= 70) return 'C — Fair';
    if (n >= 60) return 'D — Poor';
    return 'F — Critical';
  }

  function log(text, type = 'active') {
    const ul = document.getElementById('log');
    ul.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
    const li = document.createElement('li');
    li.className = type;
    li.innerHTML = '<span class="dot"></span><span class="text">' + text + '</span>';
    ul.appendChild(li);
    ul.scrollTop = ul.scrollHeight;
  }

  function setProgress(pct) {
    const wrap = document.getElementById('progress-bar-wrap');
    const bar  = document.getElementById('progress-bar');
    wrap.classList.add('visible');
    bar.style.width = pct + '%';
  }

  function runAudit() {
    const urlVal   = document.getElementById('url-input').value.trim();
    const skipAI   = document.getElementById('skip-ai-check').checked;
    const model    = document.getElementById('model-input').value.trim();
    const industry = document.getElementById('industry-select').value;

    if (!urlVal) { document.getElementById('url-input').focus(); return; }

    if (es) { es.close(); es = null; }
    document.getElementById('log').innerHTML = '';
    document.getElementById('report-frame').classList.remove('visible');
    document.getElementById('placeholder').style.display = 'flex';
    document.getElementById('score-bar').classList.remove('visible');
    document.getElementById('export-btns').style.display = 'none';
    document.getElementById('run-btn').disabled = true;
    document.getElementById('run-btn').textContent = 'Auditing…';
    progressStep = 0;
    currentReportId = null;
    setProgress(5);

    const params = new URLSearchParams({ url: urlVal, skipAI: String(skipAI), model, industry });
    es = new EventSource('/audit?' + params.toString());

    es.addEventListener('progress', (e) => {
      const d = JSON.parse(e.data);
      log(d.message, 'active');
      progressStep++;
      setProgress(Math.min(85, 5 + progressStep * 7));
    });

    es.addEventListener('complete', (e) => {
      const d = JSON.parse(e.data);
      es.close(); es = null;
      currentReportId = d.reportId;

      log('✓ Audit complete in ' + (d.durationMs / 1000).toFixed(1) + 's · ' + d.checks + ' checks', 'done');

      setProgress(100);
      setTimeout(() => {
        document.getElementById('progress-bar-wrap').classList.remove('visible');
        document.getElementById('progress-bar').style.width = '0%';
      }, 800);

      // Score bar
      const scoreNum = document.getElementById('score-num');
      scoreNum.textContent = d.score;
      scoreNum.style.color = scoreColor(d.score);
      document.getElementById('score-grade').textContent = scoreGrade(d.score);
      document.getElementById('score-grade').style.color  = scoreColor(d.score);
      document.getElementById('aeo-num').textContent = d.aeoScore ?? '—';
      document.getElementById('geo-num').textContent = d.geoScore !== null && d.geoScore !== undefined ? d.geoScore : 'N/A';
      document.getElementById('stat-high').textContent  = d.high;
      document.getElementById('stat-med').textContent   = d.medium;
      document.getElementById('score-bar').classList.add('visible');

      // Export buttons
      const base = '/api/audit/' + d.reportId + '/export';
      document.getElementById('download-btn').href = d.downloadUrl;
      document.getElementById('json-btn').href     = base + '?format=json';
      document.getElementById('csv-btn').href      = base + '?format=csv';
      document.getElementById('html-btn').href     = base + '?format=html';
      document.getElementById('export-btns').style.display = 'flex';

      // Show report
      const frame = document.getElementById('report-frame');
      frame.src = d.reportUrl;
      frame.classList.add('visible');
      document.getElementById('placeholder').style.display = 'none';

      document.getElementById('run-btn').disabled = false;
      document.getElementById('run-btn').textContent = 'Run Audit';
    });

    es.addEventListener('error', (e) => {
      let msg = 'Audit failed';
      try { msg = JSON.parse(e.data).message; } catch (_) {}
      log('✗ ' + msg, 'err');
      es.close(); es = null;
      setProgress(0);
      document.getElementById('progress-bar-wrap').classList.remove('visible');
      document.getElementById('run-btn').disabled = false;
      document.getElementById('run-btn').textContent = 'Run Audit';
    });

    es.onerror = () => {
      if (es && es.readyState === EventSource.CLOSED) {
        log('Connection lost', 'err');
        document.getElementById('run-btn').disabled = false;
        document.getElementById('run-btn').textContent = 'Run Audit';
      }
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('url-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runAudit();
    });
    const skipCheck  = document.getElementById('skip-ai-check');
    const modelInput = document.getElementById('model-input');
    skipCheck.addEventListener('change', () => {
      modelInput.style.opacity = skipCheck.checked ? '0.3' : '1';
    });
  });
</script>

<footer style="border-top:1px solid var(--border);padding:14px 32px;display:flex;align-items:center;gap:20px;flex-wrap:wrap;background:var(--surface)">
  <a href="https://www.linkedin.com/in/pranjal-das1/" target="_blank" rel="noopener"
     style="font-size:12px;color:#7eb3f7;text-decoration:none;display:inline-flex;align-items:center;gap:5px">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
    linkedin.com/in/pranjal-das1
  </a>
  <a href="tel:+919707936319"
     style="font-size:12px;color:#7eb3f7;text-decoration:none;display:inline-flex;align-items:center;gap:5px">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
    </svg>
    +91-9707936319
  </a>
</footer>

</body>
</html>`;
