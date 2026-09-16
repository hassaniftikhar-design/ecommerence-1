/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('@/lib/prisma', () => ({
  prisma: require('../mocks/prisma.mock').mockPrisma
}));

jest.mock('@/services/scheduler/scheduler.client', () => ({
  schedulerClient: {
    resolveImportItem: jest.fn()
  }
}));

jest.mock('@/lib/import-storage', () => ({
  cleanupImportStorage: jest.fn()
}));

import {
  addUserSocket,
  removeUserSocket,
  removeSocketById,
  getUserSockets,
  emitToUser,
  setIO
} from '@/lib/socket/server';
import {
  createAndEmitNotificationServer,
  markNotificationReadServer,
  getNotificationsServer
} from '@/server/services/notification.service';
import { resolveImportItemServer } from '@/server/services/admin-import.service';
import { schedulerClient } from '@/services/scheduler/scheduler.client';
import { mockPrisma, resetPrismaMock } from '../mocks/prisma.mock';

describe('Real-Time WebSocket Notifications & Socket Registry', () => {
  let mockSocketEmitMap: Map<string, jest.Mock>;
  let mockIO: any;

  beforeEach(() => {
    resetPrismaMock();
    mockSocketEmitMap = new Map();

    mockIO = {
      to: jest.fn((socketId: string) => {
        if (!mockSocketEmitMap.has(socketId)) {
          mockSocketEmitMap.set(socketId, jest.fn());
        }
        return {
          emit: mockSocketEmitMap.get(socketId)!
        };
      })
    };

    setIO(mockIO);

    // Clean up registry before each test
    const userA = getUserSockets('USER_A');
    userA.forEach((s) => removeUserSocket('USER_A', s));
    const userB = getUserSockets('USER_B');
    userB.forEach((s) => removeUserSocket('USER_B', s));
    const admin1 = getUserSockets('ADMIN_1');
    admin1.forEach((s) => removeUserSocket('ADMIN_1', s));
    const admin2 = getUserSockets('ADMIN_2');
    admin2.forEach((s) => removeUserSocket('ADMIN_2', s));
  });

  describe('Server-Side User Socket Registry', () => {
    it('should register and retrieve multiple socket IDs for the same user (multi-tab support)', () => {
      addUserSocket('USER_A', 'socket-tab-1');
      addUserSocket('USER_A', 'socket-tab-2');

      const sockets = getUserSockets('USER_A');
      expect(sockets).toHaveLength(2);
      expect(sockets).toContain('socket-tab-1');
      expect(sockets).toContain('socket-tab-2');
    });

    it('should remove a single socket ID on tab close and preserve remaining tabs', () => {
      addUserSocket('USER_A', 'socket-tab-1');
      addUserSocket('USER_A', 'socket-tab-2');

      removeUserSocket('USER_A', 'socket-tab-1');

      const sockets = getUserSockets('USER_A');
      expect(sockets).toEqual(['socket-tab-2']);
    });

    it('should remove socket using reverse lookup removeSocketById', () => {
      addUserSocket('USER_A', 'socket-tab-1');
      removeSocketById('socket-tab-1');

      const sockets = getUserSockets('USER_A');
      expect(sockets).toEqual([]);
    });

    it('should isolate sockets between different users (User A vs User B)', () => {
      addUserSocket('USER_A', 'socket-a1');
      addUserSocket('USER_A', 'socket-a2');
      addUserSocket('USER_B', 'socket-b1');

      expect(getUserSockets('USER_A')).toEqual(['socket-a1', 'socket-a2']);
      expect(getUserSockets('USER_B')).toEqual(['socket-b1']);
    });
  });

  describe('Targeted User Emission & Isolation Security', () => {
    it('should emit exclusively to all sockets belonging to the target user', () => {
      addUserSocket('USER_A', 'socket-a1');
      addUserSocket('USER_A', 'socket-a2');
      addUserSocket('USER_B', 'socket-b1');

      const payload = { title: 'Test Notification', message: 'Hello User A' };
      emitToUser('USER_A', 'notification:new', payload);

      // Verify User A sockets received the event
      expect(mockIO.to).toHaveBeenCalledWith('socket-a1');
      expect(mockIO.to).toHaveBeenCalledWith('socket-a2');
      expect(mockSocketEmitMap.get('socket-a1')).toHaveBeenCalledWith('notification:new', payload);
      expect(mockSocketEmitMap.get('socket-a2')).toHaveBeenCalledWith('notification:new', payload);

      // Verify User B socket NEVER received the event
      expect(mockIO.to).not.toHaveBeenCalledWith('socket-b1');
      expect(mockSocketEmitMap.get('socket-b1')).toBeUndefined();
    });

    it('should gracefully handle emitting to offline users without throwing', () => {
      expect(() => {
        emitToUser('OFFLINE_USER', 'notification:new', { msg: 'test' });
      }).not.toThrow();
      expect(mockIO.to).not.toHaveBeenCalled();
    });
  });

  describe('createAndEmitNotificationServer', () => {
    it('should persist notification to DB, calculate unread count, and emit to recipient sockets', async () => {
      addUserSocket('ADMIN_1', 'admin1-socket-1');
      addUserSocket('ADMIN_1', 'admin1-socket-2');
      addUserSocket('ADMIN_2', 'admin2-socket-1');

      const createdNotif = {
        id: 'notif-100',
        userId: 'ADMIN_1',
        title: 'New Order Received',
        message: 'Order #1001 placed',
        type: 'ORDER_PLACED',
        orderId: 'order-1001',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.notification.create.mockResolvedValue(createdNotif);
      mockPrisma.notification.count.mockResolvedValue(3);

      const result = await createAndEmitNotificationServer({
        recipientId: 'ADMIN_1',
        title: 'New Order Received',
        message: 'Order #1001 placed',
        type: 'ORDER_PLACED',
        orderId: 'order-1001'
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'ADMIN_1',
          title: 'New Order Received',
          message: 'Order #1001 placed',
          type: 'ORDER_PLACED',
          orderId: 'order-1001',
          isRead: false
        }
      });

      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: {
          userId: 'ADMIN_1',
          isRead: false
        }
      });

      expect(result).toEqual(createdNotif);

      // Verify Admin 1 sockets received new notification and unread count
      expect(mockSocketEmitMap.get('admin1-socket-1')).toHaveBeenCalledWith('notification:new', createdNotif);
      expect(mockSocketEmitMap.get('admin1-socket-1')).toHaveBeenCalledWith('notification:unread-count', { count: 3 });
      expect(mockSocketEmitMap.get('admin1-socket-2')).toHaveBeenCalledWith('notification:new', createdNotif);
      expect(mockSocketEmitMap.get('admin1-socket-2')).toHaveBeenCalledWith('notification:unread-count', { count: 3 });

      // Admin 2 received nothing
      expect(mockSocketEmitMap.get('admin2-socket-1')).toBeUndefined();
    });

    it('should throw if recipientId is missing', async () => {
      await expect(
        createAndEmitNotificationServer({
          recipientId: '',
          title: 'Test',
          message: 'Test msg',
          type: 'TEST'
        })
      ).rejects.toThrow('recipientId is required');
    });
  });

  describe('markNotificationReadServer (Multi-Tab Read Sync & Security)', () => {
    it('should mark single notification as read scoped to userId and emit updated count to all tabs', async () => {
      addUserSocket('USER_A', 'tab-1-socket');
      addUserSocket('USER_A', 'tab-2-socket');

      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.count.mockResolvedValue(1);

      const res = await markNotificationReadServer('USER_A', 'notif-1', false);

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'notif-1', userId: 'USER_A' },
        data: { isRead: true }
      });

      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { userId: 'USER_A', isRead: false }
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.unreadCount).toBe(1);
      }

      // Verify both Tab 1 and Tab 2 receive unread count update
      expect(mockSocketEmitMap.get('tab-1-socket')).toHaveBeenCalledWith('notification:unread-count', { count: 1 });
      expect(mockSocketEmitMap.get('tab-2-socket')).toHaveBeenCalledWith('notification:unread-count', { count: 1 });
    });

    it('should mark all notifications as read scoped to userId and emit unread count 0', async () => {
      addUserSocket('USER_A', 'tab-1-socket');

      mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 });
      mockPrisma.notification.count.mockResolvedValue(0);

      const res = await markNotificationReadServer('USER_A', undefined, true);

      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: 'USER_A', isRead: false },
        data: { isRead: true }
      });

      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.unreadCount).toBe(0);
      }
      expect(mockSocketEmitMap.get('tab-1-socket')).toHaveBeenCalledWith('notification:unread-count', { count: 0 });
    });

    it('should prevent cross-user mark-as-read by enforcing userId scoping in query', async () => {
      // User A attempts to mark User B's notification as read
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.notification.count.mockResolvedValue(2);

      await markNotificationReadServer('USER_A', 'user-b-notif-999', false);

      // Query was strictly restricted to userId = 'USER_A'
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-b-notif-999', userId: 'USER_A' },
        data: { isRead: true }
      });
    });
  });

  describe('resolveImportItemServer (Real-Time Notification Resolution)', () => {
    it('should emit notification:updated and notification:unread-count to admin sockets when all errors are resolved', async () => {
      addUserSocket('ADMIN_1', 'admin1-socket');

      (schedulerClient.resolveImportItem as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: 'item-1', status: 'RESOLVED' }
      });

      // No remaining unresolved items
      mockPrisma.importItem.count.mockResolvedValue(0);
      mockPrisma.importJob.findUnique.mockResolvedValue({ id: 'job-123', filename: 'products.csv' });
      mockPrisma.notification.findMany.mockResolvedValue([
        { id: 'notif-job-1', userId: 'ADMIN_1', type: 'IMPORT_ERRORS', orderId: 'job-123' }
      ]);
      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.notification.findUnique.mockResolvedValue({
        id: 'notif-job-1',
        userId: 'ADMIN_1',
        title: 'Import Errors Resolved',
        message: 'All product import errors for products.csv have been resolved.',
        type: 'IMPORT_ERRORS',
        orderId: 'job-123',
        isRead: true,
        createdAt: new Date('2026-09-16T10:00:00.000Z'),
        updatedAt: new Date('2026-09-16T11:00:00.000Z')
      });
      mockPrisma.notification.count.mockResolvedValue(0);

      const res = await resolveImportItemServer({
        jobId: 'job-123',
        itemId: 'item-1'
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          type: 'IMPORT_ERRORS',
          orderId: 'job-123'
        },
        data: {
          title: 'Import Errors Resolved',
          message: 'All product import errors for products.csv have been resolved.',
          isRead: true
        }
      });

      // Verify admin socket received notification:updated
      expect(mockSocketEmitMap.get('admin1-socket')).toHaveBeenCalledWith(
        'notification:updated',
        expect.objectContaining({
          id: 'notif-job-1',
          title: 'Import Errors Resolved',
          isRead: true
        })
      );

      // Verify admin socket received updated unread count
      expect(mockSocketEmitMap.get('admin1-socket')).toHaveBeenCalledWith(
        'notification:unread-count',
        { count: 0 }
      );
    });
  });
});
