import { CheckResult, ParsedPage } from '../types';

type Cat = 'on-page-seo';
const CAT: Cat = 'on-page-seo';

function pass(id: string, name: string, explanation: string, impact: number, effort: number): CheckResult {
  return { checkId: id, name, category: CAT, severity: 'low', status: 'pass',
    currentValue: null, recommendedValue: null, affectedElements: [], explanation, impactScore: impact, effortScore: effort };
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

export function runOnPageChecks(parsed: ParsedPage): CheckResult[] {
  const results: CheckResult[] = [];

  // 1. Title tag existence
  if (!parsed.title) {
    results.push(fail('title-exists', 'Title Tag Exists', 'high', 'Missing', 'Descriptive title tag',
      [], 'No <title> tag found. Title is the single most important on-page SEO element — essential for rankings and click-through rates.', 10, 1));
  } else {
    const len = parsed.title.length;

    // 2. Title length
    if (len >= 50 && len <= 60) {
      results.push(pass('title-length', 'Title Tag Length', `Title is ${len} chars — ideal range (50-60).`, 8, 1));
    } else if (len >= 40 && len < 50) {
      results.push(warn('title-length', 'Title Tag Length', `${len} chars`, '50-60 chars',
        [`<title>${parsed.title}</title>`],
        `Title is slightly short (${len} chars). Aim for 50-60 characters to maximise SERP real estate.`, 8, 1));
    } else if (len > 60 && len <= 70) {
      results.push(warn('title-length', 'Title Tag Length', `${len} chars`, '50-60 chars',
        [`<title>${parsed.title}</title>`],
        `Title is slightly long (${len} chars). Google may truncate it in SERPs after ~60 chars.`, 8, 1));
    } else if (len > 70) {
      results.push(fail('title-length', 'Title Tag Length', 'medium', `${len} chars`, '50-60 chars',
        [`<title>${parsed.title}</title>`],
        `Title is too long (${len} chars). Google will truncate at ~60 chars, hiding your message. Shorten it.`, 8, 1));
    } else {
      results.push(fail('title-length', 'Title Tag Length', 'medium', `${len} chars`, '50-60 chars',
        [`<title>${parsed.title}</title>`],
        `Title is very short (${len} chars). Expand to 50-60 characters to include target keywords and value proposition.`, 8, 1));
    }
  }

  // 3. Meta description existence
  if (!parsed.metaDescription) {
    results.push(fail('meta-desc-exists', 'Meta Description Exists', 'medium', 'Missing',
      '120-160 char meta description', [],
      'No meta description tag. While not a direct ranking factor, it controls SERP snippet text and affects CTR.', 7, 1));
  } else {
    const len = parsed.metaDescription.length;

    // 4. Meta description length
    if (len >= 120 && len <= 160) {
      results.push(pass('meta-desc-length', 'Meta Description Length', `Meta description is ${len} chars — ideal.`, 6, 1));
    } else if (len < 50) {
      results.push(fail('meta-desc-length', 'Meta Description Length', 'medium',
        `${len} chars`, '120-160 chars',
        [`<meta name="description" content="${parsed.metaDescription}">`],
        `Meta description is very short (${len} chars). Expand to 120-160 chars with a clear value proposition and CTA.`, 6, 1));
    } else if (len < 120) {
      results.push(warn('meta-desc-length', 'Meta Description Length',
        `${len} chars`, '120-160 chars',
        [`<meta name="description" content="${parsed.metaDescription}">`],
        `Meta description is below optimal length (${len} chars vs 120-160). Add more detail and a call-to-action.`, 6, 1));
    } else if (len > 160) {
      results.push(warn('meta-desc-length', 'Meta Description Length',
        `${len} chars`, '120-160 chars',
        [`<meta name="description" content="${parsed.metaDescription.slice(0, 80)}...">`],
        `Meta description is too long (${len} chars). Google truncates at ~160 chars. Trim to avoid cut-off.`, 6, 1));
    }
  }

  // 5. H1 tag count
  const h1Count = parsed.h1s.length;
  if (h1Count === 1) {
    results.push(pass('h1-count', 'H1 Tag Count', `Exactly one H1 found: "${parsed.h1s[0]}"`, 8, 1));
  } else if (h1Count === 0) {
    results.push(fail('h1-count', 'H1 Tag Count', 'high', '0 H1 tags', '1 H1 tag',
      [], 'No H1 tag found. H1 is the primary page topic signal for search engines. Every page needs exactly one descriptive H1.', 8, 1));
  } else {
    results.push(warn('h1-count', 'H1 Tag Count', `${h1Count} H1 tags`, '1 H1 tag',
      parsed.h1s.map((h) => `<h1>${h}</h1>`),
      `${h1Count} H1 tags found. Multiple H1s dilute the topic signal. Consolidate into a single, keyword-rich H1.`, 7, 1));
  }

  // 6. Heading hierarchy
  const headingLevels = parsed.headings.map((h) => h.level);
  let hierarchyBroken = false;
  let skipDetail = '';
  for (let i = 1; i < headingLevels.length; i++) {
    const prev = headingLevels[i - 1];
    const curr = headingLevels[i];
    if (curr > prev + 1) {
      hierarchyBroken = true;
      skipDetail = `H${prev} → H${curr} skip detected`;
      break;
    }
  }
  if (!hierarchyBroken || parsed.headings.length === 0) {
    results.push(pass('heading-hierarchy', 'Heading Hierarchy', 'Heading levels follow logical H1→H2→H3 structure.', 6, 2));
  } else {
    results.push(warn('heading-hierarchy', 'Heading Hierarchy', skipDetail, 'Sequential levels (no skips)',
      [], `Heading hierarchy has skipped levels (${skipDetail}). Proper nesting helps search engines understand content structure and improves accessibility.`, 6, 2));
  }

  // 7. Images without alt text
  const imagesTotal = parsed.images.length;
  const imagesMissingAlt = parsed.images.filter(
    (img) => img.alt === null || img.alt === undefined
  );
  const imagesEmptyAlt = parsed.images.filter((img) => img.alt === '');
  const imagesWithAlt = imagesTotal - imagesMissingAlt.length;

  if (imagesTotal === 0) {
    results.push(pass('image-alt', 'Image Alt Text', 'No images on this page.', 7, 1));
  } else if (imagesMissingAlt.length === 0) {
    results.push(pass('image-alt', 'Image Alt Text',
      `All ${imagesTotal} image(s) have alt attributes.`, 7, 1));
  } else if (imagesMissingAlt.length <= 2 || imagesMissingAlt.length / imagesTotal < 0.2) {
    results.push(warn('image-alt', 'Image Alt Text',
      `${imagesMissingAlt.length}/${imagesTotal} missing alt`, 'All images have alt text',
      imagesMissingAlt.slice(0, 5).map((img) => `<img src="${img.src}" alt="" ...>`),
      `${imagesMissingAlt.length} image(s) are missing alt text. Alt text helps search engines index images and is essential for accessibility.`, 7, 1));
  } else {
    results.push(fail('image-alt', 'Image Alt Text', 'medium',
      `${imagesMissingAlt.length}/${imagesTotal} missing alt`, 'All images have alt text',
      imagesMissingAlt.slice(0, 5).map((img) => `<img src="${img.src}">`),
      `${imagesMissingAlt.length} of ${imagesTotal} images (${Math.round(imagesMissingAlt.length / imagesTotal * 100)}%) are missing alt text. Images without alt text are invisible to search engines.`, 7, 1));
  }

  // 8. URL length
  const urlLength = parsed.url.length;
  if (urlLength <= 75) {
    results.push(pass('url-length', 'URL Length', `URL is ${urlLength} chars — within recommended limit.`, 5, 3));
  } else if (urlLength <= 100) {
    results.push(warn('url-length', 'URL Length', `${urlLength} chars`, '< 75 chars',
      [parsed.url], `URL is ${urlLength} chars. Long URLs are truncated in SERPs and harder to share. Aim for under 75 characters.`, 5, 3));
  } else {
    results.push(fail('url-length', 'URL Length', 'low', `${urlLength} chars`, '< 75 chars',
      [parsed.url], `URL is very long (${urlLength} chars). Shorten by removing stop words, session IDs, and unnecessary parameters.`, 5, 3));
  }

  // 9. URL uses hyphens (not underscores)
  if (parsed.url.includes('_')) {
    results.push(warn('url-hyphens', 'URL Uses Hyphens', 'Underscores detected', 'Hyphens as word separators',
      [parsed.url], 'URL contains underscores. Google treats hyphens as word separators but underscores join words together, reducing keyword visibility.', 4, 3));
  } else {
    results.push(pass('url-hyphens', 'URL Word Separators', 'URL uses hyphens as word separators.', 4, 3));
  }

  // 10. Schema markup
  if (parsed.schema.length > 0) {
    const types = parsed.schema
      .map((s) => (s as Record<string, unknown>)['@type'])
      .filter(Boolean)
      .join(', ');
    results.push(pass('schema-markup', 'Schema Markup (Structured Data)',
      `${parsed.schema.length} JSON-LD schema block(s) found: ${types}`, 8, 3));
  } else {
    results.push(fail('schema-markup', 'Schema Markup (Structured Data)', 'medium', 'None found',
      'Relevant JSON-LD schema', [],
      'No structured data (Schema.org JSON-LD) detected. Schema markup enables rich results (FAQ, breadcrumbs, product ratings) and improves SERP visibility.', 8, 3));
  }

  // 11. Open Graph tags
  const hasOG = Object.keys(parsed.openGraph).length >= 3;
  if (hasOG) {
    results.push(pass('open-graph', 'Open Graph Tags', `OG tags present (${Object.keys(parsed.openGraph).join(', ')}).`, 5, 1));
  } else {
    results.push(warn('open-graph', 'Open Graph Tags',
      `${Object.keys(parsed.openGraph).length} OG tags`, '≥ 3 (og:title, og:description, og:image)',
      [], 'Open Graph tags are incomplete. OG tags control how pages appear when shared on social media — missing tags result in poor previews and lower engagement.', 5, 1));
  }

  return results;
}
