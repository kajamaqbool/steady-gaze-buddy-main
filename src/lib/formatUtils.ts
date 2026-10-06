/**
 * Utility functions for data formatting, percentage scale normalization,
 * and accessible design token resolution.
 */

/**
 * Normalizes a number scale so that 0-1 decimals (e.g. 0.8585) and
 * 0-100 numbers (e.g. 85.85) both correctly convert to 0-100 percentage values.
 * 
 * Prevents abnormal values such as 8585% or 560000%.
 */
export function normalizePercentage(value: number | null | undefined): number {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  
  let val = value;
  // If scale is > 100 due to backend multiplier anomalies (e.g. 8585 or 560000), normalize down
  while (val > 100) {
    val = val / 100;
  }

  // If scale is 0 to 1 (e.g. 0.8585), multiply by 100
  if (val >= 0 && val <= 1) {
    return val * 100;
  }
  
  // If scale is already 0 to 100 (e.g. 85.85), clamp between 0 and 100
  return Math.min(Math.max(val, 0), 100);
}

/**
 * Formats a percentage value into a clean display string (e.g. "85.9%")
 */
export function formatPercentage(value: number | null | undefined, decimals = 1): string {
  const norm = normalizePercentage(value);
  return `${norm.toFixed(decimals)}%`;
}

/**
 * Format timestamp into readable localized date and time string
 */
export function formatDateTime(timestamp: number | null | undefined): string {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format duration in milliseconds into a friendly string (e.g., "1m 15s")
 */
export function formatDurationSeconds(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '0s';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export interface RiskConfig {
  label: string;
  badgeClass: string;
  cardBgClass: string;
  textColorClass: string;
  progressColor: string;
  shortDescription: string;
  explanation: string;
  nextSteps: string[];
}

export function getRiskConfig(classification: string | null | undefined): RiskConfig {
  const normalizedClass = (classification || '').toUpperCase();

  switch (normalizedClass) {
    case 'LOW':
      return {
        label: 'Low Risk Indicators',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200 font-semibold',
        cardBgClass: 'bg-emerald-50/70 border-emerald-200',
        textColorClass: 'text-emerald-900',
        progressColor: '#10b981',
        shortDescription: 'Reading flow and gaze patterns are progressing smoothly.',
        explanation: 'The gaze tracking data indicates steady fixation stability and expected reading pace with low indicators of reading difficulty.',
        nextSteps: [
          'Continue regular reading practice with engaging age-appropriate books.',
          'Re-screen periodically to track ongoing reading confidence and fluency.',
        ],
      };

    case 'MODERATE':
      return {
        label: 'Moderate Indicators',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200 font-semibold',
        cardBgClass: 'bg-amber-50/70 border-amber-200',
        textColorClass: 'text-amber-900',
        progressColor: '#f59e0b',
        shortDescription: 'Some reading hesitation or fixation variations detected.',
        explanation: 'The screening observed mild variations in line progression or word fixations. This can reflect temporary fatigue or developing reading strategies.',
        nextSteps: [
          'Try guided reading with larger line spacing or text line highlighting.',
          'Schedule short, frequent reading sessions (10-15 minutes) to avoid fatigue.',
          'Consider reviewing reading progress with an educator or specialist.',
        ],
      };

    case 'HIGH':
      return {
        label: 'Higher Indicators',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200 font-semibold',
        cardBgClass: 'bg-rose-50/70 border-rose-200',
        textColorClass: 'text-rose-900',
        progressColor: '#ef4444',
        shortDescription: 'Noticeable reading difficulty indicators during tracking.',
        explanation: 'The gaze tracking identified increased regressions, frequent line re-reading, or uneven fixation patterns characteristic of reading challenge indicators.',
        nextSteps: [
          'Share these screening insights with a teacher, reading specialist, or pediatrician.',
          'Utilize dyslexia-friendly fonts (e.g., OpenDyslexic) and audio-assisted reading.',
          'Focus on supportive, low-pressure reading environments.',
        ],
      };

    default:
      return {
        label: 'Pending Screening',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 font-medium',
        cardBgClass: 'bg-slate-50 border-slate-200',
        textColorClass: 'text-slate-800',
        progressColor: '#94a3b8',
        shortDescription: 'Screening result is being processed or updated.',
        explanation: 'Screening data is being gathered or evaluated by the ML service.',
        nextSteps: ['Complete a reading session to generate full screening insights.'],
      };
  }
}
