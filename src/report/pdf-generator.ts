import * as fs from 'fs';
import * as path from 'path';
import { AuditReport } from '../types';
import { buildHtmlReport } from './html-template';

export async function generatePdfReport(
  report: AuditReport,
  outputPath: string
): Promise<string> {
  // Ensure output directory exists
  const dir = path.dirname(path.resolve(outputPath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const html = buildHtmlReport(report);

  // Save HTML alongside PDF for debugging / browser viewing
  const htmlPath = outputPath.replace(/\.pdf$/i, '.html');
  fs.writeFileSync(htmlPath, html, 'utf-8');

  // Generate PDF via Playwright
  // Dynamic require to avoid import errors if playwright isn't installed
  let playwright: typeof import('playwright');
  try {
    playwright = require('playwright');
  } catch {
    // Playwright not installed — save HTML only and warn
    console.warn(
      '\n⚠️  Playwright not installed or browser not available. HTML report saved at:\n  ' +
      htmlPath +
      '\nTo generate PDF: npm install playwright && npx playwright install chromium'
    );
    return htmlPath;
  }

  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    // Set HTML content directly (no file:// URLs needed)
    await page.setContent(html, { waitUntil: 'networkidle' });

    // Wait a bit for any CSS animations to finish
    await page.waitForTimeout(500);

    const resolvedPath = path.resolve(outputPath);
    await page.pdf({
      path: resolvedPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        right: '8mm',
        bottom: '10mm',
        left: '8mm',
      },
    });

    return resolvedPath;
  } finally {
    await browser.close();
  }
}

/** Also write a JSON report for programmatic use */
export function saveJsonReport(report: AuditReport, outputPath: string): string {
  const jsonPath = outputPath.replace(/\.pdf$/i, '.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  return jsonPath;
}
