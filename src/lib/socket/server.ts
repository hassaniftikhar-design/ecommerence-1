import type { Server as SocketIOServer } from 'socket.io';

declare global {
  // eslint-disable-next-line no-var
  var __ioInstance: SocketIOServer | undefined;
  // eslint-disable-next-line no-var
  var __userSocketsMap: Map<string, Set<string>> | undefined;
  // eslint-disable-next-line no-var
  var __socketToUserMap: Map<string, string> | undefined;
}

// Global registry persisting across module reloads
const userSocketsMap: Map<string, Set<string>> =
  global.__userSocketsMap || (global.__userSocketsMap = new Map<string, Set<string>>());

const socketToUserMap: Map<string, string> =
  global.__socketToUserMap || (global.__socketToUserMap = new Map<string, string>());

export function setIO(io: SocketIOServer): void {
  global.__ioInstance = io;
}

export function getIO(): SocketIOServer | null {
  return global.__ioInstance || null;
}

export function addUserSocket(userId: string, socketId: string): void {
  if (!userId || !socketId) return;

  if (!userSocketsMap.has(userId)) {
    userSocketsMap.set(userId, new Set<string>());
  }
  userSocketsMap.get(userId)!.add(socketId);
  socketToUserMap.set(socketId, userId);
}

export function removeUserSocket(userId: string, socketId: string): void {
  if (userId && userSocketsMap.has(userId)) {
    const sockets = userSocketsMap.get(userId)!;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSocketsMap.delete(userId);
    }
  }
  socketToUserMap.delete(socketId);
}

export function removeSocketById(socketId: string): void {
  const userId = socketToUserMap.get(socketId);
  if (userId) {
    removeUserSocket(userId, socketId);
  }
}

export function getUserSockets(userId: string): string[] {
  if (!userId || !userSocketsMap.has(userId)) {
    return [];
  }
  return Array.from(userSocketsMap.get(userId)!);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  const io = getIO();
  if (!io || !userId) return;

  const sockets = getUserSockets(userId);
  if (sockets.length === 0) return;

  for (const socketId of sockets) {
    io.to(socketId).emit(event, payload);
  }
}
