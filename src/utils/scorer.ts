import {
  CheckResult,
  CategoryScore,
  CheckCategory,
  CATEGORY_WEIGHTS,
  IndustryType,
} from '../types';
import { getIndustryWeights } from '../scoring/industry-weights';

export function calculateCategoryScores(
  checks: CheckResult[],
  industry: IndustryType = 'generic'
): CategoryScore[] {
  const categories = Object.keys(CATEGORY_WEIGHTS) as CheckCategory[];
  const weights = getIndustryWeights(industry);

  return categories.map((category) => {
    const categoryChecks = checks.filter((c) => c.category === category);

    let totalPoints = 0;
    let earnedPoints = 0;
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    for (const check of categoryChecks) {
      const weight = check.impactScore; // weight each check by its impact
      totalPoints += weight;

      if (check.status === 'pass') {
        earnedPoints += weight;
        passed++;
      } else if (check.status === 'warning') {
        earnedPoints += weight * 0.5;
        warnings++;
      } else {
        failed++;
      }
    }

    const score =
      totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 100;

    return {
      category,
      score,
      weight: weights[category] ?? CATEGORY_WEIGHTS[category],
      checksPassed: passed,
      checksFailed: failed,
      checksWarning: warnings,
    };
  });
}

export function calculateOverallScore(categoryScores: CategoryScore[]): number {
  let totalWeight = 0;
  let weightedScore = 0;

  for (const cs of categoryScores) {
    weightedScore += cs.score * cs.weight;
    totalWeight += cs.weight;
  }

  return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
}

export interface ScoreGrade {
  grade: string;
  label: string;
  color: string;
  bg: string;
}

export function getScoreGrade(score: number): ScoreGrade {
  if (score >= 90) return { grade: 'A', label: 'Excellent', color: '#16a34a', bg: '#dcfce7' };
  if (score >= 80) return { grade: 'B', label: 'Good', color: '#65a30d', bg: '#ecfccb' };
  if (score >= 70) return { grade: 'C', label: 'Fair', color: '#ca8a04', bg: '#fef9c3' };
  if (score >= 60) return { grade: 'D', label: 'Poor', color: '#ea580c', bg: '#ffedd5' };
  return { grade: 'F', label: 'Critical', color: '#dc2626', bg: '#fee2e2' };
}

export function summarize(checks: CheckResult[]) {
  return {
    high: checks.filter((c) => c.status !== 'pass' && c.severity === 'high').length,
    medium: checks.filter((c) => c.status !== 'pass' && c.severity === 'medium').length,
    low: checks.filter((c) => c.status !== 'pass' && c.severity === 'low').length,
    passed: checks.filter((c) => c.status === 'pass').length,
    warnings: checks.filter((c) => c.status === 'warning').length,
  };
}
