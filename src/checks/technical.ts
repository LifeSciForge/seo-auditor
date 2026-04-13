import { CheckResult, FetchResult, ParsedPage } from '../types';
import { fetchPage } from '../utils/crawler';

type Cat = 'technical-seo';
const CAT: Cat = 'technical-seo';

function pass(
  id: string, name: string, explanation: string,
  impact: number, effort: number
): CheckResult {
  return {
    checkId: id, name, category: CAT, severity: 'low', status: 'pass',
    currentValue: null, recommendedValue: null, affectedElements: [],
    explanation, impactScore: impact, effortScore: effort,
  };
}

function fail(
  id: string, name: string, severity: CheckResult['severity'],
  current: CheckResult['currentValue'], recommended: CheckResult['recommendedValue'],
  affected: string[], explanation: string, impact: number, effort: number
): CheckResult {
  return {
    checkId: id, name, category: CAT, severity, status: 'fail',
    currentValue: current, recommendedValue: recommended, affectedElements: affected,
    explanation, impactScore: impact, effortScore: effort,
  };
}

function warn(
  id: string, name: string,
  current: CheckResult['currentValue'], recommended: CheckResult['recommendedValue'],
  affected: string[], explanation: string, impact: number, effort: number
): CheckResult {
  return {
    checkId: id, name, category: CAT, severity: 'medium', status: 'warning',
    currentValue: current, recommendedValue: recommended, affectedElements: affected,
    explanation, impactScore: impact, effortScore: effort,
  };
}

