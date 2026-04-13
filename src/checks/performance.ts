import { CheckResult, FetchResult, ParsedPage } from '../types';

type Cat = 'performance';
const CAT: Cat = 'performance';

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

export function runPerformanceChecks(
  fetchResult: FetchResult,
  parsed: ParsedPage
): CheckResult[] {
  const results: CheckResult[] = [];
  const headers = fetchResult.headers;

  // 1. Page load speed (response time as TTFB proxy)
  const rt = fetchResult.responseTimeMs;
  if (rt < 500) {
    results.push(pass('page-load', 'Page Response Time',
      `Page HTML loaded in ${rt}ms — fast server response.`, 9, 4));
  } else if (rt < 1500) {
    results.push(warn('page-load', 'Page Response Time',
      `${rt}ms`, '< 500ms',
      [], `Page HTML took ${rt}ms to load. Slow response time impacts Core Web Vitals (LCP/TTFB). Consider enabling server-side caching, compression, or using a CDN.`, 9, 4));
  } else {
    results.push(fail('page-load', 'Page Response Time', 'high',
      `${rt}ms`, '< 500ms',
      [], `Very slow response: ${rt}ms. This will cause a Poor LCP score. Investigate: slow server, unoptimised database queries, no caching layer, or server location far from users.`, 9, 4));
  }

  // 2. HTML page size
  const sizeKB = Math.round(fetchResult.contentLength / 1024);
  if (sizeKB <= 100) {
    results.push(pass('page-size', 'HTML Page Size',
      `HTML is ${sizeKB}KB — lightweight.`, 6, 4));
  } else if (sizeKB <= 500) {
    results.push(warn('page-size', 'HTML Page Size',
      `${sizeKB}KB`, '< 100KB HTML',
      [], `HTML page size is ${sizeKB}KB. Large HTML files increase parse time. Consider server-side rendering optimisation, removing inline scripts, and lazy-loading content.`, 6, 4));
  } else {
    results.push(fail('page-size', 'HTML Page Size', 'medium',
      `${sizeKB}KB`, '< 100KB HTML',
      [], `Very large HTML (${sizeKB}KB). This significantly increases Time to First Byte and parse time. Investigate large inline assets, base64 images, or excessive DOM size.`, 6, 4));
  }

  // 3. Image formats (check for non-modern formats)
  const oldFormatImages = parsed.images.filter((img) => {
    const src = (img.src || '').toLowerCase();
    return (src.endsWith('.png') || src.endsWith('.jpg') || src.endsWith('.jpeg') || src.endsWith('.gif')) &&
      !src.includes('data:');
  });
  const webpImages = parsed.images.filter((img) =>
    (img.src || '').toLowerCase().includes('.webp') || (img.src || '').toLowerCase().includes('.avif')
  );

  if (parsed.images.length === 0) {
    results.push(pass('image-formats', 'Image Formats', 'No images to check.', 7, 3));
  } else if (oldFormatImages.length === 0) {
    results.push(pass('image-formats', 'Image Formats',
      `${parsed.images.length} image(s) — all appear to use modern formats (WebP/AVIF) or are data URIs.`, 7, 3));
  } else {
    results.push(warn('image-formats', 'Image Formats',
      `${oldFormatImages.length} legacy format image(s)`, 'WebP or AVIF',
      oldFormatImages.slice(0, 5).map((img) => img.src),
      `${oldFormatImages.length} image(s) use JPEG/PNG/GIF. Modern formats (WebP, AVIF) are 25-50% smaller for same quality. Convert images to reduce bandwidth and improve LCP.`, 7, 3));
  }

  // 4. Images missing width/height (causes layout shift — CLS)
  const imagesWithoutDimensions = parsed.images.filter(
    (img) => !img.width || !img.height
  );
  if (imagesWithoutDimensions.length === 0 || parsed.images.length === 0) {
    results.push(pass('image-dimensions', 'Image Width/Height Attributes',
      `All images have width/height attributes — prevents layout shift (CLS).`, 8, 2));
  } else {
    results.push(warn('image-dimensions', 'Image Width/Height Attributes',
      `${imagesWithoutDimensions.length} images lack dimensions`, 'width and height on all <img>',
      imagesWithoutDimensions.slice(0, 5).map((img) => `<img src="${img.src}">`),
      `${imagesWithoutDimensions.length} image(s) are missing width/height attributes. This causes Cumulative Layout Shift (CLS) as the page reflows when images load. Always specify dimensions.`, 8, 2));
  }

  // 5. Lazy loading
  const aboveFoldImages = parsed.images.slice(0, 3); // First 3 images are likely above fold
  const lazyImages = parsed.images.filter((img) => img.loading === 'lazy');
  const belowFold = parsed.images.slice(3);
  const belowFoldNotLazy = belowFold.filter((img) => img.loading !== 'lazy');

  if (parsed.images.length === 0) {
    // No images, skip
  } else if (belowFold.length === 0 || belowFoldNotLazy.length === 0) {
    results.push(pass('image-lazy-loading', 'Image Lazy Loading',
      `${lazyImages.length} image(s) use lazy loading — reduces initial page weight.`, 6, 2));
  } else {
    results.push(warn('image-lazy-loading', 'Image Lazy Loading',
      `${belowFoldNotLazy.length} images without lazy loading`, 'loading="lazy" on below-fold images',
      belowFoldNotLazy.slice(0, 5).map((img) => `<img src="${img.src}">`),
      `${belowFoldNotLazy.length} likely below-fold image(s) missing loading="lazy". Lazy loading defers off-screen images, reducing initial page weight and improving LCP.`, 6, 2));
  }

  // 6. Caching headers
  const hasCacheControl = !!headers['cache-control'];
  const hasETag = !!headers['etag'];
  const hasLastModified = !!headers['last-modified'];
  const hasExpires = !!headers['expires'];

  if (hasCacheControl || (hasETag && hasLastModified)) {
    const cacheValue = headers['cache-control'] || '';
    const isNoStore = cacheValue.includes('no-store');
    const isNoCache = cacheValue.includes('no-cache');
    if (isNoStore) {
      results.push(fail('caching-headers', 'Browser Caching Headers', 'medium',
        'cache-control: no-store', 'Cache-Control with max-age',
        [`Cache-Control: ${cacheValue}`],
        'Cache-Control is set to no-store. This prevents all browser caching, forcing users to re-download the page on every visit. Set an appropriate max-age for static HTML.', 7, 3));
    } else {
      results.push(pass('caching-headers', 'Browser Caching Headers',
        `Caching headers present (${cacheValue || 'ETag/Last-Modified'}).`, 7, 3));
    }
  } else {
    results.push(warn('caching-headers', 'Browser Caching Headers',
      'No Cache-Control or ETag', 'Cache-Control: max-age=3600 (minimum)',
      [], 'No caching headers detected. Without caching, every page request requires a full server roundtrip. Add Cache-Control headers to reduce load times for returning visitors.', 7, 3));
  }

  // 7. Compression (gzip/br)
  const contentEncoding = headers['content-encoding'] || '';
  if (contentEncoding.includes('gzip') || contentEncoding.includes('br') || contentEncoding.includes('deflate')) {
    results.push(pass('compression', 'Response Compression',
      `Compression enabled: ${contentEncoding}. Reduces transfer size significantly.`, 7, 3));
  } else {
    results.push(warn('compression', 'Response Compression',
      'Not detected', 'gzip or Brotli compression',
      [], 'HTTP response compression (gzip/Brotli) not detected. Enable compression on the server to reduce HTML transfer size by 60-80%, improving load times.', 7, 3));
  }

  // 8. Inline scripts/styles (render blocking)
  const hasInlineScripts = (fetchResult.html.match(/<script(?![^>]+src=)[^>]*>/gi) || []).length;
  const hasInlineStyles = (fetchResult.html.match(/<style[^>]*>/gi) || []).length;

  if (hasInlineScripts > 5) {
    results.push(warn('render-blocking', 'Inline Scripts (Render Blocking)',
      `${hasInlineScripts} inline <script> blocks`, '≤ 3 (move to external files)',
      [], `${hasInlineScripts} inline <script> blocks detected. Large inline scripts block HTML parsing and delay rendering. Move scripts to external files and use defer/async attributes.`, 6, 4));
  } else {
    results.push(pass('render-blocking', 'Inline Scripts',
      `${hasInlineScripts} inline script block(s) — acceptable level.`, 6, 4));
  }

  return results;
}
