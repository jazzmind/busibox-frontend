/**
 * Server-Sent Events (SSE) Client Utility
 *
 * Generic SSE connection management for real-time streams:
 * - Automatic reconnection with exponential backoff
 * - Connection state management
 * - Event parsing and type safety
 * - Error handling and recovery
 * - Multiple concurrent streams support
 *
 * No external imports - suitable for shared package use.
 */

// ==========================================================================
// TYPES
// ==========================================================================

export type SSEConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'closed';

export interface SSEEvent<T = unknown> {
  type: string;
  data: T;
  id?: string;
  retry?: number;
}

export interface SSEOptions {
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
  timeout?: number;
  withCredentials?: boolean;
}

export interface SSECallbacks {
  onOpen?: () => void;
  onMessage?: (event: SSEEvent) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onStateChange?: (state: SSEConnectionState) => void;
}

// ==========================================================================
// SSE CLIENT CLASS
// ==========================================================================

export class SSEClient {
  private url: string;
  private options: Required<SSEOptions>;
  private callbacks: SSECallbacks;
  private eventSource: EventSource | null = null;
  private state: SSEConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isClosed = false;

  constructor(url: string, options: SSEOptions = {}, callbacks: SSECallbacks = {}) {
    this.url = url;
    this.options = {
      reconnect: options.reconnect ?? true,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 5,
      reconnectInterval: options.reconnectInterval ?? 1000,
      maxReconnectInterval: options.maxReconnectInterval ?? 30000,
      timeout: options.timeout ?? 30000,
      withCredentials: options.withCredentials ?? true,
    };
    this.callbacks = callbacks;
  }

  /**
   * Connect to SSE endpoint
   */
  connect(): void {
    if (this.isClosed) {
      console.warn('[SSEClient] Cannot connect: client is closed');
      return;
    }

    if (this.eventSource) {
      console.warn('[SSEClient] Already connected or connecting');
      return;
    }

    this.setState('connecting');

    try {
      // Create EventSource with credentials
      this.eventSource = new EventSource(this.url, {
        withCredentials: this.options.withCredentials,
      });

      // Set up event listeners
      this.eventSource.onopen = () => this.handleOpen();
      this.eventSource.onerror = (event) => this.handleError(event);
      this.eventSource.onmessage = (event) => this.handleMessage(event);

      // Set connection timeout
      if (this.options.timeout > 0) {
        setTimeout(() => {
          if (this.state === 'connecting') {
            this.handleError(new Error('Connection timeout'));
          }
        }, this.options.timeout);
      }
    } catch (error: unknown) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Disconnect from SSE endpoint
   */
  disconnect(): void {
    this.clearReconnectTimer();

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.setState('disconnected');
  }

  /**
   * Close connection permanently (no reconnection)
   */
  close(): void {
    this.isClosed = true;
    this.disconnect();
    this.setState('closed');
    this.callbacks.onClose?.();
  }

  /**
   * Get current connection state
   */
  getState(): SSEConnectionState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'connected';
  }

  /**
   * Subscribe to specific event type
   */
  addEventListener(eventType: string, callback: (event: MessageEvent) => void): void {
    if (this.eventSource) {
      this.eventSource.addEventListener(eventType, callback);
    }
  }

  /**
   * Remove event listener
   */
  removeEventListener(eventType: string, callback: (event: MessageEvent) => void): void {
    if (this.eventSource) {
      this.eventSource.removeEventListener(eventType, callback);
    }
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private setState(newState: SSEConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.callbacks.onStateChange?.(newState);
    }
  }

  private handleOpen(): void {
    console.log('[SSEClient] Connection opened');
    this.reconnectAttempts = 0;
    this.setState('connected');
    this.callbacks.onOpen?.();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      const sseEvent: SSEEvent = {
        type: event.type || 'message',
        data,
        id: event.lastEventId,
      };

      this.callbacks.onMessage?.(sseEvent);
    } catch (error) {
      console.error('[SSEClient] Failed to parse message:', error);
    }
  }

  private handleError(error: Event | Error): void {
    console.error('[SSEClient] Connection error:', error);

    const errorObj = error instanceof Error ? error : new Error('SSE connection error');

    this.setState('error');
    this.callbacks.onError?.(errorObj);

    // Attempt reconnection if enabled
    if (this.options.reconnect && !this.isClosed) {
      this.attemptReconnect();
    } else {
      this.disconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('[SSEClient] Max reconnection attempts reached');
      this.disconnect();
      return;
    }

    this.reconnectAttempts++;

    // Calculate backoff delay with exponential increase
    const delay = Math.min(
      this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      this.options.maxReconnectInterval
    );

    console.log(
      `[SSEClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`
    );

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.disconnect();
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// ==========================================================================
// CONNECTION MANAGER
// ==========================================================================

/**
 * Manages multiple SSE connections with limits
 */
export class SSEConnectionManager {
  protected connections = new Map<string, SSEClient>();
  protected maxConnections: number;

  constructor(maxConnections: number = 100) {
    this.maxConnections = maxConnections;
  }

  /**
   * Create and track a new SSE connection
   */
  createConnection(
    id: string,
    url: string,
    options?: SSEOptions,
    callbacks?: SSECallbacks
  ): SSEClient | null {
    // Check connection limit
    if (this.connections.size >= this.maxConnections) {
      console.error('[SSEConnectionManager] Max connections reached');
      return null;
    }

    // Close existing connection with same ID
    this.closeConnection(id);

    // Create new connection
    const client = new SSEClient(url, options, {
      ...callbacks,
      onClose: () => {
        this.connections.delete(id);
        callbacks?.onClose?.();
      },
    });

    this.connections.set(id, client);
    client.connect();

    return client;
  }

  /**
   * Get connection by ID
   */
  getConnection(id: string): SSEClient | undefined {
    return this.connections.get(id);
  }

  /**
   * Close specific connection
   */
  closeConnection(id: string): void {
    const connection = this.connections.get(id);
    if (connection) {
      connection.close();
      this.connections.delete(id);
    }
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    this.connections.forEach((connection) => connection.close());
    this.connections.clear();
  }

  /**
   * Get number of active connections
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get all connection IDs
   */
  getConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }
}

// ==========================================================================
// GLOBAL MANAGER INSTANCE
// ==========================================================================

// Global SSE connection manager (singleton)
let globalManager: SSEConnectionManager | null = null;

export function getSSEManager(): SSEConnectionManager {
  if (!globalManager) {
    const maxStreams = parseInt(process.env.MAX_SSE_STREAMS || '100', 10);
    globalManager = new SSEConnectionManager(maxStreams);
  }
  return globalManager;
}