export async function runTechnicalChecks(
  url: string,
  fetchResult: FetchResult,
  parsed: ParsedPage
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const baseUrl = new URL(url);

  // 1. HTTPS
  if (url.startsWith('https://')) {
    results.push(pass('https', 'HTTPS Encryption', 'Site uses HTTPS — a confirmed Google ranking factor.', 9, 4));
  } else {
    results.push(fail('https', 'HTTPS Encryption', 'high', 'HTTP', 'HTTPS',
      [url], 'Site uses HTTP. HTTPS is a confirmed ranking factor and required for user trust and Chrome "Secure" badge.', 9, 4));
  }

  // 2. HTTP status code
  const status = fetchResult.statusCode;
  if (status === 200) {
    results.push(pass('status-code', 'HTTP Status Code', `Page returns HTTP 200 OK.`, 10, 1));
  } else if (status >= 400) {
    results.push(fail('status-code', 'HTTP Status Code', 'high', `HTTP ${status}`, 'HTTP 200',
      [url], `Page returned HTTP ${status}. This page cannot be indexed by search engines.`, 10, 2));
  } else if (status === 0) {
    results.push(fail('status-code', 'HTTP Status Code', 'high', `Connection failed`, 'HTTP 200',
      [url], fetchResult.error || 'Could not connect to the server.', 10, 3));
  }

  // 3. Server response time (TTFB proxy)
  const rt = fetchResult.responseTimeMs;
  if (rt < 200) {
    results.push(pass('response-time', 'Server Response Time (TTFB)', `TTFB is ${rt}ms — excellent.`, 7, 5));
  } else if (rt < 600) {
    results.push(warn('response-time', 'Server Response Time (TTFB)',
      `${rt}ms`, '< 200ms', [],
      `Server response time is ${rt}ms. Target under 200ms for a Good TTFB Core Web Vital score.`, 7, 5));
  } else if (rt < 1500) {
    results.push(fail('response-time', 'Server Response Time (TTFB)', 'medium',
      `${rt}ms`, '< 200ms', [],
      `Slow TTFB of ${rt}ms. This will hurt Core Web Vitals and user experience. Consider server upgrades, caching, or a CDN.`, 7, 4));
  } else {
    results.push(fail('response-time', 'Server Response Time (TTFB)', 'high',
      `${rt}ms`, '< 200ms', [],
      `Very slow TTFB of ${rt}ms. Critical performance issue. Users see a blank page for ${(rt / 1000).toFixed(1)}s. Immediate action required.`, 7, 4));
  }

  // 4. Redirect chain
  const chainLen = fetchResult.redirectChain.length;
  if (chainLen === 0) {
    results.push(pass('redirect-chain', 'Redirect Chain', 'No redirects — direct URL access.', 6, 3));
  } else if (chainLen === 1) {
    results.push(warn('redirect-chain', 'Redirect Chain',
      `${chainLen} redirect`, '0 redirects',
      fetchResult.redirectChain.map((r) => `${r.url} (${r.statusCode})`),
      `1 redirect detected. Each hop adds ~100-300ms of latency. Reduce to direct URL where possible.`, 6, 3));
  } else {
    results.push(fail('redirect-chain', 'Redirect Chain', 'medium',
      `${chainLen} redirects`, '≤ 1 redirect',
      fetchResult.redirectChain.map((r) => `${r.url} (${r.statusCode})`),
      `${chainLen}-hop redirect chain detected. Each redirect adds latency and dilutes PageRank. Fix URLs to go direct.`, 6, 3));
  }

  // 5. robots.txt
  try {
    const robotsUrl = `${baseUrl.protocol}//${baseUrl.host}/robots.txt`;
    const robotsFetch = await fetchPage(robotsUrl, 5000);
    if (robotsFetch.statusCode === 200 && robotsFetch.html.includes('User-agent')) {
      const disallowsRoot = /^Disallow:\s*\/\s*$/m.test(robotsFetch.html);
      if (disallowsRoot) {
        results.push(fail('robots-txt', 'robots.txt', 'high',
          'Disallow: /', 'Allow crawling',
          [robotsUrl], 'robots.txt blocks ALL crawlers with "Disallow: /". The entire site is de-indexed. Remove this rule immediately.', 10, 1));
      } else {
        results.push(pass('robots-txt', 'robots.txt', 'robots.txt found with valid User-agent rules.', 7, 2));
      }
    } else if (robotsFetch.statusCode === 404) {
      results.push(warn('robots-txt', 'robots.txt', 'Missing (404)', 'Exists',
        [robotsUrl], 'No robots.txt found. Create one to guide crawlers and reference your sitemap.', 5, 1));
    } else {
      results.push(warn('robots-txt', 'robots.txt', `HTTP ${robotsFetch.statusCode}`, 'HTTP 200',
        [robotsUrl], `robots.txt returned status ${robotsFetch.statusCode}. Ensure it is publicly accessible.`, 5, 1));
    }
  } catch {
    results.push(warn('robots-txt', 'robots.txt', 'Error fetching', 'Accessible',
      [], 'Could not fetch robots.txt. Verify it exists and is accessible.', 5, 1));
  }

  // 6. sitemap.xml
  try {
    const sitemapUrl = `${baseUrl.protocol}//${baseUrl.host}/sitemap.xml`;
    const sitemapFetch = await fetchPage(sitemapUrl, 5000);
    if (sitemapFetch.statusCode === 200) {
      const body = sitemapFetch.html;
      if (body.includes('<urlset') || body.includes('<sitemapindex')) {
        results.push(pass('sitemap-xml', 'XML Sitemap', 'Valid XML sitemap found at /sitemap.xml.', 7, 2));
      } else {
        results.push(warn('sitemap-xml', 'XML Sitemap', 'Invalid XML', 'Valid <urlset> or <sitemapindex>',
          [sitemapUrl], 'sitemap.xml exists but is not valid XML. Check for malformed XML or wrong content type.', 6, 3));
      }
    } else {
      results.push(warn('sitemap-xml', 'XML Sitemap', 'Missing', 'Exists',
        [], 'No sitemap.xml at default location. Create one and reference it in robots.txt to help search engines discover pages.', 6, 2));
    }
  } catch {
    results.push(warn('sitemap-xml', 'XML Sitemap', 'Error', 'Accessible', [], 'Could not fetch sitemap.xml.', 6, 2));
  }

  // 7. Canonical tag
  if (parsed.canonical) {
    try {
      const canonicalAbs = new URL(parsed.canonical, url).href;
      const normalBase = url.replace(/\/$/, '').toLowerCase();
      const normalCanon = canonicalAbs.replace(/\/$/, '').toLowerCase();
      if (normalBase === normalCanon) {
        results.push(pass('canonical', 'Canonical Tag', `Self-referencing canonical present: ${parsed.canonical}`, 8, 2));
      } else {
        results.push(warn('canonical', 'Canonical Tag',
          parsed.canonical, url,
          [`<link rel="canonical" href="${parsed.canonical}">`],
          `Canonical points to a different URL (${parsed.canonical}). Verify this is intentional — could consolidate link equity to the wrong page.`, 8, 2));
      }
    } catch {
      results.push(warn('canonical', 'Canonical Tag', parsed.canonical, 'Valid absolute URL',
        [], `Canonical tag has an invalid URL: "${parsed.canonical}".`, 8, 2));
    }
  } else {
    results.push(fail('canonical', 'Canonical Tag', 'medium', 'Missing',
      `<link rel="canonical" href="${url}">`, [],
      'No canonical tag. Add a self-referencing canonical to prevent duplicate content penalties from URL parameters, HTTP/HTTPS variants, etc.', 8, 1));
  }

  // 8. Mobile viewport
  if (parsed.viewport) {
    if (parsed.viewport.includes('width=device-width')) {
      results.push(pass('viewport', 'Mobile Viewport Meta Tag', `Viewport set: "${parsed.viewport}"`, 8, 1));
    } else {
      results.push(warn('viewport', 'Mobile Viewport Meta Tag',
        parsed.viewport, 'width=device-width, initial-scale=1',
        [`<meta name="viewport" content="${parsed.viewport}">`],
        'Viewport tag exists but lacks "width=device-width". Mobile rendering may be broken, hurting mobile rankings.', 8, 1));
    }
  } else {
    results.push(fail('viewport', 'Mobile Viewport Meta Tag', 'high', 'Missing',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      [], 'No viewport meta tag. Page will not render correctly on mobile — critical for Google\'s mobile-first indexing.', 8, 1));
  }

  // 9. Security headers
  const h = fetchResult.headers;
  const missingHeaders: string[] = [];
  if (!h['strict-transport-security']) missingHeaders.push('Strict-Transport-Security (HSTS)');
  if (!h['x-content-type-options']) missingHeaders.push('X-Content-Type-Options');
  if (!h['x-frame-options'] && !(h['content-security-policy'] || '').includes('frame-ancestors')) {
    missingHeaders.push('X-Frame-Options / CSP frame-ancestors');
  }

  if (missingHeaders.length === 0) {
    results.push(pass('security-headers', 'Security Headers', 'All key security headers are present.', 5, 4));
  } else {
    results.push(warn('security-headers', 'Security Headers',
      `${missingHeaders.length} missing`, 'All present',
      missingHeaders, `Missing security headers: ${missingHeaders.join('; ')}. These protect users and signal trustworthiness to search engines.`, 5, 4));
  }

  return results;
}
