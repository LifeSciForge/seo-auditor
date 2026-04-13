/**
 * AEO (Answer Engine Optimization) Checks
 * 45 checks across 4 subcategories optimizing for AI search engines
 * (Perplexity, ChatGPT, Gemini, SGE, etc.)
 */

import * as cheerio from 'cheerio';
import { CheckResult, FetchResult, ParsedPage } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function make(
  checkId: string,
  name: string,
  status: 'pass' | 'fail' | 'warning',
  severity: 'high' | 'medium' | 'low',
  currentValue: string | number | boolean | null,
  recommendedValue: string | number | boolean | null,
  explanation: string,
  impactScore: number,
  effortScore: number,
  affectedElements: string[] = []
): CheckResult {
  return {
    checkId,
    name,
    category: 'aeo-ai-search',
    severity,
    status,
    currentValue,
    recommendedValue,
    affectedElements,
    explanation,
    impactScore,
    effortScore,
  };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function containsPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

// ─── Subcategory 1: Content Structure (15 checks) ────────────────────────────

function checkFAQSection(html: string): CheckResult {
  const $ = cheerio.load(html);
  const hasFaqSchema = $('script[type="application/ld+json"]').toArray().some((el) => {
    const text = $(el).html() || '';
    return text.includes('FAQPage') || text.includes('faqPage');
  });
  const hasFaqText = /\b(faq|frequently asked|common questions)\b/i.test(html);
  const hasFaqHeading = $('h2, h3').toArray().some((el) => /faq|frequently asked/i.test($(el).text()));
  const dtCount = $('dt').length;
  const hasAccordion = $('[class*="faq"], [class*="accordion"], [id*="faq"]').length > 0;

  if (hasFaqSchema && (hasFaqText || hasFaqHeading)) {
    return make('aeo-faq-section', 'FAQ Section with Schema', 'pass', 'high', true, true,
      'FAQ section with FAQPage schema detected. AI engines can extract Q&A pairs directly.', 9, 3);
  }
  if (hasFaqText || hasFaqHeading || dtCount >= 3 || hasAccordion) {
    return make('aeo-faq-section', 'FAQ Section with Schema', 'warning', 'high', 'FAQ content present, no schema', 'Add FAQPage JSON-LD schema',
      'FAQ content detected but missing FAQPage schema markup. Add JSON-LD schema to help AI engines extract questions.', 9, 3);
  }
  return make('aeo-faq-section', 'FAQ Section with Schema', 'fail', 'high', false, 'Add FAQ section + FAQPage schema',
    'No FAQ section detected. FAQs are the highest-value AEO signal — AI engines use Q&A pairs for direct answers.', 9, 3);
}

function checkComparisonTable(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const tables = $('table').toArray();
  const hasComparisonWord = /\b(vs\.?|versus|compare|comparison|best|top \d+)\b/i.test(bodyText);
  const hasComparisonTable = tables.some((el) => {
    const tableText = $(el).text();
    return /vs|compare|best|feature|price/i.test(tableText);
  });

  if (hasComparisonTable) {
    return make('aeo-comparison-table', 'Comparison Tables', 'pass', 'medium', true, true,
      'Comparison table detected. AI engines prioritize structured comparisons for product/service queries.', 7, 4);
  }
  if (hasComparisonWord && tables.length > 0) {
    return make('aeo-comparison-table', 'Comparison Tables', 'warning', 'medium', 'Tables present, no comparison',
      'Add comparison rows (vs, pricing, features)', 'Tables present but no clear comparison structure. Format key comparisons as proper tables.', 7, 4);
  }
  return make('aeo-comparison-table', 'Comparison Tables', 'fail', 'medium', false, 'Add comparison table',
    'No comparison tables detected. "X vs Y" queries dominate AI search — structured tables win featured positions.', 7, 4);
}

function checkProsConsList(bodyText: string): CheckResult {
  const hasPros = /\b(pros?|advantages?|benefits?|strengths?)\b/i.test(bodyText);
  const hasCons = /\b(cons?|disadvantages?|drawbacks?|weaknesses?|limitations?)\b/i.test(bodyText);
  if (hasPros && hasCons) {
    return make('aeo-pros-cons', 'Pros & Cons Content', 'pass', 'medium', true, true,
      'Pros and cons content detected. Balanced analysis improves AI citation likelihood.', 7, 3);
  }
  if (hasPros || hasCons) {
    return make('aeo-pros-cons', 'Pros & Cons Content', 'warning', 'medium', 'Partial pros/cons', 'Add both pros and cons sections',
      'Only one side of pros/cons detected. Include both to give AI engines a complete analysis.', 7, 3);
  }
  return make('aeo-pros-cons', 'Pros & Cons Content', 'fail', 'low', false, 'Add pros & cons sections',
    'No pros/cons content. Adding structured pros and cons increases relevance for evaluative queries.', 7, 3);
}

function checkStepByStepInstructions(html: string): CheckResult {
  const $ = cheerio.load(html);
  const hasHowToSchema = $('script[type="application/ld+json"]').toArray().some((el) => {
    const t = $(el).html() || '';
    return t.includes('HowTo') || t.includes('howTo');
  });
  const hasOrderedList = $('ol').length > 0 && $('ol li').length >= 3;
  const hasStepText = /\bstep \d+\b|\b(step-by-step|how to|tutorial)\b/i.test($('body').text());

  if (hasHowToSchema && hasOrderedList) {
    return make('aeo-step-by-step', 'Step-by-Step Instructions', 'pass', 'high', true, true,
      'HowTo schema + ordered list detected. Optimal for AI-extracted procedural answers.', 9, 4);
  }
  if (hasOrderedList || hasStepText) {
    return make('aeo-step-by-step', 'Step-by-Step Instructions', 'warning', 'high', 'Steps present, no HowTo schema',
      'Add HowTo JSON-LD schema', 'Ordered steps detected but missing HowTo schema. Add schema to qualify for rich results.', 9, 4);
  }
  return make('aeo-step-by-step', 'Step-by-Step Instructions', 'fail', 'medium', false, 'Add HowTo content with schema',
    'No step-by-step instructions. "How to" queries represent 30%+ of voice searches — HowTo schema captures these.', 9, 4);
}

function checkNumberedLists(html: string): CheckResult {
  const $ = cheerio.load(html);
  const olCount = $('ol').length;
  const olItems = $('ol li').length;
  const ulItems = $('ul li').length;

  if (olCount >= 2 && olItems >= 5) {
    return make('aeo-numbered-lists', 'Structured List Usage', 'pass', 'medium', `${olCount} ordered lists`, '2+ ordered lists',
      'Good use of ordered lists. AI engines extract list items for "best X" and step-based answers.', 6, 2);
  }
  if (olCount >= 1 || ulItems >= 5) {
    return make('aeo-numbered-lists', 'Structured List Usage', 'warning', 'medium', `${olCount} ordered, ${ulItems} unordered items`,
      'Add more ordered lists for procedural content', 'Lists present but could be expanded. Numbered lists boost AI extractability.', 6, 2);
  }
  return make('aeo-numbered-lists', 'Structured List Usage', 'fail', 'low', 'No structured lists', 'Add ordered/unordered lists',
    'No structured lists detected. Lists are a primary signal for AI engines when generating summaries.', 6, 2);
}

function checkDefinitionContent(bodyText: string, html: string): CheckResult {
  const $ = cheerio.load(html);
  const hasDt = $('dl dt').length >= 2;
  const hasDefinitionPattern = /\b(is defined as|refers to|means|definition of|what is)\b/i.test(bodyText);
  const hasGlossary = /\b(glossary|terminology|key terms|definitions)\b/i.test(bodyText);

  if ((hasDt || hasGlossary) && hasDefinitionPattern) {
    return make('aeo-definition-content', 'Definition & Glossary Content', 'pass', 'medium', true, true,
      'Definition content with structured markup detected. Ideal for "what is X" AI queries.', 7, 4);
  }
  if (hasDefinitionPattern || hasDt) {
    return make('aeo-definition-content', 'Definition & Glossary Content', 'warning', 'medium', 'Definitions present, no DL markup',
      'Use <dl><dt><dd> for definitions', 'Definition patterns found but no semantic markup. Use definition lists for better AI parsing.', 7, 4);
  }
  return make('aeo-definition-content', 'Definition & Glossary Content', 'fail', 'low', false, 'Add glossary/definition sections',
    'No definition content. "What is X" queries are the most common AI search format — definitions capture them.', 7, 4);
}

function checkHowToSchema(html: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '');
  const hasHowTo = schemas.some((s) => s.includes('HowTo'));
  const hasArticle = schemas.some((s) => s.includes('Article') || s.includes('WebPage'));

  if (hasHowTo) {
    return make('aeo-howto-schema', 'HowTo Schema Markup', 'pass', 'high', 'HowTo schema present', 'HowTo schema',
      'HowTo schema implemented. Qualifies for Google rich results and AI engine procedural extraction.', 8, 3);
  }
  if (hasArticle) {
    return make('aeo-howto-schema', 'HowTo Schema Markup', 'warning', 'high', 'Article schema only', 'Add HowTo schema for instructional content',
      'Article/WebPage schema found but no HowTo. For instructional pages, HowTo schema adds significant value.', 8, 3);
  }
  return make('aeo-howto-schema', 'HowTo Schema Markup', 'fail', 'high', false, 'Add HowTo JSON-LD schema',
    'No schema markup for instructional content. HowTo schema can earn rich results and boost AI citations.', 8, 3);
}

