/**
 * Industry-specific scoring weight profiles
 * Different business types should weight SEO categories differently
 */

import { CheckCategory, IndustryType } from '../types';

export interface IndustryWeightProfile {
  label: string;
  description: string;
  weights: Record<CheckCategory, number>;
}

// All weight sets must sum to 1.0
export const INDUSTRY_WEIGHTS: Record<IndustryType, IndustryWeightProfile> = {
  generic: {
    label: 'Generic / General',
    description: 'Balanced weights for any business type',
    weights: {
      'technical-seo':   0.20,
      'on-page-seo':     0.20,
      'content-quality': 0.15,
      'link-profile':    0.10,
      'accessibility':   0.08,
      'performance':     0.08,
      'aeo-ai-search':   0.12,
      'geo-local-seo':   0.07,
    },
  },

  ecommerce: {
    label: 'E-Commerce / Retail',
    description: 'Optimized for product pages, shopping, and local pickup',
    weights: {
      'technical-seo':   0.15,
      'on-page-seo':     0.20,
      'content-quality': 0.10,
      'link-profile':    0.10,
      'accessibility':   0.05,
      'performance':     0.15, // page speed critical for conversion
      'aeo-ai-search':   0.10,
      'geo-local-seo':   0.15, // local pickup, in-store availability
    },
  },

  saas: {
    label: 'B2B SaaS / Technology',
    description: 'Emphasizes content authority, AEO, and technical quality',
    weights: {
      'technical-seo':   0.15,
      'on-page-seo':     0.20,
      'content-quality': 0.20, // content-led growth
      'link-profile':    0.15, // thought leadership backlinks
      'accessibility':   0.08,
      'performance':     0.07,
      'aeo-ai-search':   0.10, // AI search for B2B research
      'geo-local-seo':   0.05,
    },
  },

  content: {
    label: 'Content / Media / Blog',
    description: 'Maximizes AEO, content quality, and link authority',
    weights: {
      'technical-seo':   0.12,
      'on-page-seo':     0.15,
      'content-quality': 0.25, // content is the product
      'link-profile':    0.15,
      'accessibility':   0.05,
      'performance':     0.08,
      'aeo-ai-search':   0.18, // AI search drives huge content traffic
      'geo-local-seo':   0.02,
    },
  },

  local: {
    label: 'Local Business',
    description: 'Prioritizes local SEO, GEO, and mobile optimization',
    weights: {
      'technical-seo':   0.10,
      'on-page-seo':     0.15,
      'content-quality': 0.10,
      'link-profile':    0.10,
      'accessibility':   0.05,
      'performance':     0.10, // mobile speed for local searchers
      'aeo-ai-search':   0.10,
      'geo-local-seo':   0.30, // GEO is primary for local businesses
    },
  },

  research: {
    label: 'Research / Education / Non-Profit',
    description: 'Emphasizes E-A-T, citations, and accessibility',
    weights: {
      'technical-seo':   0.15,
      'on-page-seo':     0.15,
      'content-quality': 0.22, // accuracy and depth matter most
      'link-profile':    0.18, // citations and authority links
      'accessibility':   0.12, // WCAG compliance important
      'performance':     0.06,
      'aeo-ai-search':   0.10,
      'geo-local-seo':   0.02,
    },
  },
};

/** Get weights for a given industry type */
export function getIndustryWeights(industry: IndustryType): Record<CheckCategory, number> {
  return INDUSTRY_WEIGHTS[industry]?.weights ?? INDUSTRY_WEIGHTS.generic.weights;
}

/** Validate that weights sum to ~1.0 */
export function validateWeights(weights: Record<CheckCategory, number>): boolean {
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1.0) < 0.001;
}
