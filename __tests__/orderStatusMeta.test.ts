import {
  ORDER_STATUS_META,
  ORDER_STATUS_LABELS_AR,
  ORDER_STATUS_LABELS_EN,
  getOrderStatusColor,
} from '../types/order';

describe('ORDER_STATUS_META', () => {
  test('covers every status that has a label', () => {
    // Arrange
    const labeled = Object.keys(ORDER_STATUS_LABELS_AR);

    // Act / Assert — every labeled status has color, icon and progress
    labeled.forEach((status) => {
      const meta = ORDER_STATUS_META[status as keyof typeof ORDER_STATUS_META];
      expect(meta).toBeDefined();
      expect(meta.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(meta.icon).toBeTruthy();
      expect(meta.progress).toBeGreaterThanOrEqual(0);
      expect(meta.progress).toBeLessThanOrEqual(100);
    });
    expect(Object.keys(ORDER_STATUS_META).sort()).toEqual(labeled.sort());
    expect(Object.keys(ORDER_STATUS_LABELS_EN).sort()).toEqual(labeled.sort());
  });

  test('getOrderStatusColor falls back to grey for unknown statuses', () => {
    expect(getOrderStatusColor('accepted')).toBe(ORDER_STATUS_META.accepted.color);
    expect(getOrderStatusColor('not-a-status')).toBe('#6B7280');
  });
});