function checkFeaturedSnippetFormat(bodyText: string, headings: Array<{ level: number; text: string }>): CheckResult {
  // Featured snippets are typically 40-60 word paragraphs that directly answer a question
  const paragraphs = bodyText.split(/\n+/).filter((p) => p.trim().length > 0);
  const snippetParagraphs = paragraphs.filter((p) => {
    const words = countWords(p);
    return words >= 40 && words <= 80;
  });
  const hasQuestionHeadings = headings.some((h) => /\?$/.test(h.text.trim()) || /^(what|how|why|when|where|which|who)\b/i.test(h.text));

  if (snippetParagraphs.length >= 2 && hasQuestionHeadings) {
    return make('aeo-featured-snippet', 'Featured Snippet Optimization', 'pass', 'high', `${snippetParagraphs.length} snippet-ready paragraphs`, '2+ paragraphs',
      'Featured snippet-ready paragraphs + question headings detected. Optimally formatted for AI extraction.', 9, 4);
  }
  if (snippetParagraphs.length >= 1 || hasQuestionHeadings) {
    return make('aeo-featured-snippet', 'Featured Snippet Optimization', 'warning', 'high',
      `${snippetParagraphs.length} snippets, ${hasQuestionHeadings ? 'has' : 'no'} question headings`,
      'Pair 40-60 word answers with question-format H2/H3',
      'Partial featured snippet optimization. Pair direct answer paragraphs (40-60 words) with question headings.', 9, 4);
  }
  return make('aeo-featured-snippet', 'Featured Snippet Optimization', 'fail', 'high', false, 'Add 40-60 word direct answers below question headings',
    'No featured snippet optimization. Direct answer paragraphs under question headings are the #1 AEO signal.', 9, 4);
}

function checkBestOfList(bodyText: string): CheckResult {
  const hasBestOf = /\b(best|top \d+|#\d|number \d|ranked|ranking)\b/i.test(bodyText);
  const hasListMarkers = /(\d+\.\s|\•|\-\s|✓)/.test(bodyText);
  if (hasBestOf && hasListMarkers) {
    return make('aeo-best-of-list', '"Best Of" List Content', 'pass', 'medium', true, true,
      '"Best of" list content with markers detected. Frequently cited in AI recommendation answers.', 7, 3);
  }
  if (hasBestOf || hasListMarkers) {
    return make('aeo-best-of-list', '"Best Of" List Content', 'warning', 'medium', 'Partial list signals', 'Add numbered "best of" list',
      'Some list signals present. Structure as numbered "Top X" list for maximum AI visibility.', 7, 3);
  }
  return make('aeo-best-of-list', '"Best Of" List Content', 'fail', 'low', false, 'Create a "Top X" ranked list',
    'No ranked list content. "Best X" queries are frequently answered by AI engines using list-format content.', 7, 3);
}

function checkProductComparison(bodyText: string, html: string): CheckResult {
  const $ = cheerio.load(html);
  const hasVs = /\b(\w+)\s+vs\.?\s+(\w+)/i.test(bodyText);
  const hasCompareTable = $('table').toArray().some((el) => /feature|plan|price|compare/i.test($(el).text()));
  if (hasVs && hasCompareTable) {
    return make('aeo-product-comparison', 'Product/Service Comparison', 'pass', 'high', true, true,
      'Product comparison table with vs. content. Critical for AI-generated buying guides.', 8, 4);
  }
  if (hasVs || hasCompareTable) {
    return make('aeo-product-comparison', 'Product/Service Comparison', 'warning', 'high', 'Partial comparison', 'Combine vs. content with a comparison table',
      'Partial comparison signals. Combine "X vs Y" headings with a feature comparison table.', 8, 4);
  }
  return make('aeo-product-comparison', 'Product/Service Comparison', 'fail', 'medium', false, 'Add product comparison section',
    'No comparison content. AI engines frequently generate comparison summaries — structured content improves citation.', 8, 4);
}

function checkStatisticsData(bodyText: string): CheckResult {
  const statPatterns = [/\d+%/, /\$[\d,]+/, /\d+[\s,]\d{3}/, /\bstudy\b|\bsurvey\b|\breport\b|\bstatistic/i, /\baccording to\b/i];
  const matchCount = statPatterns.filter((p) => p.test(bodyText)).length;
  if (matchCount >= 3) {
    return make('aeo-stats-data', 'Statistics & Data Citations', 'pass', 'medium', `${matchCount} data signals`, '3+ data signals',
      'Multiple statistics and citations detected. Data-backed content is preferred by AI engines for credibility.', 7, 5);
  }
  if (matchCount >= 1) {
    return make('aeo-stats-data', 'Statistics & Data Citations', 'warning', 'medium', `${matchCount} data signal(s)`, 'Add 3+ cited statistics',
      'Some data present but sparse. AI engines prefer content with specific statistics and cited sources.', 7, 5);
  }
  return make('aeo-stats-data', 'Statistics & Data Citations', 'fail', 'medium', false, 'Add statistics with source citations',
    'No statistical data detected. Facts and figures dramatically increase AI citation likelihood.', 7, 5);
}

function checkExpertQuotes(bodyText: string, html: string): CheckResult {
  const $ = cheerio.load(html);
  const hasBlockquote = $('blockquote').length > 0;
  const hasQuoteText = /"([^"]{20,})"/.test(bodyText);
  const hasCitedSource = /\baccording to\b|\bsaid\b|\bstated\b|\bquoted\b/i.test(bodyText);
  if (hasBlockquote && hasCitedSource) {
    return make('aeo-expert-quotes', 'Expert Quotes & Citations', 'pass', 'medium', true, true,
      'Blockquotes with source attribution detected. Expert voices boost E-A-T and AI trust signals.', 6, 4);
  }
  if (hasBlockquote || (hasQuoteText && hasCitedSource)) {
    return make('aeo-expert-quotes', 'Expert Quotes & Citations', 'warning', 'medium', 'Partial quote signals', 'Add <blockquote> with attribution',
      'Some quote signals present. Use <blockquote> with clear attribution for semantic richness.', 6, 4);
  }
  return make('aeo-expert-quotes', 'Expert Quotes & Citations', 'fail', 'low', false, 'Add expert quotes with <blockquote>',
    'No expert quotes. Attributed quotes from industry authorities increase content credibility for AI engines.', 6, 4);
}

