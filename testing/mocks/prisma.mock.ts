// Create a helper to generate mock methods for any Prisma model delegate
function createModelMock() {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    upsert: jest.fn(),
    groupBy: jest.fn()
  };
}

export type MockModel = ReturnType<typeof createModelMock>;

export interface MockPrismaClient {
  user: MockModel;
  notification: MockModel;
  account: MockModel;
  category: MockModel;
  product: MockModel;
  productOption: MockModel;
  productOptionValue: MockModel;
  productVariant: MockModel;
  variantOption: MockModel;
  cart: MockModel;
  cartItem: MockModel;
  verificationToken: MockModel;
  order: MockModel;
  orderItem: MockModel;
  payment: MockModel;
  paymentMethod: MockModel;
  stripeWebhookEvent: MockModel;
  $transaction: jest.Mock;
}

export const mockPrisma: MockPrismaClient = {
  user: createModelMock(),
  notification: createModelMock(),
  account: createModelMock(),
  category: createModelMock(),
  product: createModelMock(),
  productOption: createModelMock(),
  productOptionValue: createModelMock(),
  productVariant: createModelMock(),
  variantOption: createModelMock(),
  cart: createModelMock(),
  cartItem: createModelMock(),
  verificationToken: createModelMock(),
  order: createModelMock(),
  orderItem: createModelMock(),
  payment: createModelMock(),
  paymentMethod: createModelMock(),
  stripeWebhookEvent: createModelMock(),
  $transaction: jest.fn((callback: (tx: MockPrismaClient) => unknown) => {
    if (typeof callback === 'function') {
      return callback(mockPrisma);
    }
    return Promise.resolve(callback);
  })
};

/**
 * Resets all mock functions across all Prisma models
 */
export function resetPrismaMock() {
  Object.values(mockPrisma).forEach((model) => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach((method) => {
        if (typeof method === 'function' && 'mockReset' in method) {
          (method as jest.Mock).mockReset();
        }
      });
    }
  });
}

// Auto-mock the `@/lib/prisma` module
jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma
}));
