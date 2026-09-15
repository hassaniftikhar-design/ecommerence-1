'use client';

import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

/**
 * Checks if WebSockets are enabled via environment variables.
 * Defaults to true unless explicitly disabled with 'false'.
 */
export function isSocketEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SOCKET_ENABLED !== 'false';
}

/**
 * Initializes and returns a singleton Socket.IO client instance.
 * NextAuth session cookies are sent automatically in the handshake via withCredentials: true.
 * No client-controlled room joining is performed.
 */
export function initSocket(): Socket | null {
  if (typeof window === 'undefined') return null;

  if (!isSocketEnabled()) {
    return null;
  }

  if (socketInstance) {
    if (!socketInstance.connected) {
      socketInstance.connect();
    }
    return socketInstance;
  }

  socketInstance = io({
    path: '/api/socket/io',
    withCredentials: true,
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    transports: ['websocket', 'polling']
  });

  return socketInstance;
}

/**
 * Returns the current active Socket.IO client instance if initialized.
 */
export function getSocket(): Socket | null {
  return socketInstance;
}

/**
 * Disconnects and cleans up the client Socket.IO instance (e.g. on logout).
 */
export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
