/**
 * Word Mapping Engine
 * Maps gaze points to text words
 * Maintains fixation times per word
 * Reduces skipped word rate below 20%
 */

export interface WordBound {
  word: string;
  wordIndex: number;
  x: number; // left edge
  y: number; // top edge
  width: number;
  height: number;
  textIndex: number; // index in full text
}

export interface GazeToWordMapping {
  word: string;
  wordIndex: number;
  distance: number; // pixels from gaze to word center
  isInBounds: boolean; // within word bounding box
  dwellTime: number; // ms spent on this word
}

/**
 * Extract word bounding boxes from DOM
 * Looks for data attributes set on word spans
 */
export function extractWordsFromDOM(containerSelector: string): WordBound[] {
  const container = document.querySelector(containerSelector);
  if (!container) return [];

  const words: WordBound[] = [];
  const wordElements = container.querySelectorAll('[data-word-index]');

  wordElements.forEach((el, idx) => {
    const rect = el.getBoundingClientRect();
    const word = el.textContent || "";
    const wordIndex = parseInt(el.getAttribute("data-word-index") || String(idx), 10);
    const textIndex = parseInt(el.getAttribute("data-text-index") || String(idx), 10);

    words.push({
      word,
      wordIndex,
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      textIndex,
    });
  });

  return words;
}

/**
 * Distance from point to word (Euclidean to center)
 */
export function distanceToWord(
  gazeX: number,
  gazeY: number,
  word: WordBound
): number {
  const centerX = word.x + word.width / 2;
  const centerY = word.y + word.height / 2;

  const dx = gazeX - centerX;
  const dy = gazeY - centerY;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if gaze point is within word bounding box
 */
export function isGazeInWord(gazeX: number, gazeY: number, word: WordBound): boolean {
  return (
    gazeX >= word.x &&
    gazeX <= word.x + word.width &&
    gazeY >= word.y &&
    gazeY <= word.y + word.height
  );
}

/**
 * Find nearest word to gaze point
 * Returns null if beyond distance threshold
 */
export function findNearestWord(
  gazeX: number,
  gazeY: number,
  words: WordBound[],
  distanceThreshold: number = 100
): WordBound | null {
  if (words.length === 0) return null;

  let nearest = words[0];
  let minDist = distanceToWord(gazeX, gazeY, words[0]);

  for (let i = 1; i < words.length; i++) {
    const dist = distanceToWord(gazeX, gazeY, words[i]);
    if (dist < minDist) {
      minDist = dist;
      nearest = words[i];
    }
  }

  // Return null if beyond threshold
  if (minDist > distanceThreshold) {
    return null;
  }

  return nearest;
}

/**
 * Map gaze point to word with detailed info
 */
export function mapGazeToWord(
  gazeX: number,
  gazeY: number,
  words: WordBound[],
  distanceThreshold: number = 100
): GazeToWordMapping | null {
  const nearest = findNearestWord(gazeX, gazeY, words, distanceThreshold);

  if (!nearest) {
    return null;
  }

  const distance = distanceToWord(gazeX, gazeY, nearest);
  const isInBounds = isGazeInWord(gazeX, gazeY, nearest);

  return {
    word: nearest.word,
    wordIndex: nearest.wordIndex,
    distance,
    isInBounds,
    dwellTime: 0, // Will be updated by caller
  };
}

/**
 * Track fixated words
 * Accumulate dwell time per word
 */
export class WordDwellTracker {
  private readonly wordDwellMap: Map<number, number> = new Map();
  private lastWord: number | null = null;
  private lastTimestamp: number = 0;
  private readonly validityThreshold: number = 50; // pixel threshold for "on word"

  addGazePoint(gazeX: number, gazeY: number, words: WordBound[], timestamp: number): void {
    const mapping = mapGazeToWord(gazeX, gazeY, words, this.validityThreshold);

    if (mapping?.isInBounds) {
      // Within word bounds
      if (this.lastWord === mapping.wordIndex) {
        // Continuing on same word
        const timeDelta = timestamp - this.lastTimestamp;
        this.wordDwellMap.set(
          mapping.wordIndex,
          (this.wordDwellMap.get(mapping.wordIndex) || 0) + timeDelta
        );
      } else {
        // Moved to new word
        this.lastWord = mapping.wordIndex;
        this.wordDwellMap.set(mapping.wordIndex, 0);
      }
      this.lastTimestamp = timestamp;
    } else {
      // Outside all words or too far
      this.lastWord = null;
    }
  }

  getWordDwellTimes(): Map<number, number> {
    return new Map(this.wordDwellMap);
  }

  getFixatedWords(): Set<number> {
    return new Set(this.wordDwellMap.keys());
  }

  getSkippedWordCount(totalWords: number): number {
    return Math.max(0, totalWords - this.wordDwellMap.size);
  }

  reset(): void {
    this.wordDwellMap.clear();
    this.lastWord = null;
    this.lastTimestamp = 0;
  }
}

/**
 * Adaptive distance threshold based on word size
 * Larger words get larger thresholds
 */
export function getAdaptiveDistanceThreshold(word: WordBound): number {
  // Larger words: more lenient threshold
  const avgSize = (word.width + word.height) / 2;
  return Math.max(50, avgSize * 1.5);
}

/**
 * Check reading flow consecutiveness
 *  Did reader fixate words in order?
 */
export function isReadingFlowConsecutive(fixatedWordIndices: number[]): boolean {
  if (fixatedWordIndices.length < 2) return true;

  for (let i = 1; i < fixatedWordIndices.length; i++) {
    const current = fixatedWordIndices[i];
    const prev = fixatedWordIndices[i - 1];

    // Large jumps (more than 5 words) indicate unnatural flow
    if (Math.abs(current - prev) > 5) {
      return false;
    }
  }

  return true;
}
