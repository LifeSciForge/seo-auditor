import { CheckResult, ParsedPage } from '../types';

type Cat = 'accessibility';
const CAT: Cat = 'accessibility';

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

export function runAccessibilityChecks(parsed: ParsedPage): CheckResult[] {
  const results: CheckResult[] = [];

  // 1. HTML lang attribute (WCAG 3.1.1)
  if (parsed.lang && parsed.lang.length >= 2) {
    results.push(pass('html-lang', 'HTML Language Attribute',
      `<html lang="${parsed.lang}"> — screen readers and translation tools can identify language.`, 7, 1));
  } else if (parsed.lang === '') {
    results.push(warn('html-lang', 'HTML Language Attribute', 'Empty lang=""', 'Valid BCP 47 code (e.g. "en")',
      ['<html lang="">'],
      'HTML lang attribute is empty. Set to a valid language code (e.g., "en", "fr", "de") for WCAG 3.1.1 compliance and correct screen reader pronunciation.', 7, 1));
  } else {
    results.push(fail('html-lang', 'HTML Language Attribute', 'medium', 'Missing',
      '<html lang="en">', [],
      'No lang attribute on <html>. This is a WCAG 2.1 Level A failure. Screen readers cannot identify the page language, causing incorrect pronunciation for visually impaired users.', 7, 1));
  }

  // 2. Image alt text (from accessibility perspective)
  const missingAlt = parsed.images.filter((img) => img.alt === null || img.alt === undefined);
  if (missingAlt.length === 0) {
    results.push(pass('a11y-image-alt', 'Image Alt Text (Accessibility)',
      `All ${parsed.images.length} image(s) have alt attributes — WCAG 1.1.1 satisfied.`, 8, 1));
  } else {
    results.push(fail('a11y-image-alt', 'Image Alt Text (Accessibility)', 'high',
      `${missingAlt.length} images missing alt`, 'alt attribute on all <img>',
      missingAlt.slice(0, 5).map((img) => `<img src="${img.src}">`),
      `${missingAlt.length} image(s) lack alt text — WCAG 1.1.1 Level A failure. Decorative images should have alt="", informative images need descriptive alt text.`, 8, 1));
  }

  // 3. Form labels
  if (parsed.hasForm) {
    if (parsed.formInputsWithoutLabel === 0) {
      results.push(pass('form-labels', 'Form Input Labels',
        'All form inputs have associated labels — WCAG 1.3.1 satisfied.', 7, 2));
    } else {
      results.push(fail('form-labels', 'Form Input Labels', 'high',
        `${parsed.formInputsWithoutLabel} unlabelled input(s)`, 'All inputs have labels',
        [],
        `${parsed.formInputsWithoutLabel} form input(s) have no associated label (no <label for="">, aria-label, or aria-labelledby). This is a WCAG 1.3.1 Level A failure — screen reader users cannot identify form fields.`, 7, 2));
    }
  }

  // 4. ARIA landmarks
  const landmarks = parsed.ariaLandmarks;
  if (landmarks.includes('main') && landmarks.includes('navigation')) {
    results.push(pass('aria-landmarks', 'ARIA Landmark Regions',
      `Key landmarks present: ${landmarks.join(', ')}.`, 6, 2));
  } else {
    const missing: string[] = [];
    if (!landmarks.includes('main')) missing.push('main (or role="main")');
    if (!landmarks.includes('navigation')) missing.push('nav (or role="navigation")');

    results.push(warn('aria-landmarks', 'ARIA Landmark Regions',
      `Missing: ${missing.join(', ')}`, 'main, nav, header, footer landmarks',
      missing.map((m) => `Missing <${m}>`),
      `Key ARIA landmarks missing: ${missing.join(', ')}. Landmarks help screen reader users navigate the page structure (WCAG 1.3.6 Best Practice). Add <main>, <nav>, <header>, <footer> semantic HTML.`, 6, 2));
  }

  // 5. Skip link
  if (parsed.hasSkipLink) {
    results.push(pass('skip-link', 'Skip Navigation Link',
      'Skip navigation link found — keyboard users can bypass repetitive navigation.', 5, 2));
  } else {
    results.push(warn('skip-link', 'Skip Navigation Link',
      'Missing', 'Skip to main content link',
      [],
      'No skip-to-content link found. WCAG 2.4.1 (Level A) requires a mechanism to skip repetitive navigation. Add <a href="#main" class="skip-link">Skip to main content</a> as the first focusable element.', 5, 2));
  }

  // 6. Images with non-empty alt that are likely generic
  const genericAlts = ['image', 'photo', 'picture', 'img', 'icon', 'logo', 'banner', 'thumbnail'];
  const vagueAltImages = parsed.images.filter(
    (img) => img.alt !== null && img.alt !== '' &&
      genericAlts.some((g) => img.alt!.toLowerCase().trim() === g)
  );
  if (vagueAltImages.length > 0) {
    results.push(warn('vague-alt-text', 'Vague Image Alt Text',
      `${vagueAltImages.length} image(s) with generic alt`, 'Descriptive alt text',
      vagueAltImages.slice(0, 5).map((img) => `<img alt="${img.alt}" src="${img.src}">`),
      `${vagueAltImages.length} image(s) have generic alt text (e.g., "image", "photo"). Replace with descriptive text that conveys the image content to visually impaired users and search engines.`, 6, 2));
  } else {
    results.push(pass('vague-alt-text', 'Vague Image Alt Text',
      'No generic/placeholder alt text detected.', 6, 2));
  }

  return results;
}
