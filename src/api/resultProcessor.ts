/**
 * PHASE 1-2: Result Processor Service
 * Parse, validate, and normalize ML results from backend
 * 
 * Responsibilities:
 * - Parse raw JSON into MLResultPayload
 * - Validate result data (ranges, types, required fields)
 * - Normalize scores (ensure 0-100 range)
 * - Extract actionable insights
 * - Detect anomalies
 */

import { MLResultPayload } from './types';

export interface ResultValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ProcessedResult {
  original: MLResultPayload;
  normalized: MLResultPayload;
  isValid: boolean;
  errors: ResultValidationError[];
  warnings: string[];
  insights: ResultInsight[];
}

export interface ResultInsight {
  type: 'improvement' | 'concern' | 'recommendation' | 'milestone';
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

/**
 * Validation rules for ML results
 */
const VALIDATION_RULES = {
  riskScore: { min: 0, max: 100 },
  confidence: { min: 0, max: 1 },
  featureMetrics: { min: 0, max: 1 }, // All feature scores 0-1
  requiredFields: ['sessionId', 'timestamp', 'frameId', 'riskLevel', 'riskScore', 'classification', 'confidence', 'features'],
};

const RISK_LEVELS = ['LOW', 'MODERATE', 'HIGH'] as const;

/**
 * Parse raw JSON string into typed MLResultPayload
 */
export function parseResultJson(rawJson: string): MLResultPayload | null {
  try {
    return JSON.parse(rawJson) as MLResultPayload;
  } catch (error) {
    console.error('[ResultProcessor] JSON parse error:', error);
    return null;
  }
}

/**
 * Validate ML result against schema
 */
export function validateResult(result: any): ResultValidationError[] {
  const errors: ResultValidationError[] = [];

  if (!result || typeof result !== 'object') {
    return [{ field: 'root', message: 'Result is not an object' }];
  }

  // Check required fields
  for (const field of VALIDATION_RULES.requiredFields) {
    if (!(field in result)) {
      errors.push({ field, message: `Missing required field: ${field}` });
    }
  }

  // Validate riskScore range
  if (typeof result.riskScore !== 'number' || 
      result.riskScore < VALIDATION_RULES.riskScore.min || 
      result.riskScore > VALIDATION_RULES.riskScore.max) {
    errors.push({
      field: 'riskScore',
      message: `Invalid riskScore: must be 0-100, got ${result.riskScore}`,
      value: result.riskScore,
    });
  }

  // Validate riskLevel
  if (!RISK_LEVELS.includes(result.riskLevel)) {
    errors.push({
      field: 'riskLevel',
      message: `Invalid riskLevel: must be one of ${RISK_LEVELS.join(', ')}`,
      value: result.riskLevel,
    });
  }

  // Validate confidence range
  if (typeof result.confidence !== 'number' ||
      result.confidence < VALIDATION_RULES.confidence.min ||
      result.confidence > VALIDATION_RULES.confidence.max) {
    errors.push({
      field: 'confidence',
      message: `Invalid confidence: must be 0-1, got ${result.confidence}`,
      value: result.confidence,
    });
  }

  // Validate feature metrics
  if (result.features && typeof result.features === 'object') {
    for (const [key, value] of Object.entries(result.features)) {
      if (typeof value === 'number' &&
          (value < VALIDATION_RULES.featureMetrics.min ||
           value > VALIDATION_RULES.featureMetrics.max)) {
        errors.push({
          field: `features.${key}`,
          message: `Invalid feature metric: must be 0-1, got ${value}`,
          value,
        });
      }
    }
  }

  // Validate timestamp
  if (typeof result.timestamp !== 'number' || result.timestamp <= 0) {
    errors.push({
      field: 'timestamp',
      message: 'Invalid timestamp: must be positive number',
      value: result.timestamp,
    });
  }

  // Validate classification string
  if (typeof result.classification !== 'string' || result.classification.length === 0) {
    errors.push({
      field: 'classification',
      message: 'Invalid classification: must be non-empty string',
      value: result.classification,
    });
  }

  return errors;
}

/**
 * Normalize result values to valid ranges
 */
export function normalizeResult(result: MLResultPayload): MLResultPayload {
  return {
    ...result,
    riskScore: Math.max(0, Math.min(100, result.riskScore)),
    confidence: Math.max(0, Math.min(1, result.confidence)),
    features: {
      fixationStability: Math.max(0, Math.min(1, result.features.fixationStability)),
      saccadePattern: Math.max(0, Math.min(1, result.features.saccadePattern)),
      readingSpeed: Math.max(0, Math.min(1, result.features.readingSpeed)),
      comprehensionIndex: Math.max(0, Math.min(1, result.features.comprehensionIndex)),
    },
  };
}

/**
 * Extract actionable insights from result
 */
export function extractInsights(result: MLResultPayload, previousResult?: MLResultPayload): ResultInsight[] {
  const insights: ResultInsight[] = [];
  const features = result.features;

  // Risk level insights
  if (result.riskLevel === 'HIGH') {
    insights.push({
      type: 'concern',
      severity: 'critical',
      message: `High dyslexia risk detected (${result.riskScore.toFixed(1)}%). Consider further assessment.`,
    });
  } else if (result.riskLevel === 'MODERATE') {
    insights.push({
      type: 'concern',
      severity: 'warning',
      message: `Moderate risk level. Monitor reading patterns for improvements.`,
    });
  } else {
    insights.push({
      type: 'milestone',
      severity: 'info',
      message: `Low risk score (${result.riskScore.toFixed(1)}%). Good reading performance detected.`,
    });
  }

  // Feature-specific insights
  if (features.fixationStability < 0.4) {
    insights.push({
      type: 'concern',
      severity: 'warning',
      message: 'Fixation stability low - may indicate attention issues',
    });
  }

  if (features.saccadePattern < 0.4) {
    insights.push({
      type: 'concern',
      severity: 'warning',
      message: 'Saccade pattern irregular - irregular eye movements detected',
    });
  }

  if (features.readingSpeed < 0.3) {
    insights.push({
      type: 'concern',
      severity: 'warning',
      message: 'Slow reading speed - may indicate processing delays',
    });
  }

  if (features.comprehensionIndex < 0.5) {
    insights.push({
      type: 'recommendation',
      severity: 'warning',
      message: 'Consider comprehension exercises to improve reading fluency',
    });
  }

  // Improvement tracking
  if (previousResult && result.riskScore < previousResult.riskScore) {
    const improvement = ((previousResult.riskScore - result.riskScore) / previousResult.riskScore * 100).toFixed(1);
    insights.push({
      type: 'improvement',
      severity: 'info',
      message: `${improvement}% improvement in risk score since last session!`,
    });
  }

  return insights;
}

/**
 * Detect anomalies in result
 */
export function detectAnomalies(result: MLResultPayload, previousResults?: MLResultPayload[]): string[] {
  const anomalies: string[] = [];

  // Check for extreme jumps in score
  if (previousResults && previousResults.length > 0) {
    const lastResult = previousResults[previousResults.length - 1];
    const scoreDiff = Math.abs(result.riskScore - lastResult.riskScore);
    
    if (scoreDiff > 40) {
      anomalies.push(`Extreme risk score change: ${scoreDiff.toFixed(1)}% jump detected`);
    }

    // Check for sudden metric changes
    if (Math.abs(result.features.fixationStability - lastResult.features.fixationStability) > 0.5) {
      anomalies.push('Significant change in fixation stability');
    }
  }

  // Check for low confidence
  if (result.confidence < 0.6) {
    anomalies.push('Low confidence score - result may be unreliable');
  }

  // Check for all features being identical (possible data error)
  const allFeaturesEqual = 
    result.features.fixationStability === result.features.saccadePattern &&
    result.features.saccadePattern === result.features.readingSpeed &&
    result.features.readingSpeed === result.features.comprehensionIndex;
  
  if (allFeaturesEqual) {
    anomalies.push('All feature metrics identical - possible data error');
  }

  return anomalies;
}

/**
 * Process raw result with full validation and normalization
 */
export function processResult(
  rawJson: string,
  previousResult?: MLResultPayload,
  resultHistory?: MLResultPayload[]
): ProcessedResult {
  // Parse
  const parsed = parseResultJson(rawJson);
  if (!parsed) {
    return {
      original: null as any,
      normalized: null as any,
      isValid: false,
      errors: [{ field: 'root', message: 'Failed to parse JSON' }],
      warnings: [],
      insights: [],
    };
  }

  // Validate
  const validationErrors = validateResult(parsed);
  const isValid = validationErrors.length === 0;

  // Normalize
  const normalized = normalizeResult(parsed);

  // Extract insights
  const insights = extractInsights(normalized, previousResult);

  // Detect anomalies
  const warnings = detectAnomalies(normalized, resultHistory);

  return {
    original: parsed,
    normalized,
    isValid,
    errors: validationErrors,
    warnings,
    insights,
  };
}

/**
 * Format result for display
 */
export function formatResultForDisplay(result: MLResultPayload): {
  riskText: string;
  riskPercentage: string;
  confidencePercentage: string;
} {
  return {
    riskText: result.riskLevel,
    riskPercentage: `${result.riskScore.toFixed(1)}%`,
    confidencePercentage: `${(result.confidence * 100).toFixed(1)}%`,
  };
}

export default {
  parseResultJson,
  validateResult,
  normalizeResult,
  extractInsights,
  detectAnomalies,
  processResult,
  formatResultForDisplay,
};
