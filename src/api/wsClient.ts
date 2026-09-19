/**
 * PHASE 3: STOMP WebSocket Client with JWT Authentication
 * SockJS fallback + auto-reconnect + heartbeat management
 * 
 * FIX: Ensures JWT token is properly extracted and sent to backend
 * on both CONNECT and every frame for authentication
 */

import { Client, Message, IFrame } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { getStoredTokens, authService, maskToken } from './authService';
import { ConnectionStatus } from './types';

const DEFAULT_WS_PATH = '/ws/gaze';
const rawWsUrl = import.meta.env.VITE_WS_URL || DEFAULT_WS_PATH;
const WS_URL = (() => {
  if (/^(wss?:\/\/|https?:\/\/)/i.test(rawWsUrl)) {
    return rawWsUrl;
  }
  if (rawWsUrl.startsWith('/')) {
    return `${window.location.origin}${rawWsUrl}`;
  }
  return `${window.location.origin}/${rawWsUrl}`;
})();

console.log('[STOMP] Resolved WebSocket URL:', WS_URL);

type ConnectionCallback = (status: ConnectionStatus) => void;
type MessageCallback = (message: Message) => void;

class StompWebSocketClient {
  private client: Client | null = null;
  private connectionStatus: ConnectionStatus = 'DISCONNECTED';
  private readonly connectionCallbacks: Set<ConnectionCallback> = new Set();
  private readonly messageSubscriptions: Map<string, Set<MessageCallback>> = new Map();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 3000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly heartbeatIncoming = 10000;
  private readonly heartbeatOutgoing = 10000;
  private isIntentionallyClosed = false;

