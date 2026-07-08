import {
  latestRelevantOffer,
  dedupeOffersByTechnician,
  canSubmitNewOffer,
  technicianOfferStateMeta,
  customerEstimateDisplay,
  type OfferStatus,
} from '../utils/offerStatus';

const offer = (
  technician_id: string,
  status: OfferStatus,
  created_at: string,
  extra: Record<string, unknown> = {}
) => ({ technician_id, status, created_at, ...extra });

describe('latestRelevantOffer', () => {
  test('a live pending offer wins over older history', () => {
    const rows = [
      offer('t1', 'rejected', '2026-07-08T10:00:00Z', { amount: 300 }),
      offer('t1', 'pending', '2026-07-08T11:00:00Z', { amount: 250 }),
    ];
    expect(latestRelevantOffer(rows)?.status).toBe('pending');
  });

  test('a fresh rejection is shown over an older withdrawal', () => {
    const rows = [
      offer('t1', 'withdrawn', '2026-07-08T09:00:00Z'),
      offer('t1', 'rejected', '2026-07-08T12:00:00Z'),
    ];
    expect(latestRelevantOffer(rows)?.status).toBe('rejected');
  });

  test('an accepted offer wins over decided history', () => {
    const rows = [
      offer('t1', 'rejected', '2026-07-08T12:00:00Z'),
      offer('t1', 'accepted', '2026-07-08T10:00:00Z'),
    ];
    expect(latestRelevantOffer(rows)?.status).toBe('accepted');
  });

  test('returns null on empty input', () => {
    expect(latestRelevantOffer([])).toBeNull();
  });
});

describe('dedupeOffersByTechnician (customer offer list)', () => {
  test('one entry per technician — resubmission never duplicates a tech', () => {
    const rows = [
      offer('t1', 'pending', '2026-07-08T12:00:00Z', { amount: 250 }),
      offer('t1', 'rejected', '2026-07-08T10:00:00Z', { amount: 300 }),
      offer('t2', 'pending', '2026-07-08T11:00:00Z', { amount: 280 }),
    ];
    const deduped = dedupeOffersByTechnician(rows);
    expect(deduped).toHaveLength(2);
    const t1 = deduped.find((o) => o.technician_id === 't1');
    expect(t1?.status).toBe('pending');
    expect((t1 as any).amount).toBe(250);
  });

  test('a tech with only a rejected offer still appears (as rejected)', () => {
    const rows = [offer('t1', 'rejected', '2026-07-08T10:00:00Z')];
    expect(dedupeOffersByTechnician(rows)[0]?.status).toBe('rejected');
  });

  test('live offers sort before decided history', () => {
    const rows = [
      offer('t1', 'rejected', '2026-07-08T12:00:00Z'),
      offer('t2', 'pending', '2026-07-08T09:00:00Z'),
    ];
    expect(dedupeOffersByTechnician(rows)[0]?.technician_id).toBe('t2');
  });
});

describe('canSubmitNewOffer (resubmission gate)', () => {
  test('technician can resubmit after rejection while the order is open', () => {
    expect(canSubmitNewOffer(true, 'rejected')).toBe(true);
    expect(canSubmitNewOffer(true, 'withdrawn')).toBe(true);
    expect(canSubmitNewOffer(true, null)).toBe(true);
  });

  test('cannot resubmit once the order is closed / a winner was selected', () => {
    expect(canSubmitNewOffer(false, 'rejected')).toBe(false);
    expect(canSubmitNewOffer(false, 'expired')).toBe(false);
    expect(canSubmitNewOffer(false, null)).toBe(false);
  });

  test('a live or winning offer is revised, not duplicated', () => {
    expect(canSubmitNewOffer(true, 'pending')).toBe(false);
    expect(canSubmitNewOffer(true, 'accepted')).toBe(false);
  });
});

describe('technicianOfferStateMeta', () => {
  test('rejected is explicit customer rejection with resubmit invitation', () => {
    const meta = technicianOfferStateMeta('rejected');
    expect(meta.canResubmit).toBe(true);
    expect(meta.tone).toBe('danger');
    expect(meta.en).toContain('declined');
    expect(meta.en).toContain('new one');
  });

  test('expired is clearly "another offer won", never resubmittable', () => {
    const meta = technicianOfferStateMeta('expired');
    expect(meta.canResubmit).toBe(false);
    expect(meta.en).toContain('another technician');
  });

  test('pending / rejected / expired / accepted stay distinct', () => {
    const labels = (['pending', 'rejected', 'expired', 'accepted'] as OfferStatus[]).map(
      (s) => technicianOfferStateMeta(s).en
    );
    expect(new Set(labels).size).toBe(4);
  });
});

describe('customerEstimateDisplay (technician-facing estimate)', () => {
  test('shows the estimate as approximate, never a committed price', () => {
    const d = customerEstimateDisplay(300, false);
    expect(d.label).toContain('initial estimate');
    expect(d.value).toBe('≈ 300 SAR');
    expect(d.isEstimate).toBe(true);
  });

  test('zero / absent estimate reads as inspection-needed', () => {
    for (const v of [0, null, undefined, NaN]) {
      const d = customerEstimateDisplay(v as number | null | undefined, false);
      expect(d.value).toBe('Determined on inspection');
      expect(d.isEstimate).toBe(false);
    }
  });

  test('arabic variant is provided', () => {
    expect(customerEstimateDisplay(120, true).value).toContain('ر.س');
    expect(customerEstimateDisplay(0, true).value).toBe('يُحدد بعد الفحص');
  });
});
