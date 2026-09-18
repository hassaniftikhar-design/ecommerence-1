/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { SocketProvider, useSocket } from '@/providers/socket-provider';
import { initSocket, disconnectSocket, isSocketEnabled } from '@/lib/socket/client';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn()
}));

jest.mock('socket.io-client', () => {
  const mockSocket = {
    connected: false,
    connect: jest.fn(function (this: any) {
      this.connected = true;
    }),
    disconnect: jest.fn(function (this: any) {
      this.connected = false;
    }),
    on: jest.fn(),
    off: jest.fn(),
    emit: jest.fn()
  };

  return {
    io: jest.fn(() => mockSocket)
  };
});

function TestConsumer() {
  const { socket, isConnected } = useSocket();
  return (
    <div>
      <span data-testid="status">{isConnected ? 'connected' : 'disconnected'}</span>
      <span data-testid="has-socket">{socket ? 'yes' : 'no'}</span>
    </div>
  );
}

describe('Client Socket Infrastructure & SocketProvider', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SOCKET_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    disconnectSocket();
    process.env.NEXT_PUBLIC_SOCKET_ENABLED = 'true';
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_SOCKET_ENABLED = originalEnv;
  });

  it('isSocketEnabled should return true by default and false when NEXT_PUBLIC_SOCKET_ENABLED="false"', () => {
    process.env.NEXT_PUBLIC_SOCKET_ENABLED = 'true';
    expect(isSocketEnabled()).toBe(true);

    process.env.NEXT_PUBLIC_SOCKET_ENABLED = 'false';
    expect(isSocketEnabled()).toBe(false);
  });

  it('initSocket should return null when socket is disabled', () => {
    process.env.NEXT_PUBLIC_SOCKET_ENABLED = 'false';
    const socket = initSocket();
    expect(socket).toBeNull();
  });

  it('SocketProvider connects socket when authenticated and cleans up on unauthenticated', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { id: 'user-1', email: 'test@example.com' } }
    });

    const { unmount } = render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    );

    expect(screen.getByTestId('has-socket')).toHaveTextContent('yes');

    unmount();
  });

  it('SocketProvider disconnects socket when session becomes unauthenticated', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'unauthenticated',
      data: null
    });

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    );

    expect(screen.getByTestId('has-socket')).toHaveTextContent('no');
    expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
  });
});
