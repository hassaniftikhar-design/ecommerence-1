'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import type { Socket } from 'socket.io-client';
import { initSocket, disconnectSocket, isSocketEnabled } from '@/lib/socket/client';
import { getNotifications } from '@/services/notification.service';
import type { NotificationItem } from '@/types/notification.types';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  unreadCount: number;
  adminUnreadCount: number;
  hasMore: boolean;
  adminHasMore: boolean;
  notifications: NotificationItem[];
  adminNotifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  setAdminNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  setAdminUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  setHasMore: React.Dispatch<React.SetStateAction<boolean>>;
  setAdminHasMore: React.Dispatch<React.SetStateAction<boolean>>;
  refreshNotifications: (adminOnly?: boolean) => Promise<void>;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  unreadCount: 0,
  adminUnreadCount: 0,
  hasMore: false,
  adminHasMore: false,
  notifications: [],
  adminNotifications: [],
  setNotifications: () => { },
  setAdminNotifications: () => { },
  setUnreadCount: () => { },
  setAdminUnreadCount: () => { },
  setHasMore: () => { },
  setAdminHasMore: () => { },
  refreshNotifications: async () => { }
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { status, data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [adminUnreadCount, setAdminUnreadCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [adminHasMore, setAdminHasMore] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<NotificationItem[]>([]);
  const hasInitializedRef = useRef<boolean>(false);

  const isAdmin = (session?.user as { role?: string })?.role === 'ADMIN';

  const refreshNotifications = useCallback(async (adminOnly: boolean = false) => {
    if (status !== 'authenticated') return;
    try {
      const data = await getNotifications(1, 10, adminOnly ? 'IMPORT_ERRORS' : undefined);
      if (adminOnly) {
        setAdminNotifications(data.notifications || []);
        setAdminUnreadCount(data.unreadCount || 0);
        setAdminHasMore(Boolean(data.hasMore));
      } else {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setHasMore(Boolean(data.hasMore));
      }
    } catch (err) {
      console.error('[SocketProvider] Failed to fetch notifications:', err);
    }
  }, [status]);

  // Initial single load on user authentication
  useEffect(() => {
    if (status === 'authenticated' && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      refreshNotifications(false);
      if (isAdmin) {
        refreshNotifications(true);
      }
    } else if (status === 'unauthenticated') {
      hasInitializedRef.current = false;
      setNotifications([]);
      setAdminNotifications([]);
      setUnreadCount(0);
      setAdminUnreadCount(0);
      setHasMore(false);
      setAdminHasMore(false);
    }
  }, [status, isAdmin, refreshNotifications]);

  useEffect(() => {
    if (!isSocketEnabled()) {
      return;
    }

    if (status === 'authenticated') {
      const socketClient = initSocket();
      if (socketClient) {
        setSocket(socketClient);
        setIsConnected(socketClient.connected);

        const handleConnect = () => {
          console.log('[SOCKET] CONNECTED', socketClient.id);
          setIsConnected(true);
        };

        const handleDisconnect = (reason: string) => {
          console.log('[SOCKET] DISCONNECTED', reason);
          setIsConnected(false);
        };

        const handleConnectError = (err: Error) => {
          console.warn('[SOCKET] CONNECTION ERROR:', err.message);
          setIsConnected(false);
        };

        const handleNewNotification = (item: NotificationItem) => {
          setNotifications((prev) => {
            if (prev.some((n) => n.id === item.id)) return prev;
            return [item, ...prev];
          });

          if (item.type === 'IMPORT_ERRORS') {
            setAdminNotifications((prev) => {
              if (prev.some((n) => n.id === item.id)) return prev;
              return [item, ...prev];
            });
          }
        };

        const handleUnreadCount = (data: { count: number }) => {
          if (typeof data?.count === 'number') {
            setUnreadCount(data.count);
            setAdminUnreadCount(data.count);
          }
        };

        socketClient.on('connect', handleConnect);
        socketClient.on('disconnect', handleDisconnect);
        socketClient.on('connect_error', handleConnectError);
        socketClient.on('notification:new', handleNewNotification);
        socketClient.on('notification:unread-count', handleUnreadCount);

        return () => {
          socketClient.off('connect', handleConnect);
          socketClient.off('disconnect', handleDisconnect);
          socketClient.off('connect_error', handleConnectError);
          socketClient.off('notification:new', handleNewNotification);
          socketClient.off('notification:unread-count', handleUnreadCount);
        };
      }
    } else if (status === 'unauthenticated') {
      disconnectSocket();
      setSocket(null);
      setIsConnected(false);
    }
  }, [status]);

  // Fallback polling only when WebSocket is disconnected
  useEffect(() => {
    console.log('[FALLBACK] EFFECT', {
      status,
      isConnected,
      isAdmin
    });

    if (status !== 'authenticated' || isConnected) {
      console.log('[FALLBACK] NOT STARTING');
      return;
    }

    console.log('[FALLBACK] STARTING POLLING');

    const interval = setInterval(() => {
      console.log('[FALLBACK] POLLING NOW');

      refreshNotifications(false);

      if (isAdmin) {
        refreshNotifications(true);
      }
    }, 30000);

    return () => {
      console.log('[FALLBACK] CLEANUP');
      clearInterval(interval);
    };
  }, [status, isConnected, isAdmin, refreshNotifications]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        unreadCount,
        adminUnreadCount,
        hasMore,
        adminHasMore,
        notifications,
        adminNotifications,
        setNotifications,
        setAdminNotifications,
        setUnreadCount,
        setAdminUnreadCount,
        setHasMore,
        setAdminHasMore,
        refreshNotifications
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

/**
 * Hook to access the client socket instance, real-time connection status, and shared notification state.
 */
export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}