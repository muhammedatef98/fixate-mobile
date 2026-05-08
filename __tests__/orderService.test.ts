import * as orderService from '../services/orderService';

// Build a minimal builder that resolves to {data,error}. Each terminal method
// returns the Promise directly so the chain matches what supabase-js exposes.
const makeBuilder = (result: { data: any; error: any }) => {
  const builder: any = {};
  const ret = (..._args: any[]) => builder;
  builder.insert = ret;
  builder.select = ret;
  builder.update = ret;
  builder.eq = ret;
  builder.is = ret;
  builder.order = (..._args: any[]) => Promise.resolve(result);
  builder.single = () => Promise.resolve(result);
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (resolve: any, reject: any) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
};

// jest.mock factories must not reference top-level vars (Jest hoists them
// above any const). Stash mutable state on globalThis so the factory can
// pull a fresh value from inside the prefix-allowed `mock` namespace.
(globalThis as any).__mockNext = { data: [], error: null };
const setNext = (result: { data: any; error: any }) => {
  (globalThis as any).__mockNext = result;
};

jest.mock('../services/supabaseClient', () => ({
  supabase: {
    from: () => {
      const r = (globalThis as any).__mockNext as { data: any; error: any };
      const builder: any = {};
      const ret = (..._args: any[]) => builder;
      builder.insert = ret;
      builder.select = ret;
      builder.update = ret;
      builder.eq = ret;
      builder.is = ret;
      builder.order = () => Promise.resolve(r);
      builder.single = () => Promise.resolve(r);
      builder.maybeSingle = () => Promise.resolve(r);
      builder.then = (res: any, rej: any) => Promise.resolve(r).then(res, rej);
      return builder;
    },
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { error: jest.fn(), debug: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

describe('orderService', () => {
  beforeEach(() => {
    setNext({ data: [], error: null });
  });

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
      setNext({ data: null, error: new Error('DB error') });
      const result = await orderService.getMyOrders('user-1');
      expect(result).toEqual([]);
    });

    it('returns empty array when no orders found', async () => {
      setNext({ data: [], error: null });
      const result = await orderService.getMyOrders('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getOrderById', () => {
    it('returns null on error', async () => {
      setNext({ data: null, error: new Error('Not found') });
      const result = await orderService.getOrderById('nonexistent-id');
      expect(result).toBeNull();
    });
  });
});
