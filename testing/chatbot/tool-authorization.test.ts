/* eslint-disable @typescript-eslint/no-require-imports */
import { executeChatbotTool } from '@/server/chatbot/tools';
import { mockPrisma, resetPrismaMock } from '../mocks/prisma.mock';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/prisma', () => ({ prisma: require('../mocks/prisma.mock').mockPrisma }));

describe('ShopFast chatbot tool authorization', () => {
  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();
  });

  it('rechecks the current database role before running admin revenue tools', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'USER', isActive: true } as never);

    await expect(executeChatbotTool(
      { userId: 'customer-a', role: 'ADMIN' },
      'getRevenue'
    )).rejects.toThrow('This tool is available to administrators only');

    expect(mockPrisma.order.aggregate).not.toHaveBeenCalled();
  });
});
