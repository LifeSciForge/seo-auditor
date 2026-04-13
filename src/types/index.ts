export type CheckCategory =
  | 'technical-seo'
  | 'on-page-seo'
  | 'content-quality'
  | 'link-profile'
  | 'accessibility'
  | 'performance'
  | 'aeo-ai-search'
  | 'geo-local-seo';

export type CheckSeverity = 'high' | 'medium' | 'low';
export type CheckStatus = 'pass' | 'fail' | 'warning';
export type IndustryType = 'generic' | 'ecommerce' | 'saas' | 'content' | 'local' | 'research';

export interface CheckResult {
  checkId: string;
  name: string;
  category: CheckCategory;
  severity: CheckSeverity;
  status: CheckStatus;
  currentValue: string | number | boolean | null;
  recommendedValue: string | number | boolean | null;
  affectedElements: string[];
  explanation: string;
  impactScore: number;  // 1-10: impact on rankings
  effortScore: number;  // 1-10: difficulty to fix
}

export interface FetchResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  html: string;
  headers: Record<string, string>;
  redirectChain: Array<{ url: string; statusCode: number }>;
  responseTimeMs: number;
  contentLength: number;
  error?: string;
}

export interface ImageData {
  src: string;
  alt: string | null;
  width: string | null;
  height: string | null;
  loading: string | null;
}

export interface LinkData {
  href: string;
  text: string;
  rel: string[];
  isInternal: boolean;
}

export interface ParsedPage {
  url: string;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  h1s: string[];
  h2s: string[];
  h3s: string[];
  h4s: string[];
  headings: Array<{ level: number; text: string }>;
  images: ImageData[];
  internalLinks: LinkData[];
  externalLinks: LinkData[];
  schema: Record<string, unknown>[];
  wordCount: number;
  lang: string | null;
  viewport: string | null;
  openGraph: Record<string, string>;
  publishDate: string | null;
  modifiedDate: string | null;
  hasForm: boolean;
  formInputsWithoutLabel: number;
  ariaLandmarks: string[];
  hasSkipLink: boolean;
  bodyText: string;
}

export interface CategoryScore {
  category: CheckCategory;
  score: number;
  weight: number;
  checksPassed: number;
  checksFailed: number;
  checksWarning: number;
}

export interface RoadmapItem {
  title: string;
  description: string;
  effortHours: number;
  impactScore: number;
  category: string;
  checkId?: string;
}

export interface RoadmapPhase {
  phase: number;
  name: string;
  timeframe: string;
  totalHours: number;
  items: RoadmapItem[];
  trafficBoost: string;
  revenueBoost: string;
}

export interface AuditReport {
  url: string;
  domain: string;
  auditedAt: string;
  durationMs: number;
  overallScore: number;
  aeoScore: number;
  geoScore: number | null;   // null = not applicable
  industry: IndustryType;
  categoryScores: CategoryScore[];
  checks: CheckResult[];
  summary: {
    high: number;
    medium: number;
    low: number;
    passed: number;
    warnings: number;
  };
  technicalDetails: {
    statusCode: number;
    responseTimeMs: number;
    redirectChain: Array<{ url: string; statusCode: number }>;
    isHttps: boolean;
    pageSize: number;
    headers: Record<string, string>;
  };
  aiRecommendations: string;
  topIssues: CheckResult[];
  quickWins: CheckResult[];
  roadmap: RoadmapPhase[];
}

export interface AuditOptions {
  timeout: number;
  checkExternalLinks: boolean;
  maxLinksToCheck: number;
  ollamaModel: string;
  ollamaHost: string;
  skipAI: boolean;
  outputPath: string;
  verbose: boolean;
  industry: IndustryType;
}

export const DEFAULT_OPTIONS: AuditOptions = {
  timeout: 10000,
  checkExternalLinks: false,
  maxLinksToCheck: 30,
  ollamaModel: 'qwen3-coder:30b',
  ollamaHost: 'http://localhost:11434',
  skipAI: false,
  outputPath: './audit-report.pdf',
  verbose: false,
  industry: 'generic',
};

export const CATEGORY_WEIGHTS: Record<CheckCategory, number> = {
  'technical-seo': 0.20,
  'on-page-seo': 0.20,
  'content-quality': 0.15,
  'link-profile': 0.10,
  'accessibility': 0.08,
  'performance': 0.08,
  'aeo-ai-search': 0.12,
  'geo-local-seo': 0.07,
};

export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  'technical-seo': 'Technical SEO',
  'on-page-seo': 'On-Page SEO',
  'content-quality': 'Content Quality',
  'link-profile': 'Link Profile',
  'accessibility': 'Accessibility',
  'performance': 'Performance',
  'aeo-ai-search': 'AEO (AI Search)',
  'geo-local-seo': 'GEO (Local SEO)',
};
