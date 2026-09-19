/**
 * PHASE 4: Word Mapping Module
 * 
 * Maps gaze coordinates to text words:
 * - Extract word bounding boxes from DOM
 * - Find nearest word to gaze point
 * - Track fixation assignments per word
 */

export interface WordBound {
  id: string;
  text: string;
  wordIndex: number;        // Position in story
  x: number;                // Pixel coordinates (CSS)
  y: number;
  width: number;
  height: number;
}

export interface GazeToWordMapping {
  word: string;
  wordIndex: number;
  wordId: string;
  distanceToCenter: number; // Euclidean distance (normalized)
  distanceToEdge: number;   // Distance to nearest edge (normalized)
  isInBounds: boolean;      // Within word bounding box
}

export interface WordFixationSummary {
  wordId: string;
  word: string;
  wordIndex: number;
  fixationCount: number;
  totalDwellTimeMs: number;
  averageFixationDuration: number;
  firstFixationTimeMs: number;
  lastFixationTimeMs: number;
}

// ============================================================================
// DOM WORD EXTRACTION
// ============================================================================

/**
 * Extract word bounding boxes from DOM
 * Assumes HTML like: <span data-word-index="0">The</span>
 */
export function extractWordsFromDOM(containerSelector: string): WordBound[] {
  const container = document.querySelector(containerSelector);
  if (!container) return [];

  const words: WordBound[] = [];
  const wordElements = container.querySelectorAll("[data-word-index]");
  let wordElementIndex = 0;

  wordElements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const text = el.textContent || "";
    const wordIndex = parseInt(el.getAttribute("data-word-index") || "0", 10);

    if (text.trim().length === 0) return; // Skip empty elements

    words.push({
      id: `word_${wordElementIndex++}`,
      text: text.trim(),
      wordIndex,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    });
  });

  return words;
}

// ============================================================================
// DISTANCE CALCULATIONS
// ============================================================================

/**
 * Euclidean distance from point to word center
 * Normalized coordinates [0, 1]
 */
