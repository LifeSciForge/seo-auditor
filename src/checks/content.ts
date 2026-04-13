import { CheckResult, ParsedPage } from '../types';

type Cat = 'content-quality';
const CAT: Cat = 'content-quality';

function pass(id: string, name: string, expl: string, impact: number, effort: number): CheckResult {
  return { checkId: id, name, category: CAT, severity: 'low', status: 'pass',
    currentValue: null, recommendedValue: null, affectedElements: [], explanation: expl, impactScore: impact, effortScore: effort };
}
function fail(id: string, name: string, sev: CheckResult['severity'], cur: CheckResult['currentValue'],
  rec: CheckResult['recommendedValue'], aff: string[], expl: string, impact: number, effort: number): CheckResult {
  return { checkId: id, name, category: CAT, severity: sev, status: 'fail',
    currentValue: cur, recommendedValue: rec, affectedElements: aff, explanation: expl, impactScore: impact, effortScore: effort };
}
function warn(id: string, name: string, cur: CheckResult['currentValue'], rec: CheckResult['recommendedValue'],
  aff: string[], expl: string, impact: number, effort: number): CheckResult {
  return { checkId: id, name, category: CAT, severity: 'medium', status: 'warning',
    currentValue: cur, recommendedValue: rec, affectedElements: aff, explanation: expl, impactScore: impact, effortScore: effort };
}

