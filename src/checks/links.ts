import pLimit from 'p-limit';
import { CheckResult, ParsedPage } from '../types';
import { fetchHead } from '../utils/crawler';

type Cat = 'link-profile';
const CAT: Cat = 'link-profile';

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

const GENERIC_ANCHORS = new Set([
  'click here', 'here', 'read more', 'learn more', 'more', 'this', 'link',
  'click', 'go here', 'this link', 'page', 'website', 'site', 'view more',
]);

export async function runLinkChecks(
  url: string,
  parsed: ParsedPage,
  maxLinks = 30,
  checkExternal = false,
  timeoutMs = 5000
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const limit = pLimit(5); // max 5 concurrent requests

  // ── Internal link count ────────────────────────────────────────────────────
  const internalCount = parsed.internalLinks.length;
  if (internalCount === 0) {
    results.push(fail('internal-link-count', 'Internal Link Count', 'medium', '0 internal links',
      '≥ 3 internal links', [],
      'No internal links found on this page. Internal linking distributes PageRank, helps users navigate, and assists search engines in understanding site structure.', 7, 3));
  } else if (internalCount < 3) {
    results.push(warn('internal-link-count', 'Internal Link Count',
      `${internalCount} internal link(s)`, '≥ 3 internal links', [],
      `Only ${internalCount} internal link(s). Add more internal links to relevant pages to improve crawlability and distribute link equity.`, 7, 3));
  } else {
    results.push(pass('internal-link-count', 'Internal Link Count',
      `${internalCount} internal link(s) found — good internal linking.`, 7, 3));
  }

  // ── Anchor text quality ────────────────────────────────────────────────────
  const allLinks = [...parsed.internalLinks, ...parsed.externalLinks];
  const genericAnchors = allLinks.filter(
    (l) => GENERIC_ANCHORS.has(l.text.toLowerCase().trim())
  );
  if (genericAnchors.length === 0) {
    results.push(pass('anchor-text', 'Anchor Text Quality',
      'All anchor text is descriptive — no generic "click here" or "read more" links.', 6, 2));
  } else {
    results.push(warn('anchor-text', 'Anchor Text Quality',
      `${genericAnchors.length} generic anchor(s)`, 'Descriptive keyword-rich anchors',
      genericAnchors.slice(0, 5).map((l) => `"${l.text}" → ${l.href}`),
      `${genericAnchors.length} link(s) use generic anchor text ("click here", "read more", etc.). Anchor text is a relevance signal — use descriptive, keyword-rich anchors instead.`, 6, 2));
  }

  // ── Broken internal links ──────────────────────────────────────────────────
  const internalToCheck = parsed.internalLinks.slice(0, maxLinks);
  if (internalToCheck.length > 0) {
    const checks = internalToCheck.map((link) =>
      limit(async () => {
        const result = await fetchHead(link.href, timeoutMs);
        return { link, statusCode: result.statusCode, error: result.error };
      })
    );

    const linkResults = await Promise.all(checks);
    const broken = linkResults.filter(
      (r) => r.statusCode === 404 || r.statusCode === 410
    );
    const redirected = linkResults.filter(
      (r) => r.statusCode >= 301 && r.statusCode <= 308
    );
    const errors = linkResults.filter(
      (r) => r.statusCode === 0 && !r.error?.includes('Blocked')
    );

    if (broken.length === 0) {
      results.push(pass('broken-internal-links', 'Broken Internal Links',
        `All ${internalToCheck.length} checked internal link(s) return valid responses.`, 9, 2));
    } else {
      results.push(fail('broken-internal-links', 'Broken Internal Links', 'high',
        `${broken.length} broken link(s)`, '0 broken links',
        broken.map((r) => `${r.link.href} → HTTP ${r.statusCode}`),
        `${broken.length} internal 404 link(s) found. Broken links harm user experience, waste crawl budget, and leak PageRank into dead ends. Fix or remove them immediately.`, 9, 2));
    }

    if (redirected.length > 0 && broken.length === 0) {
      results.push(warn('internal-redirects', 'Internal Links via Redirects',
        `${redirected.length} redirect(s)`, 'Direct links',
        redirected.slice(0, 5).map((r) => `${r.link.href} → ${r.statusCode}`),
        `${redirected.length} internal link(s) go through redirects. Update them to direct URLs to preserve link equity and save crawl budget.`, 5, 2));
    }
  }

  // ── Broken external links (optional) ──────────────────────────────────────
  if (checkExternal && parsed.externalLinks.length > 0) {
    const externalToCheck = parsed.externalLinks.slice(0, Math.min(10, maxLinks));
    const extChecks = externalToCheck.map((link) =>
      limit(async () => {
        const result = await fetchHead(link.href, timeoutMs);
        return { link, statusCode: result.statusCode };
      })
    );

    const extResults = await Promise.all(extChecks);
    const brokenExt = extResults.filter(
      (r) => r.statusCode === 404 || r.statusCode === 410
    );

    if (brokenExt.length === 0) {
      results.push(pass('broken-external-links', 'Broken External Links',
        `Checked ${externalToCheck.length} external link(s) — none broken.`, 5, 3));
    } else {
      results.push(warn('broken-external-links', 'Broken External Links',
        `${brokenExt.length} broken external link(s)`, '0 broken external links',
        brokenExt.map((r) => r.link.href),
        `${brokenExt.length} external link(s) return 404/410. Broken outbound links signal poor content maintenance and hurt user experience.`, 5, 3));
    }
  } else if (!checkExternal) {
    // Report external link count without checking
    results.push(pass('external-links', 'External Links',
      `${parsed.externalLinks.length} external link(s) found (use --check-external to validate).`, 4, 3));
  }

  // ── Nofollow external links ────────────────────────────────────────────────
  const nofollowCount = parsed.externalLinks.filter(
    (l) => l.rel.includes('nofollow') || l.rel.includes('ugc') || l.rel.includes('sponsored')
  ).length;
  const doFollowExternal = parsed.externalLinks.length - nofollowCount;

  if (parsed.externalLinks.length > 0) {
    results.push(pass('external-link-attributes', 'External Link rel Attributes',
      `${nofollowCount} nofollow, ${doFollowExternal} do-follow external links. Review sponsored/UGC links for correct rel attribute.`, 4, 2));
  }

  return results;
}
