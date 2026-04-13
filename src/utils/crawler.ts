import axios from 'axios';
import { FetchResult } from '../types';

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/,
  /^0\.0\.0\.0$/,
  /^169\.254\./,
  /metadata\.google\.internal/i,
  /metadata\.aws\.internal/i,
];

const USER_AGENT =
  'Mozilla/5.0 (compatible; SEO-Auditor/1.0; +https://github.com/seo-auditor)';

export function isPrivateUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return PRIVATE_IP_PATTERNS.some((p) => p.test(hostname));
  } catch {
    return true;
  }
}

export function normalizeUrl(url: string): string {
  const u = url.trim();
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    return `https://${u}`;
  }
  return u;
}

export async function fetchPage(
  url: string,
  timeoutMs = 10000
): Promise<FetchResult> {
  if (isPrivateUrl(url)) {
    return {
      url,
      finalUrl: url,
      statusCode: 0,
      html: '',
      headers: {},
      redirectChain: [],
      responseTimeMs: 0,
      contentLength: 0,
      error: 'Blocked: private/internal URL',
    };
  }

  const redirectChain: Array<{ url: string; statusCode: number }> = [];
  let currentUrl = url;
  const start = Date.now();

  try {
    for (let hop = 0; hop < 10; hop++) {
      if (isPrivateUrl(currentUrl)) {
        return {
          url,
          finalUrl: currentUrl,
          statusCode: 0,
          html: '',
          headers: {},
          redirectChain,
          responseTimeMs: Date.now() - start,
          contentLength: 0,
          error: 'Blocked: redirect to private URL',
        };
      }

      const response = await axios.get<string>(currentUrl, {
        timeout: timeoutMs,
        maxRedirects: 0,
        validateStatus: () => true,
        responseType: 'text',
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      });

      const status = response.status;
      const rawHeaders = response.headers as Record<string, string | string[]>;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawHeaders)) {
        headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
      }

      if (status >= 301 && status <= 308) {
        redirectChain.push({ url: currentUrl, statusCode: status });
        const location = headers['location'];
        if (!location) break;
        try {
          currentUrl = new URL(location, currentUrl).href;
        } catch {
          break;
        }
        continue;
      }

      const html = typeof response.data === 'string' ? response.data : '';
      return {
        url,
        finalUrl: currentUrl,
        statusCode: status,
        html,
        headers,
        redirectChain,
        responseTimeMs: Date.now() - start,
        contentLength: html.length,
      };
    }

    return {
      url,
      finalUrl: currentUrl,
      statusCode: 0,
      html: '',
      headers: {},
      redirectChain,
      responseTimeMs: Date.now() - start,
      contentLength: 0,
      error: 'Too many redirects',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown fetch error';
    return {
      url,
      finalUrl: currentUrl,
      statusCode: 0,
      html: '',
      headers: {},
      redirectChain,
      responseTimeMs: Date.now() - start,
      contentLength: 0,
      error: message,
    };
  }
}

/** HEAD request for link checking; falls back to byte-range GET if HEAD is rejected. */
export async function fetchHead(
  url: string,
  timeoutMs = 5000
): Promise<{ statusCode: number; error?: string }> {
  if (isPrivateUrl(url)) {
    return { statusCode: 0, error: 'Blocked: private URL' };
  }
  try {
    const response = await axios.head(url, {
      timeout: timeoutMs,
      maxRedirects: 5,
      validateStatus: () => true,
      headers: { 'User-Agent': USER_AGENT },
    });
    return { statusCode: response.status };
  } catch {
    // Some servers reject HEAD — fall back to minimal GET
    try {
      const response = await axios.get(url, {
        timeout: timeoutMs,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: { 'User-Agent': USER_AGENT, Range: 'bytes=0-0' },
      });
      return { statusCode: response.status };
    } catch (err: unknown) {
      return {
        statusCode: 0,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}
