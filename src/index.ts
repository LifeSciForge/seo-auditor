#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import * as fs from 'fs';

import { auditUrl } from './auditor';
import { generatePdfReport, saveJsonReport } from './report/pdf-generator';
import { DEFAULT_OPTIONS, AuditOptions, AuditReport } from './types';
import { getScoreGrade } from './utils/scorer';
import { testOllamaConnection } from './ai/ollama-client';

const VERSION = '1.0.0';

// ─── CLI ──────────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name('seo-audit')
  .description('Comprehensive SEO audit tool with Ollama AI and PDF reports')
  .version(VERSION);

program
  .command('audit', { isDefault: true })
  .description('Audit one or more URLs')
  .option('-u, --url <url...>', 'URL(s) to audit (can repeat)')
  .option('-o, --output <path>', 'Output PDF path (default: ./seo-audit-<domain>.pdf)')
  .option('-m, --model <model>', `Ollama model (default: ${DEFAULT_OPTIONS.ollamaModel})`)
  .option('--ollama-host <host>', `Ollama host (default: ${DEFAULT_OPTIONS.ollamaHost})`)
  .option('--skip-ai', 'Skip AI recommendations (faster, offline)')
  .option('--industry <type>', 'Business type: generic|ecommerce|saas|content|local|research (default: generic)', 'generic')
  .option('--check-external', 'Also check external links for 404s')
  .option('--max-links <n>', 'Max internal links to check (default: 30)', '30')
  .option('--timeout <ms>', 'Per-request timeout in ms (default: 10000)', '10000')
  .option('--json', 'Also save JSON report alongside PDF')
  .option('-v, --verbose', 'Verbose output')
  .action(async (opts) => {
    const urls: string[] = opts.url || [];

    if (urls.length === 0) {
      console.error(chalk.red('Error: at least one --url is required.\n'));
      console.log('  Example: seo-audit --url https://example.com');
      console.log('  Example: seo-audit --url https://site1.com --url https://site2.com\n');
      process.exit(1);
    }

    const options: AuditOptions = {
      ...DEFAULT_OPTIONS,
      skipAI: !!opts.skipAi,
      checkExternalLinks: !!opts.checkExternal,
      maxLinksToCheck: parseInt(opts.maxLinks, 10) || 30,
      timeout: parseInt(opts.timeout, 10) || 10000,
      ollamaModel: opts.model || DEFAULT_OPTIONS.ollamaModel,
      ollamaHost: opts.ollamaHost || DEFAULT_OPTIONS.ollamaHost,
      outputPath: opts.output || '',
      verbose: !!opts.verbose,
      industry: opts.industry || 'generic',
    };

    // Pre-flight: test Ollama if not skipping AI
    if (!options.skipAI) {
      const spinner = ora('Checking Ollama connection...').start();
      const ollamaStatus = await testOllamaConnection(options.ollamaModel, options.ollamaHost);
      if (!ollamaStatus.available) {
        spinner.warn(chalk.yellow(`Ollama unavailable: ${ollamaStatus.error}`));
        console.log(chalk.dim('  → Continuing without AI recommendations. Use --skip-ai to suppress this warning.\n'));
        options.skipAI = true;
      } else {
        spinner.succeed(chalk.green(`Ollama ready with model: ${options.ollamaModel}`));
      }
    }

    const reports: AuditReport[] = [];

    for (const url of urls) {
      console.log(chalk.bold.blue(`\n${'═'.repeat(60)}`));
      console.log(chalk.bold.white(` Auditing: ${url}`));
      console.log(chalk.bold.blue('═'.repeat(60)));

      const spinner = ora({ text: 'Starting audit...', spinner: 'dots' }).start();

      try {
        const report = await auditUrl(url, options, (step) => {
          spinner.text = chalk.dim(step);
        });

        spinner.succeed(chalk.green('Audit complete'));
        reports.push(report);

        // Determine output path
        const outPath = options.outputPath ||
          `./seo-audit-${report.domain.replace(/[^a-zA-Z0-9.-]/g, '_')}.pdf`;

        // Print summary to console
        printSummary(report, options.verbose);

        // Generate PDF
        const pdfSpinner = ora('Generating PDF report...').start();
        try {
          const pdfPath = await generatePdfReport(report, outPath);
          pdfSpinner.succeed(chalk.green(`PDF saved: ${path.resolve(pdfPath)}`));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          pdfSpinner.fail(chalk.red(`PDF generation failed: ${msg}`));
        }

        // Optionally save JSON
        if (opts.json) {
          const jsonPath = saveJsonReport(report, outPath);
          console.log(chalk.dim(`  JSON saved: ${path.resolve(jsonPath)}`));
        }

      } catch (err: unknown) {
        spinner.fail(chalk.red(`Audit failed for ${url}`));
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`  Error: ${msg}`));
        if (options.verbose && err instanceof Error) {
          console.error(err.stack);
        }
      }
    }

    if (reports.length > 1) {
      printMultiSummary(reports);
    }

    console.log(chalk.dim('\nDone.\n'));
  });