function checkTableOfContents(html: string): CheckResult {
  const $ = cheerio.load(html);
  const hasToc = $('[class*="toc"], [class*="table-of-contents"], [id*="toc"]').length > 0;
  const hasTocLinks = $('a[href^="#"]').length >= 4;
  const hasTocHeading = $('h2, h3').toArray().some((el) => /table of contents|contents|jump to/i.test($(el).text()));
  if ((hasToc || hasTocHeading) && hasTocLinks) {
    return make('aeo-table-of-contents', 'Table of Contents', 'pass', 'medium', true, true,
      'Table of contents with anchor links detected. Improves content navigability for AI crawlers.', 6, 2);
  }
  if (hasTocLinks && !hasToc) {
    return make('aeo-table-of-contents', 'Table of Contents', 'warning', 'medium', 'Anchor links present, no TOC section',
      'Add a labelled "Table of Contents" section', 'Anchor links found but no formal TOC. Label with a heading for clear AI parsing.', 6, 2);
  }
  return make('aeo-table-of-contents', 'Table of Contents', 'fail', 'low', false, 'Add table of contents for long pages',
    'No table of contents. For long-form content, TOCs help AI engines navigate and extract relevant sections.', 6, 2);
}

function checkTLDRSection(bodyText: string, html: string): CheckResult {
  const $ = cheerio.load(html);
  const hasTldr = /\b(tl;?dr|too long|key takeaway|summary|in summary|conclusion|in brief)\b/i.test(bodyText);
  const hasSummaryHeading = $('h2, h3').toArray().some((el) => /summary|conclusion|key takeaway|tldr/i.test($(el).text()));
  if (hasTldr && hasSummaryHeading) {
    return make('aeo-tldr-section', 'TL;DR / Summary Section', 'pass', 'medium', true, true,
      'Summary/TL;DR section detected. AI engines often pull summary sections for quick answers.', 7, 2);
  }
  if (hasTldr || hasSummaryHeading) {
    return make('aeo-tldr-section', 'TL;DR / Summary Section', 'warning', 'medium', 'Partial summary signals', 'Add a dedicated "Key Takeaways" heading',
      'Summary content present but not clearly labeled. Use a "Key Takeaways" H2 for better AI extraction.', 7, 2);
  }
  return make('aeo-tldr-section', 'TL;DR / Summary Section', 'fail', 'low', false, 'Add TL;DR or Key Takeaways section',
    'No summary section. A TL;DR or Key Takeaways box dramatically improves AI snippet extraction.', 7, 2);
}

function checkQuestionHeadings(headings: Array<{ level: number; text: string }>): CheckResult {
  const questionHeadings = headings.filter((h) =>
    h.level <= 3 && (/\?$/.test(h.text.trim()) || /^(what|how|why|when|where|which|who|can|is|are|does|do)\b/i.test(h.text))
  );
  const ratio = headings.length > 0 ? questionHeadings.length / headings.length : 0;

  if (questionHeadings.length >= 3 && ratio >= 0.3) {
    return make('aeo-question-headings', 'Question-Format Headings', 'pass', 'high', `${questionHeadings.length} question headings`,
      '3+ question headings', 'Multiple question-format headings detected. Directly maps to conversational AI queries.', 8, 2);
  }
  if (questionHeadings.length >= 1) {
    return make('aeo-question-headings', 'Question-Format Headings', 'warning', 'high', `${questionHeadings.length} of ${headings.length} headings are questions`,
      'Convert 30%+ of H2/H3 to question format', 'Some question headings present. Increase to 30%+ of headings for better AEO performance.', 8, 2);
  }
  return make('aeo-question-headings', 'Question-Format Headings', 'fail', 'high', '0 question headings', 'Rewrite H2/H3 as questions',
    'No question-format headings. AI search queries are conversational — match them with question-style H2/H3 headings.', 8, 2);
}

// ─── Subcategory 2: E-A-T Signals (8 checks) ─────────────────────────────────

function checkAuthorBio(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const hasAuthorSchema = $('script[type="application/ld+json"]').toArray().some((el) => {
    const t = $(el).html() || '';
    return t.includes('"author"') || t.includes('Person');
  });
  const hasAuthorSection = $('[class*="author"], [class*="byline"], [rel="author"]').length > 0;
  const hasAuthorText = /\b(written by|author:|by [A-Z])\b/i.test(bodyText);

  if (hasAuthorSchema && hasAuthorSection) {
    return make('aeo-author-bio', 'Author Bio & Credentials', 'pass', 'high', true, true,
      'Author schema + author bio section detected. E-A-T compliance — AI engines favor authored content.', 8, 4);
  }
  if (hasAuthorSection || hasAuthorText) {
    return make('aeo-author-bio', 'Author Bio & Credentials', 'warning', 'high', 'Author text present, no schema',
      'Add Person schema + credentials section', 'Author information found but missing schema. Add JSON-LD Person schema with author credentials.', 8, 4);
  }
  return make('aeo-author-bio', 'Author Bio & Credentials', 'fail', 'high', false, 'Add author bio with Person schema',
    'No author attribution. Google and AI engines penalize anonymous content — author expertise is a core E-A-T signal.', 8, 4);
}

