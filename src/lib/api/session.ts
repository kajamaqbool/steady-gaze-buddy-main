import axios from 'axios';
import { axiosInstance } from '../../api/authService';
import { MLResultPayload } from '../../api/types';

export class SessionResultError extends Error {
  public status: number;
  public isForbidden: boolean;
  public isUnauthorized: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SessionResultError';
    this.status = status;
    this.isForbidden = status === 403;
    this.isUnauthorized = status === 401;
  }
}

/**
 * Fetch session result via REST API
 * GET /api/gaze/sessions/{sessionId}/result
 * 
 * Returns:
 * - MLResultPayload on 200
 * - null on 202 (processing / pending)
 * - throws SessionResultError on 403 / 401
 */
export async function fetchSessionResult(sessionId: string): Promise<MLResultPayload | null> {
  try {
    const response = await axiosInstance.get<MLResultPayload | { status: string; message?: string; error?: string }>(
      `/api/gaze/sessions/${sessionId}/result`,
      {
        validateStatus: (status) => (status >= 200 && status < 300) || status === 202,
      }
    );

    if (response.status === 202) {
      return null;
    }

    return response.data as MLResultPayload;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status;
      const message = error.response.data?.error || error.response.data?.message || `HTTP ${status}`;
      if (status === 403 || status === 401) {
        throw new SessionResultError(message, status);
      }
    }
    throw error;
  }
}