// ─── Console output helpers ───────────────────────────────────────────────────

function printSummary(report: AuditReport, verbose: boolean): void {
  const grade = getScoreGrade(report.overallScore);
  const scoreColor = report.overallScore >= 80 ? 'green' :
    report.overallScore >= 60 ? 'yellow' : 'red';

  console.log('\n' + chalk.bold('Overall Score: ') +
    chalk[scoreColor].bold(`${report.overallScore}/100 (${grade.grade} — ${grade.label})`));

  console.log('\n' + chalk.bold('Category Scores:'));
  for (const cs of report.categoryScores) {
    const bar = scoreBar(cs.score);
    const col = cs.score >= 80 ? 'green' : cs.score >= 60 ? 'yellow' : 'red';
    console.log(
      `  ${chalk.bold(cs.category.padEnd(20))} ${chalk[col](bar)} ${chalk[col](cs.score + '/100')}` +
      chalk.dim(` (${cs.checksFailed} failed, ${cs.checksWarning} warns, ${cs.checksPassed} passed)`)
    );
  }

  console.log('\n' + chalk.bold('Summary:'));
  console.log(`  ${chalk.red.bold(String(report.summary.high).padStart(3))} high issues`);
  console.log(`  ${chalk.yellow.bold(String(report.summary.medium).padStart(3))} medium issues`);
  console.log(`  ${chalk.dim.bold(String(report.summary.low).padStart(3))} low issues`);
  console.log(`  ${chalk.green.bold(String(report.summary.passed).padStart(3))} checks passed`);

  if (report.topIssues.length > 0) {
    console.log('\n' + chalk.bold.red('⚡ Top Priority Issues:'));
    for (const issue of report.topIssues.slice(0, 5)) {
      const sev = issue.severity === 'high' ? chalk.red :
        issue.severity === 'medium' ? chalk.yellow : chalk.dim;
      console.log(`  ${sev('•')} ${chalk.bold(issue.name)}: ${chalk.dim(issue.explanation.slice(0, 100))}${issue.explanation.length > 100 ? '...' : ''}`);
    }
  }

  if (report.quickWins.length > 0) {
    console.log('\n' + chalk.bold.green('✨ Quick Wins (effort ≤ 2):'));
    for (const win of report.quickWins.slice(0, 5)) {
      console.log(`  ${chalk.green('•')} ${chalk.bold(win.name)} ${chalk.dim(`[impact: ${win.impactScore}]`)}`);
    }
  }

  if (verbose && report.aiRecommendations && !report.aiRecommendations.startsWith('⚠️')) {
    console.log('\n' + chalk.bold.blue('🤖 AI Recommendations (summary):'));
    console.log(chalk.dim(report.aiRecommendations.slice(0, 500) + '...'));
    console.log(chalk.dim('  (Full recommendations in PDF report)'));
  }

  console.log(chalk.dim(`\n  Audit took ${(report.durationMs / 1000).toFixed(1)}s · ${report.checks.length} checks run`));
}

function printMultiSummary(reports: AuditReport[]): void {
  console.log(chalk.bold.blue(`\n${'═'.repeat(60)}`));
  console.log(chalk.bold(' Multi-URL Summary'));
  console.log(chalk.bold.blue('═'.repeat(60)));

  for (const r of reports) {
    const grade = getScoreGrade(r.overallScore);
    const col = r.overallScore >= 80 ? 'green' : r.overallScore >= 60 ? 'yellow' : 'red';
    console.log(
      `  ${chalk[col].bold(`${r.overallScore}/100 ${grade.grade}`).padEnd(20)}  ` +
      `${chalk.bold(r.domain)}  ` +
      chalk.dim(`(${r.summary.high} high, ${r.summary.medium} medium)`)
    );
  }
}

function scoreBar(score: number, width = 20): string {
  const filled = Math.round((score / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

// ─── Entry ────────────────────────────────────────────────────────────────────

program.parse(process.argv);
