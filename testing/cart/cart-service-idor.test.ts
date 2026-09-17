/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
import {
  updateCartItemQuantityServer,
  removeCartItemServer
} from '@/server/services/cart.service';
import { mockPrisma, resetPrismaMock } from '../mocks/prisma.mock';
import { mockCart, mockCartItem, MOCK_CART_ID, MOCK_CART_ITEM_ID } from '../mocks/cart.mock';

jest.mock('@/lib/prisma', () => ({
  prisma: require('../mocks/prisma.mock').mockPrisma
}));

describe('Cart Service - IDOR Prevention & Scoped Ownership', () => {
  const USER_A_ID = 'user-a-cuid';
  const USER_B_ID = 'user-b-cuid';
  const CART_A_ID = 'cart-a-cuid';
  const CART_B_ID = 'cart-b-cuid';

  beforeEach(() => {
    resetPrismaMock();
    jest.clearAllMocks();
  });

  describe('updateCartItemQuantityServer', () => {
    it('should reject quantity update if cart item belongs to another user cart (IDOR prevention)', async () => {
      // Mock User A's cart retrieval
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        id: CART_A_ID,
        userId: USER_A_ID
      } as any);

      // findFirst with cartId: CART_A_ID returns null because the item belongs to CART_B_ID
      mockPrisma.cartItem.findFirst.mockResolvedValueOnce(null);

      const result = await updateCartItemQuantityServer(USER_A_ID, MOCK_CART_ITEM_ID, 3);

      expect(mockPrisma.cartItem.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: MOCK_CART_ITEM_ID,
            cartId: CART_A_ID
          }
        })
      );
      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.message).toBe('Cart item not found');
      expect(mockPrisma.cartItem.update).not.toHaveBeenCalled();
    });

    it('should successfully update quantity when cart item belongs to the authenticated user', async () => {
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        id: CART_A_ID,
        userId: USER_A_ID
      } as any);

      mockPrisma.cartItem.findFirst.mockResolvedValueOnce({
        ...mockCartItem,
        id: MOCK_CART_ITEM_ID,
        cartId: CART_A_ID,
        variant: { stock: 10 }
      } as any);

      mockPrisma.cartItem.update.mockResolvedValueOnce({} as any);

      // For formatCartResponseServer
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        id: CART_A_ID,
        userId: USER_A_ID,
        items: []
      } as any);

      const result = await updateCartItemQuantityServer(USER_A_ID, MOCK_CART_ITEM_ID, 5);

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: MOCK_CART_ITEM_ID },
        data: { quantity: 5 }
      });
    });
  });

  describe('removeCartItemServer', () => {
    it('should reject item deletion if cart item belongs to another user cart (IDOR prevention)', async () => {
      // Mock User B attempting to delete User A's item
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        id: CART_B_ID,
        userId: USER_B_ID
      } as any);

      mockPrisma.cartItem.findFirst.mockResolvedValueOnce(null);

      const result = await removeCartItemServer(USER_B_ID, MOCK_CART_ITEM_ID);

      expect(mockPrisma.cartItem.findFirst).toHaveBeenCalledWith({
        where: {
          id: MOCK_CART_ITEM_ID,
          cartId: CART_B_ID
        }
      });
      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.message).toBe('Cart item not found');
      expect(mockPrisma.cartItem.delete).not.toHaveBeenCalled();
    });

    it('should successfully delete cart item when it belongs to the authenticated user', async () => {
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        id: CART_A_ID,
        userId: USER_A_ID
      } as any);

      mockPrisma.cartItem.findFirst.mockResolvedValueOnce({
        ...mockCartItem,
        id: MOCK_CART_ITEM_ID,
        cartId: CART_A_ID
      } as any);

      mockPrisma.cartItem.delete.mockResolvedValueOnce({} as any);

      // For formatCartResponseServer
      mockPrisma.cart.findUnique.mockResolvedValueOnce({
        id: CART_A_ID,
        userId: USER_A_ID,
        items: []
      } as any);

      const result = await removeCartItemServer(USER_A_ID, MOCK_CART_ITEM_ID);

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(mockPrisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: MOCK_CART_ITEM_ID }
      });
    });
  });
});
