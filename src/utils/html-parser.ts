import * as cheerio from 'cheerio';
import { ParsedPage, ImageData, LinkData } from '../types';

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

export function parseHtml(html: string, url: string): ParsedPage {
  const $ = cheerio.load(html);
  const baseUrl = new URL(url);

  // ── Basic metadata ─────────────────────────────────────────────────────────
  const title = $('title').first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() || null;
  const canonical =
    $('link[rel="canonical"]').attr('href')?.trim() || null;
  const robotsMeta =
    $('meta[name="robots"]').attr('content')?.trim() || null;
  const lang = $('html').attr('lang')?.trim() || null;
  const viewport =
    $('meta[name="viewport"]').attr('content')?.trim() || null;

  // ── Headings ───────────────────────────────────────────────────────────────
  const h1s: string[] = [];
  const h2s: string[] = [];
  const h3s: string[] = [];
  const h4s: string[] = [];
  const headings: Array<{ level: number; text: string }> = [];

  $('h1').each((_, el) => {
    const t = $(el).text().trim();
    h1s.push(t);
    headings.push({ level: 1, text: t });
  });
  $('h2').each((_, el) => {
    const t = $(el).text().trim();
    h2s.push(t);
    headings.push({ level: 2, text: t });
  });
  $('h3').each((_, el) => {
    const t = $(el).text().trim();
    h3s.push(t);
    headings.push({ level: 3, text: t });
  });
  $('h4').each((_, el) => {
    const t = $(el).text().trim();
    h4s.push(t);
    headings.push({ level: 4, text: t });
  });

  // ── Images ─────────────────────────────────────────────────────────────────
  const images: ImageData[] = [];
  $('img').each((_, el) => {
    images.push({
      src: $(el).attr('src') || '',
      alt: $(el).attr('alt') ?? null,
      width: $(el).attr('width') ?? null,
      height: $(el).attr('height') ?? null,
      loading: $(el).attr('loading') ?? null,
    });
  });

  // ── Links ──────────────────────────────────────────────────────────────────
  const internalLinks: LinkData[] = [];
  const externalLinks: LinkData[] = [];
  const seenHrefs = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    const rel = ($(el).attr('rel') || '').split(/\s+/).filter(Boolean);

    // Skip mailto/tel/javascript/anchor-only
    if (/^(mailto:|tel:|javascript:|#)/.test(href)) return;

    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(href, url).href;
    } catch {
      return;
    }

    if (seenHrefs.has(absoluteUrl)) return;
    seenHrefs.add(absoluteUrl);

    try {
      const linkUrl = new URL(absoluteUrl);
      const isInternal = linkUrl.hostname === baseUrl.hostname;
      const linkData: LinkData = { href: absoluteUrl, text, rel, isInternal };

      if (isInternal) {
        internalLinks.push(linkData);
      } else {
        externalLinks.push(linkData);
      }
    } catch {
      // skip invalid
    }
  });

  // ── Schema.org JSON-LD ─────────────────────────────────────────────────────
  const schema: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || '{}';
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        schema.push(...parsed);
      } else {
        schema.push(parsed);
      }
    } catch {
      // invalid JSON
    }
  });

  // ── Open Graph ─────────────────────────────────────────────────────────────
  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = ($(el).attr('property') || '').replace('og:', '');
    const content = $(el).attr('content') || '';
    if (prop) openGraph[prop] = content;
  });

  // ── Dates ──────────────────────────────────────────────────────────────────
  const publishDate: string | null =
    $('meta[property="article:published_time"]').attr('content') ||
    $('meta[name="date"]').attr('content') ||
    $('time[itemprop="datePublished"]').attr('datetime') ||
    null;

  const modifiedDate: string | null =
    $('meta[property="article:modified_time"]').attr('content') ||
    $('meta[name="last-modified"]').attr('content') ||
    $('time[itemprop="dateModified"]').attr('datetime') ||
    null;

  // ── Forms & accessibility ──────────────────────────────────────────────────
  const hasForm = $('form').length > 0;
  let formInputsWithoutLabel = 0;

  $('input, textarea, select').each((_, el) => {
    const type = $(el).attr('type') || '';
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) return;

    const id = $(el).attr('id');
    const ariaLabel = $(el).attr('aria-label');
    const ariaLabelledBy = $(el).attr('aria-labelledby');
    const hasExplicitLabel = id ? $(`label[for="${id}"]`).length > 0 : false;

    if (!ariaLabel && !ariaLabelledBy && !hasExplicitLabel) {
      formInputsWithoutLabel++;
    }
  });

  // ── ARIA landmarks ─────────────────────────────────────────────────────────
  const ariaLandmarks: string[] = [];
  if ($('[role="main"], main').length > 0) ariaLandmarks.push('main');
  if ($('[role="navigation"], nav').length > 0) ariaLandmarks.push('navigation');
  if ($('[role="banner"], header').length > 0) ariaLandmarks.push('banner');
  if ($('[role="contentinfo"], footer').length > 0) ariaLandmarks.push('contentinfo');
  if ($('[role="search"]').length > 0) ariaLandmarks.push('search');

  // ── Skip link ──────────────────────────────────────────────────────────────
  const hasSkipLink =
    $('a[href="#main"], a[href="#content"], a[href="#main-content"], a[href="#skip"]').length > 0;

  // ── Body text (stripped of nav/header/footer/scripts) ─────────────────────
  const $c = cheerio.load(html);
  $c('script, style, noscript, svg, iframe, nav, header, footer').remove();
  const bodyText = $c('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = countWords(bodyText);

  return {
    url,
    title,
    metaDescription,
    canonical,
    robotsMeta,
    h1s,
    h2s,
    h3s,
    h4s,
    headings,
    images,
    internalLinks,
    externalLinks,
    schema,
    wordCount,
    lang,
    viewport,
    openGraph,
    publishDate,
    modifiedDate,
    hasForm,
    formInputsWithoutLabel,
    ariaLandmarks,
    hasSkipLink,
    bodyText,
  };
}
