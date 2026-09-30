'use client';

import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function isSocketEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SOCKET_ENABLED !== 'false';
}

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

export function getSocket(): Socket | null {
  return socketInstance;
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
