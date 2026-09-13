'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { Bell, Package, ShoppingBag, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useSession } from 'next-auth/react';

import {
  NOTIFICATIONS_PER_PAGE,
  NOTIFICATIONS_LAZY_LOAD_DELAY_MS
} from '@/constants/generalconstants';
import { getNotifications, markNotificationAsRead } from '@/services/notification.service';
import type { NotificationItem } from '@/types/notification.types';

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface NotificationPopoverProps {
  adminOnly?: boolean;
}

export function NotificationPopover({ adminOnly = false }: NotificationPopoverProps) {
  const router = useRouter();
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'unread' | 'all'>('unread');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isNotificationResolved = (item: NotificationItem): boolean => {
    if (item.type !== 'IMPORT_ERRORS') return false;
    const titleLower = (item.title || '').toLowerCase();
    const msgLower = (item.message || '').toLowerCase();
    return (
      titleLower.includes('resolved') ||
      msgLower.includes('all product import errors') ||
      msgLower.includes('have been resolved') ||
      msgLower.includes('0 products') ||
      msgLower.includes('0 error')
    );
  };

  // Fetch initial notifications (Page 1)
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const data = await getNotifications(1, NOTIFICATIONS_PER_PAGE, adminOnly ? 'IMPORT_ERRORS' : undefined);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setHasMore(!!data.hasMore);
      setPage(1);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, adminOnly]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();

      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleScroll = async () => {
    if (!containerRef.current || loadingMore || !hasMore || loading) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 15) {
      setLoadingMore(true);
      const nextPage = page + 1;

      await new Promise((resolve) => setTimeout(resolve, NOTIFICATIONS_LAZY_LOAD_DELAY_MS));

      try {
        const data = await getNotifications(nextPage, NOTIFICATIONS_PER_PAGE, adminOnly ? 'IMPORT_ERRORS' : undefined);
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const newItems = (data.notifications || []).filter((n) => !existingIds.has(n.id));
          return [...prev, ...newItems];
        });
        setUnreadCount(data.unreadCount || 0);
        setHasMore(!!data.hasMore);
        setPage(nextPage);
      } catch (err) {
        console.error('Failed to load more notifications', err);
      } finally {
        setLoadingMore(false);
      }
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    await markNotificationAsRead(undefined, true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.isRead) {
      await markNotificationAsRead(item.id, false);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    const resolved = isNotificationResolved(item);
    // If notification is resolved, do not navigate anywhere
    if (resolved) {
      return;
    }

    if (item.type === 'IMPORT_ERRORS' && item.orderId) {
      setIsOpen(false);
      router.push(`/admin/products/imports/${item.orderId}/review`);
    }
  };

  const filteredNotifications = notifications.filter((item) => {
    if (adminOnly && item.type !== 'IMPORT_ERRORS') return false;
    if (activeTab === 'unread') return !item.isRead;
    return true;
  });

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Bell Button with Red Unread Badge */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex items-center justify-center p-1.5 text-[#007BFF] hover:opacity-80 transition cursor-pointer"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1 shadow-xs animate-in zoom-in">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Card */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2.5 w-[330px] sm:w-[380px] rounded-2xl border border-slate-200/90 bg-white shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">
              {adminOnly ? 'Import Notifications' : 'Notifications'}
            </h3>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="text-xs font-semibold text-[#007BFF] hover:underline disabled:opacity-40 disabled:no-underline transition"
            >
              Mark all as read
            </button>
          </div>

          {/* Toggle Tabs Bar */}
          <div className="grid grid-cols-2 border-b border-slate-200/80 bg-slate-50/50">
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={`py-2.5 text-xs font-medium transition-all relative ${activeTab === 'unread'
                ? 'text-[#007BFF] font-semibold'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              Unread
              {activeTab === 'unread' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007BFF] rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`py-2.5 text-xs font-medium transition-all relative ${activeTab === 'all'
                ? 'text-[#007BFF] font-semibold'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              All
              {activeTab === 'all' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007BFF] rounded-full" />
              )}
            </button>
          </div>

          {/* Notification List Content */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="max-h-[340px] overflow-y-auto divide-y divide-slate-100"
          >
            {loading ? (
              <div className="py-10 text-center text-xs text-slate-400 font-medium">
                Loading notifications...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs px-4">
                {activeTab === 'unread'
                  ? adminOnly ? 'No unread import notifications' : 'No unread notifications'
                  : adminOnly ? 'No import notifications yet' : 'No notifications yet'}
              </div>
            ) : (
              <>
                {filteredNotifications.map((item) => {
                  const isStatusUpdate = item.type === 'ORDER_STATUS_UPDATED';
                  const isImportError = item.type === 'IMPORT_ERRORS';
                  const isResolved = isNotificationResolved(item);

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`flex items-start gap-3.5 p-4 transition-colors ${
                        isResolved ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50/80'
                      } ${!item.isRead ? 'bg-blue-50/20' : ''}`}
                    >
                      {/* Left Category Icon */}
                      <div className="shrink-0 pt-0.5">
                        {isImportError ? (
                          isResolved ? (
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 shadow-2xs">
                              <CheckCircle2 className="h-5 w-5 stroke-[2]" />
                            </div>
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 shadow-2xs">
                              <AlertTriangle className="h-5 w-5 stroke-[1.8]" />
                            </div>
                          )
                        ) : isStatusUpdate ? (
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 shadow-2xs">
                            <Package className="h-5 w-5 stroke-[1.8]" />
                          </div>
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#007BFF] border border-blue-200/80 shadow-2xs">
                            <ShoppingBag className="h-5 w-5 stroke-[1.8]" />
                          </div>
                        )}
                      </div>

                      {/* Content & Metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {item.title}
                          </h4>
                          {!item.isRead && (
                            <span className="h-2 w-2 rounded-full bg-[#007BFF] shrink-0" />
                          )}
                        </div>

                        <p className="mt-0.5 text-xs text-slate-600 leading-normal line-clamp-2">
                          {item.message}
                        </p>

                        {isImportError && (
                          <div className="mt-2">
                            {isResolved ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-lg shadow-2xs">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                <span>Resolved</span>
                              </span>
                            ) : item.orderId ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleItemClick(item);
                                }}
                                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2.5 py-1 rounded-lg transition shadow-2xs cursor-pointer"
                              >
                                <span>Review Products</span>
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            ) : null}
                          </div>
                        )}

                        <p className="mt-1 text-[11px] font-medium text-slate-400">
                          {formatRelativeTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {loadingMore && (
                  <div className="py-3 text-center text-xs text-slate-500 font-medium flex items-center justify-center gap-2 bg-slate-50/50">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#007BFF] border-t-transparent" />
                    <span>Loading more notifications...</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