function checkExpertCredentials(bodyText: string): CheckResult {
  const credentials = [/\bPh\.?D\b/, /\bM\.?D\b/, /\bM\.?B\.?A\b/, /\bcertified\b/i, /\bexpert\b/i,
    /\byears of experience\b/i, /\bspecialist\b/i, /\bprofessional\b/i, /\blicensed\b/i];
  const found = credentials.filter((r) => r.test(bodyText));
  if (found.length >= 3) {
    return make('aeo-credentials', 'Expert Credentials Display', 'pass', 'medium', `${found.length} credential signals`, '3+ credential signals',
      'Multiple expertise indicators detected. Strong E-A-T signals improve AI citation probability.', 7, 5);
  }
  if (found.length >= 1) {
    return make('aeo-credentials', 'Expert Credentials Display', 'warning', 'medium', `${found.length} credential signal(s)`, 'Add more specific credentials',
      'Some credentials mentioned. Be more specific: include certifications, years of experience, professional titles.', 7, 5);
  }
  return make('aeo-credentials', 'Expert Credentials Display', 'fail', 'medium', false, 'Add author credentials and expertise signals',
    'No credentials found. Demonstrating expertise is a primary E-A-T requirement for AI engine trust.', 7, 5);
}

function checkAboutPage(html: string, internalLinks: Array<{ href: string; text: string }>): CheckResult {
  const hasAboutLink = internalLinks.some((l) => /\babout\b/i.test(l.text) || /\/about/i.test(l.href));
  const hasAboutInHtml = /\/about(-us)?["'>]/i.test(html);
  if (hasAboutLink || hasAboutInHtml) {
    return make('aeo-about-page', 'About Page Link', 'pass', 'medium', true, true,
      'Link to About page detected. About pages are a core E-A-T trust signal for AI engines.', 6, 1);
  }
  return make('aeo-about-page', 'About Page Link', 'fail', 'medium', false, 'Add/link to About Us page',
    'No About page link. About pages establish brand credibility — required for E-A-T compliance.', 6, 1);
}

function checkContactInfo(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const hasContactLink = $('a[href*="contact"], a[href*="mailto"]').length > 0;
  const hasPhone = /(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/.test(bodyText);
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(bodyText);
  const signals = [hasContactLink, hasPhone, hasEmail].filter(Boolean).length;

  if (signals >= 2) {
    return make('aeo-contact-info', 'Contact Information', 'pass', 'medium', `${signals} contact signals`, '2+ contact signals',
      'Multiple contact signals detected. Transparency in contact info is a core trust indicator.', 6, 2);
  }
  if (signals === 1) {
    return make('aeo-contact-info', 'Contact Information', 'warning', 'medium', `${signals} contact signal`, 'Add phone + email + contact page',
      'Limited contact information. AI engines and users need multiple contact options for trust.', 6, 2);
  }
  return make('aeo-contact-info', 'Contact Information', 'fail', 'high', false, 'Add contact page, phone, and email',
    'No contact information. Businesses without contact info are flagged as low-trust by AI engines and Google.', 6, 2);
}

function checkPrivacyPolicy(html: string): CheckResult {
  const hasPrivacy = /privacy(-policy)?|terms(-of-service|-and-conditions)?/i.test(html);
  if (hasPrivacy) {
    return make('aeo-privacy-policy', 'Privacy Policy & Legal Pages', 'pass', 'medium', true, true,
      'Privacy policy / terms links detected. Legal pages are required for GDPR compliance and AI engine trust.', 5, 1);
  }
  return make('aeo-privacy-policy', 'Privacy Policy & Legal Pages', 'fail', 'medium', false, 'Add Privacy Policy and Terms pages',
    'No privacy policy detected. Required for legal compliance and AI engine trust scoring.', 5, 1);
}

function checkExternalCitations(html: string): CheckResult {
  const $ = cheerio.load(html);
  const externalLinks = $('a[href^="http"]').toArray()
    .filter((el) => {
      const href = $(el).attr('href') || '';
      return !href.includes($.root().find('meta[property="og:url"]').attr('content') || '');
    });
  const citationCount = externalLinks.length;

  if (citationCount >= 5) {
    return make('aeo-citations', 'External Source Citations', 'pass', 'high', `${citationCount} external links`, '5+ citations',
      `${citationCount} outbound citation links detected. External citations signal authoritative, research-backed content.`, 8, 4);
  }
  if (citationCount >= 2) {
    return make('aeo-citations', 'External Source Citations', 'warning', 'high', `${citationCount} external links`, '5+ citations',
      `Only ${citationCount} outbound links. Add 5+ citations to authoritative sources to boost E-A-T.`, 8, 4);
  }
  return make('aeo-citations', 'External Source Citations', 'fail', 'high', `${citationCount} external links`, '5+ citations from authority sites',
    'No external citations. AI engines favor content that references authoritative sources — add citations to studies, reports, and experts.', 8, 4);
}

function checkCertificationsAwards(bodyText: string): CheckResult {
  const signals = [/\bawarded?\b|\baward-winning\b/i, /\bcertified?\b|\bcertification\b/i,
    /\bISO\b/, /\baccredited?\b/i, /\brecognized by\b/i, /\bfeatured in\b/i, /\bpartner of\b/i];
  const found = signals.filter((r) => r.test(bodyText)).length;
  if (found >= 2) {
    return make('aeo-certifications', 'Certifications & Awards', 'pass', 'medium', `${found} recognition signals`, '2+ recognition signals',
      'Certifications and recognition signals detected. Industry validation improves authority scores.', 6, 5);
  }
  if (found === 1) {
    return make('aeo-certifications', 'Certifications & Awards', 'warning', 'medium', `${found} recognition signal`, 'Add more certifications/awards',
      'Limited recognition signals. Showcase certifications, partnerships, and awards prominently.', 6, 5);
  }
  return make('aeo-certifications', 'Certifications & Awards', 'fail', 'low', false, 'Add certification badges and awards',
    'No certification or award signals. Industry recognition boosts both E-A-T and conversion rates.', 6, 5);
}

function checkPublicationDate(publishDate: string | null, modifiedDate: string | null): CheckResult {
  if (publishDate && modifiedDate) {
    return make('aeo-publication-date', 'Content Publication & Update Dates', 'pass', 'medium',
      `Published: ${publishDate}, Updated: ${modifiedDate}`, 'Both dates present',
      'Publication and modification dates detected. Freshness signals help AI engines prioritize content.', 6, 2);
  }
  if (publishDate || modifiedDate) {
    return make('aeo-publication-date', 'Content Publication & Update Dates', 'warning', 'medium',
      publishDate || modifiedDate || 'One date present', 'Add both publish and last-updated dates',
      'Only one date found. Include both original publication and last-updated dates for full freshness signaling.', 6, 2);
  }
  return make('aeo-publication-date', 'Content Publication & Update Dates', 'fail', 'medium', false, 'Add published and last-updated dates',
    'No publication dates. AI engines deprioritize undated content — always show when content was published and updated.', 6, 2);
}

// ─── Subcategory 3: Natural Language (12 checks) ─────────────────────────────

function checkConversationalTone(bodyText: string): CheckResult {
  const contractions = (bodyText.match(/\b(you're|we're|it's|don't|can't|isn't|won't|they're|I'm)\b/gi) || []).length;
  const secondPerson = (bodyText.match(/\byou\b/gi) || []).length;
  const wordCount = countWords(bodyText);
  const conversationalRatio = wordCount > 0 ? (contractions + secondPerson) / wordCount : 0;

  if (conversationalRatio >= 0.02) {
    return make('aeo-conversational-tone', 'Conversational Tone', 'pass', 'medium', `${(conversationalRatio * 100).toFixed(1)}% conversational markers`,
      '2%+ conversational markers', 'Good conversational tone. Matches the natural language patterns of voice and AI queries.', 6, 3);
  }
  if (conversationalRatio >= 0.01) {
    return make('aeo-conversational-tone', 'Conversational Tone', 'warning', 'medium', `${(conversationalRatio * 100).toFixed(1)}% conversational markers`,
      'Increase contractions and "you" usage', 'Somewhat conversational. Increase use of "you" and contractions to match voice query patterns.', 6, 3);
  }
  return make('aeo-conversational-tone', 'Conversational Tone', 'fail', 'low', 'Formal/technical writing style', 'Use "you", contractions, and direct address',
    'Overly formal tone. AI search queries are conversational — content should match with natural language patterns.', 6, 3);
}

function checkDirectAnswer(bodyText: string, headings: Array<{ level: number; text: string }>): CheckResult {
  const paragraphs = bodyText.split(/\n+/).filter((p) => p.trim().length > 20);
  const firstParagraph = paragraphs[0] || '';
  const firstParaWords = countWords(firstParagraph);
  const isDirectAnswer = firstParaWords >= 30 && firstParaWords <= 100;
  const startsWithAnswer = /^(yes|no|[A-Z][\w\s]+ is|[A-Z][\w\s]+ are|the best|to|in order to)\b/i.test(firstParagraph.trim());

  if (isDirectAnswer && startsWithAnswer) {
    return make('aeo-direct-answer', 'Direct Answer in Opening', 'pass', 'high', `${firstParaWords} words, direct opening`, 'Direct 30-100 word answer',
      'Direct answer in opening paragraph. AI engines extract opening answers for featured snippets.', 9, 3);
  }
  if (isDirectAnswer || startsWithAnswer) {
    return make('aeo-direct-answer', 'Direct Answer in Opening', 'warning', 'high', `${firstParaWords} word opening paragraph`, 'Start with direct answer (30-100 words)',
      'Opening could be more direct. Begin with a clear, concise answer before elaborating.', 9, 3);
  }
  return make('aeo-direct-answer', 'Direct Answer in Opening', 'fail', 'high', 'No direct opening answer', 'Write direct answer in first 100 words',
    'No direct answer in opening. AI engines favor pages that answer the query immediately — put the answer first.', 9, 3);
}

function checkSemanticKeywords(bodyText: string, title: string | null): CheckResult {
  // Check for LSI/semantic keyword density — related terms beyond the main keyword
  const wordFreq: Record<string, number> = {};
  bodyText.toLowerCase().split(/\W+/).filter((w) => w.length > 4).forEach((w) => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
  const uniqueTerms = Object.keys(wordFreq).length;
  const topTerm = Object.entries(wordFreq).sort((a, b) => b[1] - a[1])[0];
  const topTermDensity = topTerm ? topTerm[1] / Object.values(wordFreq).reduce((a, b) => a + b, 0) : 0;

  if (uniqueTerms >= 100 && topTermDensity < 0.05) {
    return make('aeo-semantic-keywords', 'Semantic Keyword Coverage', 'pass', 'medium', `${uniqueTerms} unique terms`, '100+ unique terms, <5% density',
      'Good semantic keyword variety detected. Broad vocabulary signals topic expertise to AI engines.', 7, 4);
  }
  if (uniqueTerms >= 50) {
    return make('aeo-semantic-keywords', 'Semantic Keyword Coverage', 'warning', 'medium', `${uniqueTerms} unique terms`, '100+ unique semantic terms',
      'Moderate vocabulary. Expand with related terms, synonyms, and topic subtopics.', 7, 4);
  }
  return make('aeo-semantic-keywords', 'Semantic Keyword Coverage', 'fail', 'medium', `${uniqueTerms} unique terms`, '100+ semantically related terms',
    'Limited vocabulary/semantic coverage. AI engines evaluate topical authority by breadth of related terms.', 7, 4);
}

function checkLongTailPhrases(bodyText: string): CheckResult {
  const longTailPatterns = [/\b(how to|what is|why does|when should|best way to|how much|which is better)\b/gi,
    /\b\w+ for (beginners?|professionals?|small business|enterprise)\b/gi,
    /\b(step by step|complete guide|ultimate guide|beginner.s guide)\b/gi];
  const matches = longTailPatterns.flatMap((p) => bodyText.match(p) || []);

  if (matches.length >= 5) {
    return make('aeo-long-tail', 'Long-Tail Keyword Phrases', 'pass', 'medium', `${matches.length} long-tail phrases`, '5+ long-tail phrases',
      `${matches.length} long-tail phrases detected. Long-tail queries dominate AI voice search.`, 7, 3);
  }
  if (matches.length >= 2) {
    return make('aeo-long-tail', 'Long-Tail Keyword Phrases', 'warning', 'medium', `${matches.length} long-tail phrases`, '5+ long-tail phrases',
      'Some long-tail phrases present. Add more question-format and contextual keyword phrases.', 7, 3);
  }
  return make('aeo-long-tail', 'Long-Tail Keyword Phrases', 'fail', 'low', '0-1 long-tail phrases', '5+ long-tail phrases',
    'No long-tail keyword optimization. Long-tail phrases match 70% of search queries — optimize for them.', 7, 3);
}

function checkVoiceSearchPhrases(bodyText: string): CheckResult {
  const voicePatterns = [/\b(near me|in my area|open now|today)\b/i,
    /\b(how do I|what should I|can you|where can I|when is)\b/i,
    /\b(best .+ for me|should I|is .+ worth it)\b/i];
  const found = voicePatterns.filter((p) => p.test(bodyText)).length;

  if (found >= 2) {
    return make('aeo-voice-search', 'Voice Search Optimization', 'pass', 'medium', `${found} voice patterns`, '2+ voice patterns',
      'Voice search patterns detected. Content matches how people speak to AI assistants.', 7, 3);
  }
  if (found === 1) {
    return make('aeo-voice-search', 'Voice Search Optimization', 'warning', 'medium', `${found} voice pattern`, '2+ voice patterns',
      'Limited voice optimization. Add conversational phrases that match how people speak to Alexa/Siri.', 7, 3);
  }
  return make('aeo-voice-search', 'Voice Search Optimization', 'fail', 'medium', 'No voice patterns', 'Add natural language, conversational phrases',
    'No voice search optimization. Voice queries are 3x longer than typed queries — optimize for spoken language.', 7, 3);
}

function checkEntityMentions(bodyText: string, domain: string): CheckResult {
  // Check for entity mentions — brand names, places, people, organizations
  const capitalized = (bodyText.match(/\b[A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)*\b/g) || []);
  const uniqueEntities = new Set(capitalized.filter((e) => e.length > 3)).size;

  if (uniqueEntities >= 15) {
    return make('aeo-entities', 'Named Entity Coverage', 'pass', 'medium', `${uniqueEntities} unique entities`, '15+ entities',
      `${uniqueEntities} named entities detected. Rich entity coverage signals comprehensive topic knowledge.`, 6, 5);
  }
  if (uniqueEntities >= 5) {
    return make('aeo-entities', 'Named Entity Coverage', 'warning', 'medium', `${uniqueEntities} entities`, '15+ named entities',
      'Some entities present. Add more brand names, locations, people, and organizations to increase topical depth.', 6, 5);
  }
  return make('aeo-entities', 'Named Entity Coverage', 'fail', 'low', `${uniqueEntities} entities`, '15+ named entities',
    'Low entity coverage. Named entities (brands, places, people) are core NLP signals for AI engines.', 6, 5);
}

function checkTopicDepth(bodyText: string, headings: Array<{ level: number; text: string }>): CheckResult {
  const wordCount = countWords(bodyText);
  const h2Count = headings.filter((h) => h.level === 2).length;
  const h3Count = headings.filter((h) => h.level === 3).length;

  if (wordCount >= 1500 && h2Count >= 4 && h3Count >= 3) {
    return make('aeo-topic-depth', 'Topic Depth & Comprehensiveness', 'pass', 'high',
      `${wordCount} words, ${h2Count} H2s, ${h3Count} H3s`, '1500+ words, 4+ H2, 3+ H3',
      'Comprehensive topic coverage detected. Deep content is preferred by AI engines for authoritative answers.', 8, 6);
  }
  if (wordCount >= 800 && h2Count >= 2) {
    return make('aeo-topic-depth', 'Topic Depth & Comprehensiveness', 'warning', 'high',
      `${wordCount} words, ${h2Count} H2s`, '1500+ words with multiple subtopics',
      'Moderate depth. Expand to 1500+ words covering all aspects of the topic comprehensively.', 8, 6);
  }
  return make('aeo-topic-depth', 'Topic Depth & Comprehensiveness', 'fail', 'high',
    `${wordCount} words, ${h2Count} H2s`, '1500+ words, comprehensive coverage',
    `Thin content (${wordCount} words). AI engines favor the most comprehensive answer — aim for 1500+ words with multiple subtopics.`, 8, 6);
}

function checkShortSentences(bodyText: string): CheckResult {
  const sentences = bodyText.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  if (sentences.length === 0) return make('aeo-short-sentences', 'NLP-Friendly Sentence Length', 'warning', 'low', null, '15-20 words avg', 'No sentences detected.', 4, 2);

  const avgWords = sentences.reduce((sum, s) => sum + countWords(s), 0) / sentences.length;
  if (avgWords <= 20) {
    return make('aeo-short-sentences', 'NLP-Friendly Sentence Length', 'pass', 'low', `${avgWords.toFixed(1)} words avg`, '≤20 words avg',
      'Good sentence length for NLP parsing. Short sentences improve AI readability and extraction accuracy.', 4, 2);
  }
  if (avgWords <= 28) {
    return make('aeo-short-sentences', 'NLP-Friendly Sentence Length', 'warning', 'low', `${avgWords.toFixed(1)} words avg`, '≤20 words avg',
      'Sentences slightly long. Aim for 15-20 words average for optimal NLP parsing by AI engines.', 4, 2);
  }
  return make('aeo-short-sentences', 'NLP-Friendly Sentence Length', 'fail', 'low', `${avgWords.toFixed(1)} words avg`, '≤20 words avg',
    `Long average sentence length (${avgWords.toFixed(1)} words). Break sentences down — AI NLP parsers prefer ≤20 words.`, 4, 2);
}

function checkDefinitionStyleContent(bodyText: string): CheckResult {
  const defPatterns = [/\b\w+ (is|are) (a|an|the)\b/gi, /\bwhat (is|are)\b/gi, /\bdefined as\b/gi, /\brefers to\b/gi];
  const matches = defPatterns.flatMap((p) => bodyText.match(p) || []);
  if (matches.length >= 4) {
    return make('aeo-definition-style', 'Definition-Style Content', 'pass', 'medium', `${matches.length} definition patterns`, '4+ definition patterns',
      'Strong definition-style writing. "X is a Y that does Z" format is directly extractable by AI.', 7, 3);
  }
  if (matches.length >= 1) {
    return make('aeo-definition-style', 'Definition-Style Content', 'warning', 'medium', `${matches.length} pattern(s)`, '4+ definition patterns',
      'Some definitions present. Use "X is a Y that does Z" pattern more consistently.', 7, 3);
  }
  return make('aeo-definition-style', 'Definition-Style Content', 'fail', 'low', '0 definition patterns', 'Write in "X is a Y that does Z" format',
    'No definition-style content. AI engines extract definitional sentences to answer "what is" queries.', 7, 3);
}

function checkWhoWhatWhy(bodyText: string, headings: Array<{ level: number; text: string }>): CheckResult {
  const fundamentals = {
    what: /\bwhat\b/i.test(bodyText),
    how: /\bhow\b/i.test(bodyText),
    why: /\bwhy\b/i.test(bodyText),
    when: /\bwhen\b/i.test(bodyText),
  };
  const covered = Object.values(fundamentals).filter(Boolean).length;

  if (covered >= 3) {
    return make('aeo-who-what-why', 'Who/What/Why/How Coverage', 'pass', 'medium', `${covered}/4 questions covered`, '3+ fundamental questions',
      'Covers multiple fundamental questions (what/how/why/when). Comprehensive for AI answer generation.', 7, 4);
  }
  if (covered >= 2) {
    return make('aeo-who-what-why', 'Who/What/Why/How Coverage', 'warning', 'medium', `${covered}/4 questions`, '3+ fundamental questions',
      'Covers some fundamental questions. Add what/how/why/when sections for complete topic coverage.', 7, 4);
  }
  return make('aeo-who-what-why', 'Who/What/Why/How Coverage', 'fail', 'medium', `${covered}/4 questions`, 'Cover what, how, why, when',
    'Incomplete question coverage. AI engines build answers by combining what/how/why/when content.', 7, 4);
}

function checkFeaturedSnippetLength(bodyText: string): CheckResult {
  const paragraphs = bodyText.split(/\n+/).filter((p) => p.trim().length > 0);
  const perfect = paragraphs.filter((p) => { const w = countWords(p); return w >= 40 && w <= 60; });
  if (perfect.length >= 2) {
    return make('aeo-snippet-length', 'Optimal Snippet-Length Answers', 'pass', 'high', `${perfect.length} optimal paragraphs`, '2+ paragraphs at 40-60 words',
      `${perfect.length} paragraphs at the ideal 40-60 word snippet length. Google extracts exactly these for featured snippets.`, 9, 3);
  }
  if (perfect.length === 1) {
    return make('aeo-snippet-length', 'Optimal Snippet-Length Answers', 'warning', 'high', '1 optimal paragraph', '2+ paragraphs at 40-60 words',
      'One snippet-optimized paragraph. Add more 40-60 word answer paragraphs under question headings.', 9, 3);
  }
  return make('aeo-snippet-length', 'Optimal Snippet-Length Answers', 'fail', 'high', '0 optimal paragraphs', 'Write answer paragraphs of exactly 40-60 words',
    'No snippet-optimized paragraphs. The 40-60 word sweet spot is what Google/AI engines extract for featured answers.', 9, 3);
}

// ─── Subcategory 4: Reviews & Social Proof (10 checks) ───────────────────────

function checkReviewSchema(html: string): CheckResult {
  const $ = cheerio.load(html);
  const schemas = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '');
  const hasReview = schemas.some((s) => s.includes('"Review"') || s.includes('"AggregateRating"'));
  if (hasReview) {
    return make('aeo-review-schema', 'Review Schema Markup', 'pass', 'high', 'Review/AggregateRating schema', 'Review schema present',
      'Review schema detected. Enables star ratings in search results and AI citation with rating data.', 8, 3);
  }
  return make('aeo-review-schema', 'Review Schema Markup', 'fail', 'high', false, 'Add AggregateRating schema',
    'No review schema. AggregateRating schema enables star ratings in SERPs and signals quality to AI engines.', 8, 3);
}

function checkAverageRating(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const ratingSchema = $('script[type="application/ld+json"]').toArray().map((el) => $(el).html() || '')
    .join('');
  const ratingMatch = ratingSchema.match(/"ratingValue"\s*:\s*"?([\d.]+)"?/);
  const bodyRating = bodyText.match(/(\d+\.?\d*)\s*(out of 5|\/5|stars?|★)/i);

  if (ratingMatch || bodyRating) {
    const rating = ratingMatch ? ratingMatch[1] : (bodyRating ? bodyRating[1] : 'unknown');
    return make('aeo-average-rating', 'Average Star Rating Visible', 'pass', 'high', `${rating} stars`, '4.0+ star rating visible',
      `Star rating (${rating}) detected. Ratings prominently displayed and schema-marked improve CTR by 20-30%.`, 7, 2);
  }
  return make('aeo-average-rating', 'Average Star Rating Visible', 'fail', 'high', false, 'Display star rating with schema',
    'No star rating visible. Display your average rating prominently with AggregateRating schema.', 7, 2);
}

function checkReviewCount(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const reviewCountMatch = bodyText.match(/(\d+[\+,]?\d*)\s*(reviews?|ratings?|customers?|users?)/i);
  const schemaCount = $('script[type="application/ld+json"]').toArray()
    .map((el) => $(el).html() || '').join('');
  const schemaMatch = schemaCount.match(/"reviewCount"\s*:\s*(\d+)/);

  if (schemaMatch) {
    const count = parseInt(schemaMatch[1]);
    const status = count >= 10 ? 'pass' : 'warning';
    return make('aeo-review-count', 'Review Count Display', status, 'medium', `${count} reviews`, '10+ reviews',
      status === 'pass'
        ? `${count} reviews in schema. Good social proof volume for AI engine trust.`
        : `Only ${count} reviews. Build up to 10+ for strong social proof.`, 7, 5);
  }
  if (reviewCountMatch) {
    return make('aeo-review-count', 'Review Count Display', 'warning', 'medium', reviewCountMatch[0], 'Add review count to schema',
      'Review count found in text but not in schema. Add reviewCount to AggregateRating schema.', 7, 5);
  }
  return make('aeo-review-count', 'Review Count Display', 'fail', 'medium', '0 reviews', '10+ reviews with schema',
    'No review count. Displaying the number of reviews builds trust and improves AI citation probability.', 7, 5);
}

function checkTestimonialsSection(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const hasTestimonialClass = $('[class*="testimonial"], [class*="review"], [class*="quote"]').length > 0;
  const hasTestimonialText = /\b(testimonial|what our customers say|customer review|client say)\b/i.test(bodyText);
  if (hasTestimonialClass && hasTestimonialText) {
    return make('aeo-testimonials', 'Customer Testimonials Section', 'pass', 'high', true, true,
      'Testimonials section with semantic markup detected. Social proof is a primary conversion and trust signal.', 7, 4);
  }
  if (hasTestimonialClass || hasTestimonialText) {
    return make('aeo-testimonials', 'Customer Testimonials Section', 'warning', 'high', 'Partial testimonials', 'Add labelled testimonials section',
      'Some testimonial signals. Add a clearly marked "What Our Customers Say" section for maximum impact.', 7, 4);
  }
  return make('aeo-testimonials', 'Customer Testimonials Section', 'fail', 'high', false, 'Add customer testimonials section',
    'No testimonials section. Customer testimonials increase conversion by 34% and build AI-readable social proof.', 7, 4);
}

function checkCaseStudies(bodyText: string): CheckResult {
  const hasCaseStudy = /\bcase study\b|\bsuccess story\b|\bclient story\b|\bcustomer story\b/i.test(bodyText);
  const hasResults = /\b(\d+%|\$[\d,]+)\s+(increase|decrease|growth|reduction|improvement)/i.test(bodyText);
  if (hasCaseStudy && hasResults) {
    return make('aeo-case-studies', 'Case Studies & Results', 'pass', 'medium', true, true,
      'Case study with quantified results detected. Specific outcomes are highly cited by AI engines.', 7, 6);
  }
  if (hasCaseStudy || hasResults) {
    return make('aeo-case-studies', 'Case Studies & Results', 'warning', 'medium', 'Partial case study signals', 'Add quantified case study results',
      'Some case study signals present. Add specific metrics (e.g., "300% increase in traffic") for AI citation.', 7, 6);
  }
  return make('aeo-case-studies', 'Case Studies & Results', 'fail', 'low', false, 'Create a case studies section with metrics',
    'No case studies. AI engines cite specific results from case studies — add quantified success stories.', 7, 6);
}

function checkSocialProof(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const signals = [
    $('[class*="social"], [class*="share"], [class*="counter"]').length > 0,
    /\b(\d+[\+,k]+)\s+(customers?|users?|clients?|businesses?)\b/i.test(bodyText),
    /\b(trusted by|used by|loved by|join .+ community)\b/i.test(bodyText),
    /\b(\d+[\+,]+)\s+(downloads?|installs?|members?|subscribers?)\b/i.test(bodyText),
  ];
  const count = signals.filter(Boolean).length;
  if (count >= 2) {
    return make('aeo-social-proof', 'Social Proof Indicators', 'pass', 'medium', `${count} social proof signals`, '2+ signals',
      `${count} social proof indicators detected. Numbers and social validation build AI engine and user trust.`, 7, 4);
  }
  if (count === 1) {
    return make('aeo-social-proof', 'Social Proof Indicators', 'warning', 'medium', `${count} signal`, '2+ social proof signals',
      'Limited social proof. Add customer counts, trust indicators, and community size numbers.', 7, 4);
  }
  return make('aeo-social-proof', 'Social Proof Indicators', 'fail', 'medium', false, 'Add customer count, user numbers, trust badges',
    'No social proof indicators. "Trusted by 5,000+ businesses" type signals dramatically improve trust.', 7, 4);
}

function checkTrustBadges(html: string): CheckResult {
  const $ = cheerio.load(html);
  const hasTrustBadge = $('[class*="badge"], [class*="trust"], [class*="secure"], [class*="certified"]').length > 0;
  const hasSslMention = /\b(secure|ssl|https|encrypted|safe checkout)\b/i.test($('body').text());
  const hasGuarantee = /\b(guarantee|money.back|refund|30.day|risk.free)\b/i.test($('body').text());
  const signals = [hasTrustBadge, hasSslMention, hasGuarantee].filter(Boolean).length;

  if (signals >= 2) {
    return make('aeo-trust-badges', 'Trust Badges & Security Signals', 'pass', 'medium', `${signals} trust signals`, '2+ trust signals',
      'Multiple trust signals detected. Security and guarantee signals reduce purchase anxiety.', 6, 3);
  }
  if (signals === 1) {
    return make('aeo-trust-badges', 'Trust Badges & Security Signals', 'warning', 'medium', `${signals} trust signal`, '2+ trust signals',
      'Limited trust signals. Add security badges, money-back guarantees, and SSL indicators.', 6, 3);
  }
  return make('aeo-trust-badges', 'Trust Badges & Security Signals', 'fail', 'low', false, 'Add security badges and guarantee seals',
    'No trust badges. Security and guarantee signals increase conversion by up to 42%.', 6, 3);
}

function checkVerifiedReviews(html: string): CheckResult {
  const $ = cheerio.load(html);
  const bodyText = $('body').text();
  const hasVerified = /\b(verified|verified purchase|verified buyer|verified customer)\b/i.test(bodyText);
  const hasPlatformReviews = /\b(google reviews?|trustpilot|g2|capterra|yelp)\b/i.test(bodyText);
  if (hasVerified && hasPlatformReviews) {
    return make('aeo-verified-reviews', 'Verified Review Platform Integration', 'pass', 'high', true, true,
      'Verified reviews from trusted platforms detected. Third-party verification is the strongest social proof signal.', 8, 4);
  }
  if (hasVerified || hasPlatformReviews) {
    return make('aeo-verified-reviews', 'Verified Review Platform Integration', 'warning', 'high', 'Partial verification signals', 'Link to Trustpilot/G2/Google Reviews',
      'Some verified review signals. Connect verified review platform widget (Trustpilot, G2, Google).', 8, 4);
  }
  return make('aeo-verified-reviews', 'Verified Review Platform Integration', 'fail', 'high', false, 'Integrate Trustpilot, G2, or Google Reviews',
    'No verified reviews. Third-party verified reviews are the most credible social proof for AI engines and users.', 8, 4);
}

function checkUGCSignals(html: string, bodyText: string): CheckResult {
  const $ = cheerio.load(html);
  const hasComments = $('[class*="comment"], [class*="discussion"], [id*="comments"]').length > 0;
  const hasUGC = /\b(community|forum|user.generated|Q&A|questions? & answers?)\b/i.test(bodyText);
  const hasRating = $('[class*="rating"], [class*="stars"], [itemprop="ratingValue"]').length > 0;

  if ((hasComments || hasUGC) && hasRating) {
    return make('aeo-ugc', 'User-Generated Content Signals', 'pass', 'medium', true, true,
      'UGC signals with ratings detected. User-generated content significantly boosts freshness and trust.', 6, 5);
  }
  if (hasComments || hasUGC || hasRating) {
    return make('aeo-ugc', 'User-Generated Content Signals', 'warning', 'medium', 'Partial UGC signals', 'Add comment system + user ratings',
      'Some UGC present. Add a comment section or Q&A for ongoing fresh content.', 6, 5);
  }
  return make('aeo-ugc', 'User-Generated Content Signals', 'fail', 'low', false, 'Add comments, Q&A, or user ratings',
    'No UGC signals. User reviews and comments signal active community trust to AI engines.', 6, 5);
}

function checkExpertEndorsements(bodyText: string): CheckResult {
  const patterns = [/\b(endorsed by|recommended by|as seen in|featured in|approved by)\b/i,
    /\b(expert|doctor|professor|CEO|founder|industry leader)\b/i,
    /\b(Forbes|TechCrunch|Wired|Bloomberg|Inc\.)\b/i];
  const found = patterns.filter((p) => p.test(bodyText)).length;
  if (found >= 2) {
    return make('aeo-expert-endorsements', 'Expert & Media Endorsements', 'pass', 'medium', `${found} endorsement signals`, '2+ signals',
      'Expert/media endorsements detected. Authority signals from third parties dramatically improve credibility.', 7, 6);
  }
  if (found === 1) {
    return make('aeo-expert-endorsements', 'Expert & Media Endorsements', 'warning', 'medium', `${found} signal`, '2+ endorsement signals',
      'Limited endorsements. Add more "as featured in" or expert recommendation signals.', 7, 6);
  }
  return make('aeo-expert-endorsements', 'Expert & Media Endorsements', 'fail', 'low', false, 'Add media features or expert endorsements',
    'No expert endorsements. "As seen in Forbes" type signals build instant authority with both users and AI.', 7, 6);
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function runAEOChecks(
  url: string,
  fetchResult: FetchResult,
  parsed: ParsedPage
): CheckResult[] {
  const html = fetchResult.html || '';
  const bodyText = parsed.bodyText || '';
  const headings = parsed.headings || [];
  const domain = new URL(fetchResult.finalUrl || url).hostname;

  return [
    // Content Structure (15)
    checkFAQSection(html),
    checkComparisonTable(html, bodyText),
    checkProsConsList(bodyText),
    checkStepByStepInstructions(html),
    checkNumberedLists(html),
    checkDefinitionContent(bodyText, html),
    checkHowToSchema(html),
    checkFeaturedSnippetFormat(bodyText, headings),
    checkBestOfList(bodyText),
    checkProductComparison(bodyText, html),
    checkStatisticsData(bodyText),
    checkExpertQuotes(bodyText, html),
    checkTableOfContents(html),
    checkTLDRSection(bodyText, html),
    checkQuestionHeadings(headings),

    // E-A-T Signals (8)
    checkAuthorBio(html, bodyText),
    checkExpertCredentials(bodyText),
    checkAboutPage(html, parsed.internalLinks),
    checkContactInfo(html, bodyText),
    checkPrivacyPolicy(html),
    checkExternalCitations(html),
    checkCertificationsAwards(bodyText),
    checkPublicationDate(parsed.publishDate, parsed.modifiedDate),

    // Natural Language (12)
    checkConversationalTone(bodyText),
    checkDirectAnswer(bodyText, headings),
    checkSemanticKeywords(bodyText, parsed.title),
    checkLongTailPhrases(bodyText),
    checkVoiceSearchPhrases(bodyText),
    checkEntityMentions(bodyText, domain),
    checkTopicDepth(bodyText, headings),
    checkShortSentences(bodyText),
    checkDefinitionStyleContent(bodyText),
    checkWhoWhatWhy(bodyText, headings),
    checkFeaturedSnippetLength(bodyText),

    // Reviews & Social Proof (10)
    checkReviewSchema(html),
    checkAverageRating(html, bodyText),
    checkReviewCount(html, bodyText),
    checkTestimonialsSection(html, bodyText),
    checkCaseStudies(bodyText),
    checkSocialProof(html, bodyText),
    checkTrustBadges(html),
    checkVerifiedReviews(html),
    checkUGCSignals(html, bodyText),
    checkExpertEndorsements(bodyText),
  ];
}
