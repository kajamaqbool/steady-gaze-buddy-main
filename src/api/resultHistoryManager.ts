/**
 * PHASE 3: Result History Manager
 * Optimized state management for ML result history
 * 
 * - Stores last N results with metadata
 * - Prevents memory bloat (max 100 results)
 * - Enables trend analysis
 * - Supports filtering/querying
 */

import { MLResultPayload } from './types';

export interface ResultHistoryEntry {
  result: MLResultPayload;
  receivedAt: number;
  processingTimeMs: number;
}

export interface HistoryStats {
  totalResults: number;
  averageRiskScore: number;
  highestRiskScore: number;
  lowestRiskScore: number;
  riskTrend: 'improving' | 'degrading' | 'stable' | 'insufficient_data';
  averageConfidence: number;
}

const MAX_HISTORY_SIZE = 100;
const TREND_WINDOW = 10; // Look at last 10 results for trend

/**
 * Manage ML result history with memory optimization
 */
export class ResultHistoryManager {
  private history: ResultHistoryEntry[] = [];

  /**
   * Add result to history
   */
  addResult(result: MLResultPayload, processingTimeMs: number = 0): void {
    const entry: ResultHistoryEntry = {
      result,
      receivedAt: Date.now(),
      processingTimeMs,
    };

    this.history.push(entry);

    // Keep history size bounded
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history = this.history.slice(-MAX_HISTORY_SIZE);
    }
  }

  /**
   * Get all results in history
   */
  getAll(): MLResultPayload[] {
    return this.history.map(entry => entry.result);
  }

  /**
   * Get last N results
   */
  getLast(n: number): MLResultPayload[] {
    return this.history
      .slice(-n)
      .map(entry => entry.result);
  }

  /**
   * Get most recent result
   */
  getLatest(): MLResultPayload | null {
    return this.history.length > 0 
      ? this.history[this.history.length - 1].result 
      : null;
  }

  /**
   * Get result at specific index from end (-1 = latest, -2 = previous, etc)
   */
  getByOffset(offset: number): MLResultPayload | null {
    if (offset > 0) {
      console.warn('[ResultHistoryManager] Offset should be negative or 0');
      offset = -offset;
    }

    const index = this.history.length + offset;
    return index >= 0 && index < this.history.length 
      ? this.history[index].result 
      : null;
  }

  /**
   * Get previous result (for comparison)
   */
  getPrevious(): MLResultPayload | null {
    return this.history.length > 1 
      ? this.history[this.history.length - 2].result 
      : null;
  }

  /**
   * Get result timeline (for graphing)
   */
  getTimeline(count: number = 20): Array<{ timestamp: number; riskScore: number; sessionId: string }> {
    return this.history
      .slice(-count)
      .map(entry => ({
        timestamp: entry.receivedAt,
        riskScore: entry.result.riskScore,
        sessionId: entry.result.sessionId,
      }));
  }

  /**
   * Calculate statistics from history
   */
  getStats(): HistoryStats {
    if (this.history.length === 0) {
      return {
        totalResults: 0,
        averageRiskScore: 0,
        highestRiskScore: 0,
        lowestRiskScore: 0,
        riskTrend: 'insufficient_data',
        averageConfidence: 0,
      };
    }

    const scores = this.history.map(e => e.result.riskScore);
    const confidences = this.history.map(e => e.result.confidence);

    // Calculate trend
    let riskTrend: 'improving' | 'degrading' | 'stable' | 'insufficient_data' = 'insufficient_data';
    if (this.history.length >= TREND_WINDOW) {
      const recent = scores.slice(-TREND_WINDOW);
      const older = scores.slice(-TREND_WINDOW * 2, -TREND_WINDOW);
      
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      const diff = olderAvg - recentAvg;

      if (diff > 5) riskTrend = 'improving';
      else if (diff < -5) riskTrend = 'degrading';
      else riskTrend = 'stable';
    }

    return {
      totalResults: this.history.length,
      averageRiskScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      highestRiskScore: Math.max(...scores),
      lowestRiskScore: Math.min(...scores),
      riskTrend,
      averageConfidence: confidences.reduce((a, b) => a + b, 0) / confidences.length,
    };
  }

  /**
   * Filter results by risk level
   */
  filterByRiskLevel(level: 'LOW' | 'MODERATE' | 'HIGH'): MLResultPayload[] {
    return this.history
      .filter(entry => entry.result.riskLevel === level)
      .map(entry => entry.result);
  }

  /**
   * Filter results by time range (milliseconds from now)
   */
  filterByTimeRange(fromMs: number, toMs?: number): MLResultPayload[] {
    const now = Date.now();
    const from = now - fromMs;
    const to = toMs ? now - toMs : now;

    return this.history
      .filter(entry => entry.receivedAt >= to && entry.receivedAt <= from)
      .map(entry => entry.result);
  }

  /**
   * Filter results by session ID
   */
  filterBySessionId(sessionId: string): MLResultPayload[] {
    return this.history
      .filter(entry => entry.result.sessionId === sessionId)
      .map(entry => entry.result);
  }

  /**
   * Get results with high/low values for specific metric
   */
  getExtremes(metric: 'riskScore' | 'confidence'): {
    highest: MLResultPayload;
    lowest: MLResultPayload;
  } | null {
    if (this.history.length === 0) return null;

    let highest = this.history[0].result;
    let lowest = this.history[0].result;

    for (const entry of this.history) {
      const result = entry.result;
      const value = metric === 'riskScore' ? result.riskScore : result.confidence;
      const highValue = metric === 'riskScore' ? highest.riskScore : highest.confidence;
      const lowValue = metric === 'riskScore' ? lowest.riskScore : lowest.confidence;

      if (value > highValue) highest = result;
      if (value < lowValue) lowest = result;
    }

    return { highest, lowest };
  }

  /**
   * Calculate moving average of risk score
   */
  getMovingAverage(windowSize: number = 5): number[] {
    const scores = this.history.map(e => e.result.riskScore);
    const result: number[] = [];

    for (let i = 0; i < scores.length; i++) {
      const start = Math.max(0, i - windowSize + 1);
      const window = scores.slice(start, i + 1);
      const avg = window.reduce((a, b) => a + b, 0) / window.length;
      result.push(avg);
    }

    return result;
  }

  /**
   * Clear history
   */
  clear(): void {
    this.history = [];
  }

  /**
   * Get size of history
   */
  getSize(): number {
    return this.history.length;
  }

  /**
   * Export history as JSON
   */
  export(): string {
    return JSON.stringify(this.history);
  }

  /**
   * Import history from JSON
   */
  import(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as ResultHistoryEntry[];
      if (Array.isArray(parsed)) {
        this.history = parsed.slice(-MAX_HISTORY_SIZE);
        return true;
      }
    } catch (error) {
      console.error('[ResultHistoryManager] Import error:', error);
    }
    return false;
  }
}

/**
 * Create singleton instance
 */
let instance: ResultHistoryManager | null = null;

export function getResultHistoryManager(): ResultHistoryManager {
  if (!instance) {
    instance = new ResultHistoryManager();
  }
  return instance;
}

export default ResultHistoryManager;
