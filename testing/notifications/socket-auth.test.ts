/* eslint-disable @typescript-eslint/no-explicit-any */
import { authenticateSocketRequest } from '@/lib/socket/auth';
import { getToken } from 'next-auth/jwt';

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn()
}));

describe('authenticateSocketRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = 'mock-secret-for-tests';
  });

  it('should parse cookie header and return authenticated token', async () => {
    const mockToken = {
      id: 'user-123',
      sub: 'user-123',
      email: 'user@example.com',
      sessionExpiresAt: Date.now() + 60000
    };

    (getToken as jest.Mock).mockResolvedValue(mockToken);

    const mockReq: any = {
      headers: {
        cookie: 'next-auth.session-token=mock-jwt-token; other-cookie=test'
      }
    };

    const result = await authenticateSocketRequest(mockReq);

    expect(result).toEqual(mockToken);
    expect(mockReq.cookies).toBeDefined();
    expect(mockReq.cookies['next-auth.session-token']).toBe('mock-jwt-token');
    expect(getToken).toHaveBeenCalledWith(
      expect.objectContaining({
        req: mockReq,
        secret: 'mock-secret-for-tests'
      })
    );
  });

  it('should return null when token is invalid or missing sub', async () => {
    (getToken as jest.Mock).mockResolvedValue(null);

    const mockReq: any = {
      headers: { cookie: 'invalid=cookie' }
    };

    const result = await authenticateSocketRequest(mockReq);
    expect(result).toBeNull();
  });

  it('should return null if session is expired', async () => {
    (getToken as jest.Mock).mockResolvedValue({
      id: 'user-123',
      sub: 'user-123',
      sessionExpiresAt: Date.now() - 60000 // Expired
    });

    const mockReq: any = {
      headers: { cookie: 'next-auth.session-token=expired-token' }
    };

    const result = await authenticateSocketRequest(mockReq);
    expect(result).toBeNull();
  });
});
