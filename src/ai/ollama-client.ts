import { Ollama } from 'ollama';
import { AuditReport } from '../types';

function buildPrompt(report: Omit<AuditReport, 'aiRecommendations'>): string {
  const failedChecks = report.checks
    .filter((c) => c.status !== 'pass')
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 20);

  const categoryBreakdown = report.categoryScores
    .map((cs) => `  - ${cs.category}: ${cs.score}/100 (${cs.checksFailed} failed, ${cs.checksWarning} warnings)`)
    .join('\n');

  const issuesList = failedChecks
    .map((c) => `  [${c.status.toUpperCase()}] [${c.severity.toUpperCase()}] ${c.name}: ${c.explanation}`)
    .join('\n');

  return `You are an expert SEO consultant. Analyse the following SEO audit results and provide actionable, prioritised recommendations.

AUDIT SUMMARY
=============
URL: ${report.url}
Overall SEO Score: ${report.overallScore}/100
Audit Date: ${report.auditedAt}

CATEGORY SCORES
===============
${categoryBreakdown}

TOP ISSUES FOUND
================
${issuesList}

QUICK WINS (low effort, high impact)
=====================================
${report.quickWins.map((c) => `  - ${c.name}: ${c.explanation}`).join('\n') || '  None identified'}

Please provide:
1. **Executive Summary** (2-3 sentences on overall SEO health)
2. **Top 5 Priority Fixes** (highest impact issues with specific action steps)
3. **Quick Wins** (3-5 fixes that take < 1 hour each)
4. **Content Strategy Recommendations** (based on content quality findings)
5. **Technical Health** (key technical issues to resolve)
6. **30-Day Action Plan** (prioritised list of tasks)

Be specific, actionable, and avoid generic advice. Reference actual issues found in the audit.`;
}

export async function generateRecommendations(
  report: Omit<AuditReport, 'aiRecommendations'>,
  model: string,
  host: string
): Promise<string> {
  try {
    const client = new Ollama({ host });
    const prompt = buildPrompt(report);

    const response = await client.generate({
      model,
      prompt,
      options: {
        temperature: 0.3,
        num_predict: 2048,
      },
      stream: false,
    });

    return response.response || 'No recommendations generated.';
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown Ollama error';
    if (message.includes('ECONNREFUSED') || message.includes('connect')) {
      return `⚠️  Ollama not available (${message}). Start Ollama with: ollama serve\nThen run: ollama pull ${model}`;
    }
    if (message.includes('model') || message.includes('not found')) {
      return `⚠️  Model "${model}" not found. Pull it with: ollama pull ${model}`;
    }
    return `⚠️  AI recommendations unavailable: ${message}`;
  }
}

/** Test Ollama connection and model availability. */
export async function testOllamaConnection(
  model: string,
  host: string
): Promise<{ available: boolean; error?: string }> {
  try {
    const client = new Ollama({ host });
    const list = await client.list();
    const hasModel = list.models.some(
      (m: { name: string }) => m.name === model || m.name.startsWith(model.split(':')[0])
    );
    if (!hasModel) {
      return {
        available: false,
        error: `Model "${model}" not found. Available: ${list.models.map((m: { name: string }) => m.name).join(', ') || 'none'}. Run: ollama pull ${model}`,
      };
    }
    return { available: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { available: false, error: `Cannot connect to Ollama at ${host}: ${message}` };
  }
}
