import {
  mapTechnicianGate,
  buildVerificationUpdate,
} from '../utils/technicianVerification';

const NOW = '2026-07-04T10:00:00.000Z';

describe('mapTechnicianGate', () => {
  it('lets approved technicians in', () => {
    expect(mapTechnicianGate('approved')).toEqual({ kind: 'allowed' });
  });

  it('treats legacy "verified" as approved', () => {
    expect(mapTechnicianGate('verified')).toEqual({ kind: 'allowed' });
  });

  it('is case-insensitive', () => {
    expect(mapTechnicianGate('APPROVED')).toEqual({ kind: 'allowed' });
  });

  it('routes submitted applications to the pending gate', () => {
    expect(mapTechnicianGate('submitted')).toEqual({ kind: 'pending', status: 'submitted' });
  });

  it('defaults a missing status to pending', () => {
    expect(mapTechnicianGate(null)).toEqual({ kind: 'pending', status: 'pending' });
  });

  it('surfaces the note for changes_requested', () => {
    expect(mapTechnicianGate('changes_requested', 'Upload a clearer ID photo')).toEqual({
      kind: 'changes_requested',
      notes: 'Upload a clearer ID photo',
    });
  });

  it('keeps rejected distinct from changes_requested', () => {
    expect(mapTechnicianGate('rejected', 'Fake documents')).toEqual({
      kind: 'rejected',
      notes: 'Fake documents',
    });
  });

  it('normalises an absent note to undefined', () => {
    expect(mapTechnicianGate('changes_requested', null)).toEqual({
      kind: 'changes_requested',
      notes: undefined,
    });
  });
});

describe('buildVerificationUpdate', () => {
  it('approval stamps verified_at and clears the note', () => {
    expect(buildVerificationUpdate('approved', 'ignored', NOW)).toEqual({
      verification_status: 'approved',
      verified_at: NOW,
      verification_notes: null,
    });
  });

  it('request-changes keeps the note and leaves verified_at null', () => {
    expect(buildVerificationUpdate('changes_requested', 'Add your IBAN', NOW)).toEqual({
      verification_status: 'changes_requested',
      verified_at: null,
      verification_notes: 'Add your IBAN',
    });
  });

  it('reject keeps the reason and leaves verified_at null', () => {
    expect(buildVerificationUpdate('rejected', 'Documents invalid', NOW)).toEqual({
      verification_status: 'rejected',
      verified_at: null,
      verification_notes: 'Documents invalid',
    });
  });

  it('trims whitespace and stores a blank note as null', () => {
    expect(buildVerificationUpdate('rejected', '   ', NOW).verification_notes).toBeNull();
    expect(buildVerificationUpdate('changes_requested', '  fix it  ', NOW).verification_notes).toBe(
      'fix it'
    );
  });

  it('reject and changes_requested are different terminal statuses', () => {
    const reject = buildVerificationUpdate('rejected', 'x', NOW);
    const changes = buildVerificationUpdate('changes_requested', 'x', NOW);
    expect(reject.verification_status).not.toBe(changes.verification_status);
  });
});
