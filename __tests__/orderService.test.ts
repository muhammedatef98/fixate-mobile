import * as orderService from '../services/orderService';

const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle, eq: mockEq, is: mockIs, order: mockOrder }));
const mockEq = jest.fn(() => ({ select: mockSelect, single: mockSingle, order: mockOrder, is: mockIs }));
const mockIs = jest.fn(() => ({ order: mockOrder, eq: mockEq }));
const mockOrder = jest.fn(() => ({ data: [], error: null }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));
const mockUpdate = jest.fn(() => ({ eq: mockEq, select: mockSelect }));
const mockFrom = jest.fn(() => ({
  insert: mockInsert,
  select: mockSelect,
  update: mockUpdate,
  eq: mockEq,
}));

jest.mock('../services/supabaseClient', () => ({
  supabase: { from: mockFrom },
}));

jest.mock('../utils/logger', () => ({
  logger: { error: jest.fn(), debug: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

describe('orderService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('exports', () => {
    it('exports all required functions', () => {
      expect(typeof orderService.createOrder).toBe('function');
      expect(typeof orderService.getMyOrders).toBe('function');
      expect(typeof orderService.getAvailableOrders).toBe('function');
      expect(typeof orderService.getOrderById).toBe('function');
      expect(typeof orderService.assignOrderToTechnician).toBe('function');
      expect(typeof orderService.updateOrderStatus).toBe('function');
      expect(typeof orderService.addPriceToOrder).toBe('function');
      expect(typeof orderService.getTechnicianOrders).toBe('function');
    });
  });

  describe('getMyOrders', () => {
    it('returns empty array on database error', async () => {
      mockEq.mockReturnValueOnce({
        order: () => Promise.resolve({ data: null, error: new Error('DB error') }),
      });
      const result = await orderService.getMyOrders('user-1');
      expect(result).toEqual([]);
    });

    it('returns empty array when no orders found', async () => {
      mockEq.mockReturnValueOnce({
        order: () => Promise.resolve({ data: [], error: null }),
      });
      const result = await orderService.getMyOrders('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getOrderById', () => {
    it('returns null on error', async () => {
      mockEq.mockReturnValueOnce({
        single: () => Promise.resolve({ data: null, error: new Error('Not found') }),
      });
      const result = await orderService.getOrderById('nonexistent-id');
      expect(result).toBeNull();
    });
  });
});