function distanceToWordCenter(
  gazeX: number,
  gazeY: number,
  word: WordBound,
  screenWidth: number,
  screenHeight: number
): number {
  const wordCenterX = (word.x + word.width / 2) / screenWidth;
  const wordCenterY = (word.y + word.height / 2) / screenHeight;

  const dx = gazeX - wordCenterX;
  const dy = gazeY - wordCenterY;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Distance from point to word bounding box edge
 * Returns 0 if inside box
 */
function distanceToWordEdge(
  gazeX: number,
  gazeY: number,
  word: WordBound,
  screenWidth: number,
  screenHeight: number
): number {
  // Convert word bounds to normalized coordinates
  const wordLeft = word.x / screenWidth;
  const wordRight = (word.x + word.width) / screenWidth;
  const wordTop = word.y / screenHeight;
  const wordBottom = (word.y + word.height) / screenHeight;

  if (
    gazeX >= wordLeft &&
    gazeX <= wordRight &&
    gazeY >= wordTop &&
    gazeY <= wordBottom
  ) {
    return 0; // Inside
  }

  // Find closest edge
  const closestX = Math.max(wordLeft, Math.min(gazeX, wordRight));
  const closestY = Math.max(wordTop, Math.min(gazeY, wordBottom));

  const dx = gazeX - closestX;
  const dy = gazeY - closestY;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if gaze is within word bounding box
 */
function isGazeInWord(
  gazeX: number,
  gazeY: number,
  word: WordBound,
  screenWidth: number,
  screenHeight: number
): boolean {
  const wordLeft = word.x / screenWidth;
  const wordRight = (word.x + word.width) / screenWidth;
  const wordTop = word.y / screenHeight;
  const wordBottom = (word.y + word.height) / screenHeight;

  return (
    gazeX >= wordLeft &&
    gazeX <= wordRight &&
    gazeY >= wordTop &&
    gazeY <= wordBottom
  );
}

// ============================================================================
// WORD MAPPING
// ============================================================================

/**
 * Find nearest word to gaze point
 * Uses both distance-to-center and in-bounds heuristics
 */
export function findNearestWord(
  gazeX: number,
  gazeY: number,
  words: WordBound[],
  screenWidth: number,
  screenHeight: number,
  distanceThreshold: number = 0.1  // Normalized units
): WordBound | null {
  if (words.length === 0) return null;

  // First, check if gaze is within any word (highest priority)
  for (const word of words) {
    if (isGazeInWord(gazeX, gazeY, word, screenWidth, screenHeight)) {
      return word;
    }
  }

  // Find nearest word
  let nearest: WordBound | null = null;
  let minDistance = distanceThreshold;

  for (const word of words) {
    const distance = distanceToWordCenter(
      gazeX,
      gazeY,
      word,
      screenWidth,
      screenHeight
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearest = word;
    }
  }

  return nearest;
}

/**
 * Map gaze point to word with detailed matching info
 */
export function mapGazeToWord(
  gazeX: number,
  gazeY: number,
  words: WordBound[],
  screenWidth: number,
  screenHeight: number,
  distanceThreshold: number = 0.1
): GazeToWordMapping | null {
  const nearest = findNearestWord(
    gazeX,
    gazeY,
    words,
    screenWidth,
    screenHeight,
    distanceThreshold
  );

  if (!nearest) {
    return null;
  }

  const distToCenter = distanceToWordCenter(
    gazeX,
    gazeY,
    nearest,
    screenWidth,
    screenHeight
  );

  const distToEdge = distanceToWordEdge(
    gazeX,
    gazeY,
    nearest,
    screenWidth,
    screenHeight
  );

  const inBounds = isGazeInWord(
    gazeX,
    gazeY,
    nearest,
    screenWidth,
    screenHeight
  );

  return {
    word: nearest.text,
    wordIndex: nearest.wordIndex,
    wordId: nearest.id,
    distanceToCenter: distToCenter,
    distanceToEdge: distToEdge,
    isInBounds: inBounds,
  };
}

// ============================================================================
// WORD FIXATION TRACKING
// ============================================================================

export class WordFixationTracker {
  private readonly wordMap: Map<string, WordFixationSummary> = new Map();
  private readonly screenWidth: number;
  private readonly screenHeight: number;
  private readonly words: WordBound[];
  private readonly distanceThreshold: number;

  constructor(
    words: WordBound[],
    screenWidth: number,
    screenHeight: number,
    distanceThreshold: number = 0.1
  ) {
    this.words = words;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.distanceThreshold = distanceThreshold;

    // Initialize all words
    words.forEach((word) => {
      this.wordMap.set(word.id, {
        wordId: word.id,
        word: word.text,
        wordIndex: word.wordIndex,
        fixationCount: 0,
        totalDwellTimeMs: 0,
        averageFixationDuration: 0,
        firstFixationTimeMs: 0,
        lastFixationTimeMs: 0,
      });
    });
  }

  /**
   * Record fixation on word
   */
  recordFixation(
    wordId: string,
    durationMs: number,
    timestampMs: number
  ): void {
    const summary = this.wordMap.get(wordId);
    if (!summary) return;

    summary.fixationCount++;
    summary.totalDwellTimeMs += durationMs;
    summary.averageFixationDuration =
      summary.totalDwellTimeMs / summary.fixationCount;

    if (summary.firstFixationTimeMs === 0) {
      summary.firstFixationTimeMs = timestampMs;
    }
    summary.lastFixationTimeMs = timestampMs;
  }

  /**
   * Get summary for word
   */
  getSummary(wordId: string): WordFixationSummary | undefined {
    return this.wordMap.get(wordId);
  }

  /**
   * Get all word summaries
   */
  getAllSummaries(): WordFixationSummary[] {
    return Array.from(this.wordMap.values());
  }

  /**
   * Get reading flow: which words were fixated and in what order
   */
  getReadingFlow(): Array<{
    word: string;
    wordIndex: number;
    fixationCount: number;
    dwellTimeMs: number;
  }> {
    return this.getAllSummaries()
      .filter((s) => s.fixationCount > 0)
      .sort((a, b) => a.firstFixationTimeMs - b.firstFixationTimeMs)
      .map((s) => ({
        word: s.word,
        wordIndex: s.wordIndex,
        fixationCount: s.fixationCount,
        dwellTimeMs: s.totalDwellTimeMs,
      }));
  }

  /**
   * Calculate skipped word rate
   */
  getSkippedWordRate(): number {
    const totalWords = this.wordMap.size;
    const fixatedWords = Array.from(this.wordMap.values()).filter(
      (s) => s.fixationCount > 0
    ).length;

    if (totalWords === 0) return 0;
    return ((totalWords - fixatedWords) / totalWords) * 100;
  }

  /**
   * Detect regressive reading flow (backward eye movements)
   */
  detectRegressions(): Array<{
    fromWord: string;
    toWord: string;
    fromIndex: number;
    toIndex: number;
  }> {
    const flow = this.getReadingFlow();
    const regressions: Array<{
      fromWord: string;
      toWord: string;
      fromIndex: number;
      toIndex: number;
    }> = [];

    for (let i = 1; i < flow.length; i++) {
      if (flow[i].wordIndex < flow[i - 1].wordIndex) {
        regressions.push({
          fromWord: flow[i - 1].word,
          toWord: flow[i].word,
          fromIndex: flow[i - 1].wordIndex,
          toIndex: flow[i].wordIndex,
        });
      }
    }

    return regressions;
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types are already exported in their interface definitions above
