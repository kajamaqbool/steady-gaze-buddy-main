import { getStoredTokens } from './authService';
import { SpeechAnalysisResponse } from './types';

export const PASSAGE_TEXT =
  "Riya loved spending time in the small garden behind her house. Every morning, she watered the plants before going to school. One day, she noticed a tiny green bird sitting on a branch. The bird looked tired and could not fly away. Riya quietly brought a small bowl of water and placed it near the tree. After drinking the water, the bird moved its wings and jumped from one branch to another. Riya watched it carefully and smiled.\n\nThe next morning, the bird returned to the garden. It sang a soft song while Riya watered the flowers. She began to visit the garden every day. Soon, she noticed that more birds were coming to the trees. Riya learned that even a small act of kindness could make a difference.";

export interface UploadOralReadingOptions {
  audioBlob: Blob;
  referenceText?: string;
  sessionId?: string;
  language?: 'en' | 'ta' | 'hi' | 'te' | string;
}

export const speechService = {
  /**
   * Upload recorded oral reading audio to the backend speech-analysis API endpoint (/api/speech/analyze).
   * Spring Boot backend contract:
   *   file          = recorded audio blob
   *   referenceText = same passage text shown during gaze reading session
   *   sessionId     = gaze session ID (links gaze & speech)
   *   language      = "en" | "ta" | "hi" | "te"
   */
  async uploadOralReadingAudio(options: UploadOralReadingOptions | Blob, referenceTextParam?: string): Promise<SpeechAnalysisResponse> {
    let audioBlob: Blob;
    let refText: string | undefined;
    let sessId: string | undefined;
    let lang: string | undefined = 'en';

    if (options instanceof Blob) {
      audioBlob = options;
      refText = referenceTextParam;
    } else {
      audioBlob = options.audioBlob;
      refText = options.referenceText;
      sessId = options.sessionId;
      lang = options.language || 'en';
    }

    const formData = new FormData();
    const mimeType = audioBlob.type || 'audio/webm';
    let fileExt = 'webm';
    if (mimeType.includes('wav')) fileExt = 'wav';
    else if (mimeType.includes('mp4') || mimeType.includes('m4a')) fileExt = 'm4a';
    else if (mimeType.includes('ogg')) fileExt = 'ogg';

    formData.append('file', audioBlob, `oral_reading_${Date.now()}.${fileExt}`);
    formData.append('referenceText', refText || PASSAGE_TEXT);
    formData.append('reference_text', refText || PASSAGE_TEXT); // duplicate key for backward compatibility
    if (sessId) {
      formData.append('sessionId', sessId);
    }
    formData.append('language', lang);

    const tokens = getStoredTokens();
    const headers: Record<string, string> = {};
    if (tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }

    // Set 35 second client timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    try {
      const response = await fetch('/api/speech/analyze', {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = `Server returned HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorData.error || errorMsg;
        } catch (e) {
          // ignore parse error
        }

        if (response.status === 415) {
          errorMsg = 'Audio format could not be processed. Please try recording again.';
        } else if (response.status === 400) {
          errorMsg = "We didn't catch any reading — want to try again?";
        } else if (response.status >= 500) {
          errorMsg = "Couldn't process the reading. You can retry or skip.";
        }

        const err = new Error(errorMsg) as any;
        err.status = response.status;
        throw err;
      }

      return await response.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error("Couldn't process the reading in time. You can retry or skip.") as any;
        timeoutErr.status = 408;
        throw timeoutErr;
      }
      throw err;
    }
  },
};