  /**
   * Extract username from JWT token (sub claim)
   */
  private extractUsernameFromToken(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const decoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(decoded);
      return payload.sub || payload.username || payload.user || null;
    } catch {
      return null;
    }
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);
    callback(this.connectionStatus);
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

  /**
   * Set connection status and notify all listeners
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      console.log(`[STOMP] Connection status: ${status}`);
      this.connectionCallbacks.forEach(cb => cb(status));
    }
  }

  /**
   * Connect to STOMP server with JWT in headers
   */
  async connect(): Promise<void> {
    if (this.client?.active) {
      console.warn('[STOMP] Already connected');
      return;
    }

    this.isIntentionallyClosed = false;
    this.setConnectionStatus('CONNECTING');

    try {
      if (!authService.isAuthenticated()) {
        const tokens = getStoredTokens();
        if (tokens?.refreshToken) {
          try {
            console.log('[STOMP] Access token expired, attempting refresh');
            await authService.refreshToken();
          } catch (e) {
            console.error('[STOMP] Token refresh failed:', e);
            this.handleAuthFailure();
            throw new Error('Token refresh failed. Please log in again.');
          }
        } else {
          console.error('[STOMP] No valid tokens present - aborting connect');
          this.handleAuthFailure();
          throw new Error('Not authenticated - cannot connect to WebSocket');
        }
      }

      const tokens = getStoredTokens();
      if (!tokens?.accessToken) {
        this.handleAuthFailure();
        throw new Error('No access token available');
      }

      // Extract username from JWT for proper identification
      const username = this.extractUsernameFromToken(tokens.accessToken);
      console.log('[STOMP] Connecting with user:', username || 'unknown', 'token:', maskToken(tokens.accessToken));

      if (this.client && this.client.active) {
        try {
          this.client.deactivate();
        } catch (e) {
          console.warn('[STOMP] Error deactivating existing client', e);
        }
      }

      this.client = new Client({
        brokerURL: undefined,
        webSocketFactory: () => {
          return new SockJS(WS_URL) as WebSocket;
        },
        connectHeaders: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'login': username || 'anonymous',
          'passcode': '', // Required by STOMP
          'X-Username': username || 'unknown',
          'X-Auth-Token': `Bearer ${tokens.accessToken}`,
        },
        heartbeatIncoming: this.heartbeatIncoming,
        heartbeatOutgoing: this.heartbeatOutgoing,
        reconnectDelay: 0,

        onConnect: this.onStompConnect.bind(this),
        onStompError: this.onStompError.bind(this),
        onWebSocketClose: this.onWebSocketClose.bind(this),
        onWebSocketError: this.onWebSocketError.bind(this),
      });

      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.client.debug = (msg: string) => console.debug('[STOMP DEBUG]', msg);
      } catch (e) {
        console.warn('[STOMP] Unable to set debug fn', e);
      }

      this.client.activate();
      console.log('[STOMP] Client activated for user:', username || 'unknown');
    } catch (error) {
      console.error('[STOMP] Connection failed:', error);
      this.setConnectionStatus('ERROR');
      throw error;
    }
  }

  private handleAuthFailure() {
    if ((window as any).__logout) {
      (window as any).__logout();
    }
  }

  /**
   * Called when STOMP connection is established
   */
  private onStompConnect(): void {
    console.log('[STOMP] 🌟 ==========================================');
    console.log('[STOMP] ✅ STOMP CONNECTION ESTABLISHED');
    console.log('[STOMP] 🌟 ==========================================');
    this.setConnectionStatus('CONNECTED');
    this.reconnectAttempts = 0;

    this.subscribeToDefaultQueues();
    console.log('[STOMP] 🔔 Subscribed to default queues');
  }

  /**
   * Called on STOMP protocol error
   */
  private onStompError(frame: IFrame): void {
    console.error('[STOMP] Error frame:', frame.body);
    this.setConnectionStatus('ERROR');
  }

  /**
   * Called when WebSocket closes
   */
  private onWebSocketClose(): void {
    console.log('[STOMP] WebSocket closed');
    if (this.isIntentionallyClosed) {
      this.setConnectionStatus('DISCONNECTED');
      return;
    }

    this.setConnectionStatus('RECONNECTING');
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    const attempt = Math.min(this.reconnectAttempts, this.maxReconnectAttempts);
    const delay = Math.min(this.reconnectDelay * Math.pow(2, attempt), 30000);

    console.log(`[STOMP] Scheduling reconnect attempt #${this.reconnectAttempts + 1} in ${delay}ms`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.reconnectAttempts += 1;
      try {
        if (!authService.isAuthenticated()) {
          console.log('[STOMP] Refreshing token before reconnect');
          const tokens = getStoredTokens();
          if (tokens?.refreshToken) {
            await authService.refreshToken();
          } else {
            console.warn('[STOMP] No refresh token available, aborting reconnect');
            this.handleAuthFailure();
            return;
          }
        }

        await this.connect();
      } catch (err) {
        console.error('[STOMP] Reconnect attempt failed:', err);
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * Called on WebSocket error
   */
  private onWebSocketError(error: Event): void {
    console.error('[STOMP] WebSocket error:', error);
    this.setConnectionStatus('ERROR');
  }

  /**
   * Subscribe to default system queues
   */
  private subscribeToDefaultQueues(): void {
    this.subscribe('/user/queue/ack', (message) => {
      this.handleMessage('/user/queue/ack', message);
    });

    this.subscribe('/user/queue/result', (message) => {
      this.handleMessage('/user/queue/result', message);
    });

    this.subscribe('/user/queue/errors', (message) => {
      this.handleMessage('/user/queue/errors', message);
    });
  }

  /**
   * Subscribe to a destination
   */
  subscribe(destination: string, callback: MessageCallback): () => void {
    if (!this.client?.connected) {
      console.warn(`[STOMP] Not connected, cannot subscribe to ${destination}`);
      return () => {};
    }

    if (!this.messageSubscriptions.has(destination)) {
      this.messageSubscriptions.set(destination, new Set());
    }
    this.messageSubscriptions.get(destination)!.add(callback);

    const subscription = this.client.subscribe(destination, (message) => {
      callback(message);
    });

    return () => {
      this.messageSubscriptions.get(destination)?.delete(callback);
      subscription.unsubscribe();
    };
  }

  /**
   * Dispatch message to all listeners
   */
  private handleMessage(destination: string, message: Message): void {
    try {
      if (destination === '/user/queue/ack') {
        try {
          const ack = JSON.parse(message.body);
          console.log('[STOMP] 📥 ACK received:', {
            id: ack.id,
            status: ack.status,
            message: ack.message,
          });
        } catch (e) {
          console.log('[STOMP] 📥 ACK received (raw)');
        }
      } else if (destination === '/user/queue/result') {
        try {
          const result = JSON.parse(message.body);
          console.log('[STOMP] 📥 ML Result received:', {
            sessionId: result.sessionId,
            riskScore: result.riskScore,
            classification: result.classification,
          });
        } catch (e) {
          console.log('[STOMP] 📥 Result received (raw)');
        }
      } else if (destination === '/user/queue/errors') {
        try {
          const error = JSON.parse(message.body);
          console.error('[STOMP] 🚨 Error received:', error);
        } catch (e) {
          console.error('[STOMP] 🚨 Error message (raw):', message.body);
        }
      }
    } catch (logError) {
      // Ignore logging errors
    }

    const callbacks = this.messageSubscriptions.get(destination);
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          cb(message);
        } catch (error) {
          console.error(`[STOMP] Error in message handler for ${destination}:`, error);
        }
      });
    }
  }

  /**
   * Publish message to destination
   */
  publish(
    destination: string,
    body: Record<string, any> | string,
    skipContentLengthHeader = false
  ): void {
    if (!this.client?.connected) {
      console.warn('[STOMP] Not connected, cannot publish to', destination);
      return;
    }

    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);

    try {
      const tokens = getStoredTokens();
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };

      if (tokens?.accessToken) {
        const username = this.extractUsernameFromToken(tokens.accessToken);
        // Send auth in multiple formats to ensure backend can extract it
        headers['Authorization'] = `Bearer ${tokens.accessToken}`;
        headers['X-Auth-Token'] = `Bearer ${tokens.accessToken}`;
        if (username) {
          headers['X-Username'] = username;
        }
      }

      this.client.publish({
        destination,
        body: bodyString,
        skipContentLengthHeader,
        headers,
      });
    } catch (error) {
      console.error('[STOMP] Publish error:', error);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client?.active === true && this.connectionStatus === 'CONNECTED';
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Disconnect gracefully
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;

    if (this.client?.connected) {
      this.client.deactivate();
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.messageSubscriptions.clear();
    this.setConnectionStatus('DISCONNECTED');
    console.log('[STOMP] Disconnected');
  }

  /**
   * Force reconnect
   */
  async forceReconnect(): Promise<void> {
    this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.connect();
  }

  /**
   * Get reconnect stats
   */
  getReconnectStats(): { attempts: number; delay: number; maxAttempts: number } {
    return {
      attempts: this.reconnectAttempts,
      delay: this.reconnectDelay,
      maxAttempts: this.maxReconnectAttempts,
    };
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.messageSubscriptions.size;
  }
}

export const stompClient = new StompWebSocketClient();

export default stompClient;