/** Count vowel groups as a syllable approximation for Flesch-Kincaid. */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  const matches = w.replace(/(?:[^laeiouy]|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

/** Returns Flesch Reading Ease score (0-100, higher = easier). */
function fleschReadingEase(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (sentences.length === 0 || words.length === 0) return 0;

  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function readabilityLabel(score: number): string {
  if (score >= 80) return 'Very Easy (5th grade)';
  if (score >= 70) return 'Easy (6th grade)';
  if (score >= 60) return 'Standard (7th-8th grade)';
  if (score >= 50) return 'Fairly Difficult (10th-12th grade)';
  if (score >= 30) return 'Difficult (college level)';
  return 'Very Difficult (professional)';
}

/** Find top N non-stop words by frequency for keyword density analysis. */
const STOP_WORDS = new Set([
  'the','and','is','in','it','of','to','a','an','that','this','was','for','on',
  'are','with','as','at','be','by','from','or','but','not','we','you','they',
  'he','she','have','had','do','did','will','would','could','should','may','can',
  'more','all','also','about','into','than','then','some','so','if','up','out',
  'its','our','your','has','been','were','their','there','which','who','when',
  'what','how','one','two','three','said','new','just','like','time','get',
]);

function keywordDensity(text: string): Array<{ word: string; count: number; density: number }> {
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const total = words.length;
  const freq: Record<string, number> = {};
  for (const w of words) {
    if (!STOP_WORDS.has(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .map(([word, count]) => ({ word, count, density: (count / total) * 100 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export function runContentChecks(parsed: ParsedPage): CheckResult[] {
  const results: CheckResult[] = [];

  // 1. Word count
  const wc = parsed.wordCount;
  if (wc >= 600) {
    results.push(pass('word-count', 'Content Length', `${wc} words — strong content depth.`, 8, 5));
  } else if (wc >= 300) {
    results.push(warn('word-count', 'Content Length', `${wc} words`, '≥ 600 words',
      [], `Content has ${wc} words. For competitive keywords, aim for 600+ words to demonstrate topical depth and relevance.`, 8, 5));
  } else if (wc >= 100) {
    results.push(fail('word-count', 'Content Length', 'medium', `${wc} words`, '≥ 300 words minimum',
      [], `Thin content: only ${wc} words. Google's Panda algorithm targets thin content. Expand with relevant, helpful information.`, 8, 5));
  } else {
    results.push(fail('word-count', 'Content Length', 'high', `${wc} words`, '≥ 300 words minimum',
      [], `Critically thin content: only ${wc} words. This page is at risk of being considered low-quality. Add substantial, useful content.`, 8, 5));
  }

  // 2. Readability (Flesch-Kincaid)
  if (parsed.bodyText.length > 100) {
    const score = fleschReadingEase(parsed.bodyText);
    const label = readabilityLabel(score);

    if (score >= 60) {
      results.push(pass('readability', 'Content Readability', `Flesch Reading Ease: ${score}/100 — ${label}`, 6, 5));
    } else if (score >= 40) {
      results.push(warn('readability', 'Content Readability', `Score: ${score}/100 (${label})`,
        '≥ 60 (Standard readability)', [],
        `Content may be difficult to read (Flesch score: ${score}). For most web audiences, aim for a score of 60+ (7th-8th grade level). Use shorter sentences and simpler words.`, 6, 5));
    } else {
      results.push(fail('readability', 'Content Readability', 'low', `Score: ${score}/100 (${label})`,
        '≥ 60', [],
        `Very difficult content (Flesch score: ${score}). High reading difficulty increases bounce rate. Simplify language, use bullet points, and shorten paragraphs.`, 6, 5));
    }
  }

  // 3. Content freshness
  if (parsed.publishDate || parsed.modifiedDate) {
    const dateStr = parsed.modifiedDate || parsed.publishDate || '';
    const date = new Date(dateStr);
    const ageMonths = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30);

    if (ageMonths < 6) {
      results.push(pass('content-freshness', 'Content Freshness',
        `Page has a recent date signal: ${dateStr}`, 6, 3));
    } else if (ageMonths < 18) {
      results.push(warn('content-freshness', 'Content Freshness',
        `Last updated: ~${Math.round(ageMonths)} months ago`, '< 6 months',
        [], `Content is ${Math.round(ageMonths)} months old. For time-sensitive topics, update content regularly to maintain freshness signals.`, 6, 3));
    } else {
      results.push(fail('content-freshness', 'Content Freshness', 'low',
        `~${Math.round(ageMonths)} months old`, '< 12 months for evergreen content',
        [], `Content appears stale (~${Math.round(ageMonths)} months old). Google favours fresh content for many query types. Review and update this page.`, 6, 3));
    }
  } else {
    results.push(warn('content-freshness', 'Content Freshness', 'No date signals found',
      'Publish/modified date in meta tags', [],
      'No date metadata detected. Add article:published_time and article:modified_time meta tags to send freshness signals to search engines.', 5, 2));
  }

  // 4. Keyword density — flag over-optimisation
  if (parsed.bodyText.length > 200) {
    const keywords = keywordDensity(parsed.bodyText);
    const overOptimised = keywords.filter((k) => k.density > 5);
    if (overOptimised.length > 0) {
      results.push(warn('keyword-density', 'Keyword Density',
        overOptimised.map((k) => `"${k.word}": ${k.density.toFixed(1)}%`).join(', '),
        '1-3% for target keyword',
        overOptimised.map((k) => `"${k.word}" used ${k.count} times (${k.density.toFixed(1)}%)`),
        `Potential keyword stuffing: ${overOptimised.map((k) => `"${k.word}" at ${k.density.toFixed(1)}%`).join(', ')}. Natural keyword density should be 1-3%. Over-use can trigger Panda penalties.`, 7, 3));
    } else {
      const topKw = keywords.slice(0, 3).map((k) => `"${k.word}" (${k.density.toFixed(1)}%)`).join(', ');
      results.push(pass('keyword-density', 'Keyword Density',
        `Natural keyword usage. Top keywords: ${topKw || 'none detected'}`, 7, 3));
    }
  }

  // 5. Duplicate title / H1 match check
  if (parsed.title && parsed.h1s.length === 1) {
    const titleNorm = parsed.title.toLowerCase().trim();
    const h1Norm = parsed.h1s[0].toLowerCase().trim();
    const similarity = titleNorm === h1Norm;
    if (similarity) {
      results.push(warn('title-h1-duplicate', 'Title vs H1 Uniqueness',
        'Title and H1 are identical', 'Distinct but related',
        [`Title: "${parsed.title}"`, `H1: "${parsed.h1s[0]}"`],
        'Title tag and H1 are identical. Consider making them distinct — the title can be more SERP-focused (with brand), and H1 more reader-focused, giving you two keyword variation opportunities.', 4, 2));
    } else {
      results.push(pass('title-h1-duplicate', 'Title vs H1 Uniqueness',
        'Title and H1 are distinct — good for keyword variation.', 4, 2));
    }
  }

  return results;
}
