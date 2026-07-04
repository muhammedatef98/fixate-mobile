import { mapCourierGate, isCourierEligible } from '../utils/courierVerification';

describe('mapCourierGate', () => {
  it('allows approved and verified couriers', () => {
    expect(mapCourierGate('approved')).toEqual({ kind: 'allowed' });
    expect(mapCourierGate('verified')).toEqual({ kind: 'allowed' });
    expect(mapCourierGate('APPROVED')).toEqual({ kind: 'allowed' });
  });

  it('collapses unknown / draft / submitted states to pending', () => {
    expect(mapCourierGate('submitted')).toEqual({ kind: 'pending', status: 'submitted' });
    expect(mapCourierGate('pending')).toEqual({ kind: 'pending', status: 'pending' });
    expect(mapCourierGate(null)).toEqual({ kind: 'pending', status: 'pending' });
    expect(mapCourierGate(undefined)).toEqual({ kind: 'pending', status: 'pending' });
    expect(mapCourierGate('weird-state')).toEqual({ kind: 'pending', status: 'weird-state' });
  });

  it('passes the reviewer note through on changes_requested and rejected', () => {
    expect(mapCourierGate('changes_requested', 'fix ID photo')).toEqual({
      kind: 'changes_requested',
      notes: 'fix ID photo',
    });
    expect(mapCourierGate('rejected', 'incomplete')).toEqual({
      kind: 'rejected',
      notes: 'incomplete',
    });
    expect(mapCourierGate('rejected', null)).toEqual({ kind: 'rejected', notes: undefined });
  });
});

describe('isCourierEligible', () => {
  it('requires approval AND an active account', () => {
    expect(isCourierEligible('approved', 'active')).toBe(true);
    expect(isCourierEligible('verified', null)).toBe(true); // null status defaults to active
    expect(isCourierEligible('approved', 'suspended')).toBe(false);
    expect(isCourierEligible('approved', 'excluded')).toBe(false);
    expect(isCourierEligible('submitted', 'active')).toBe(false);
    expect(isCourierEligible('rejected', 'active')).toBe(false);
    expect(isCourierEligible(null, 'active')).toBe(false);
  });
});
