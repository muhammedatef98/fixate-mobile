/**
 * userVerificationService.ts
 *
 * Saudi ID / Iqama identity-verification flow.
 *
 * A user uploads their document, the application sits in `pending`,
 * an admin reviews it in admin-user-verifications, and on `approved`
 * a DB trigger flips `users.is_verified = true`. The verified flag
 * is exposed via the `public_user_cards` view so the rest of the app
 * (profile, market feed, listing detail, market chat) can read it
 * without touching the `users` row directly.
 */
import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';

export type IdDocumentType = 'saudi_id' | 'iqama';
export type VerificationStatus = 'pending' | 'approved' | 'rejected';

export interface UserVerificationRow {
  id: string;
  user_id: string;
  document_type: IdDocumentType;
  document_number: string;
  full_name: string;
  document_front_url: string;
  document_back_url: string | null;
  status: VerificationStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubmitVerificationPayload {
  userId: string;
  documentType: IdDocumentType;
  documentNumber: string;
  fullName: string;
  frontImageUri: string;
  backImageUri?: string;
}

const BUCKET = 'user-id-documents';

/**
 * Upload an image picked from the device into the private bucket
 * under the user's own folder. The bucket's RLS only allows writes
 * where the path's first segment matches auth.uid().
 */
const uploadIdImage = async (
  userId: string,
  uri: string,
  side: 'front' | 'back',
): Promise<string> => {
  const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase();
  const path = `${userId}/${side}-${Date.now()}.${ext}`;
  const response = await fetch(uri);
  const blob = await response.blob();
  const contentType = blob.type || 'image/jpeg';
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  return path;
};

/** Validation kept loose on purpose — server-side CHECK constraints are the
 *  authoritative gate. We only fail fast on obviously empty input. */
const validatePayload = (p: SubmitVerificationPayload): void => {
  if (!p.userId) throw new Error('Missing user id');
  if (p.documentType !== 'saudi_id' && p.documentType !== 'iqama') {
    throw new Error('Invalid document type');
  }
  if (!p.documentNumber.trim()) throw new Error('Document number is required');
  if (!p.fullName.trim()) throw new Error('Full name is required');
  if (!p.frontImageUri) throw new Error('Front image is required');
};

/**
 * Submit a new identity verification application. Returns the
 * inserted row so the UI can show the pending state immediately.
 */
export const submitUserVerification = async (
  payload: SubmitVerificationPayload,
): Promise<UserVerificationRow> => {
  validatePayload(payload);

  // If there's already a pending row, the unique index will reject
  // the insert. Surface a friendly error instead of the raw DB code.
  const existing = await getMyVerification(payload.userId);
  if (existing && existing.status === 'pending') {
    throw new Error('PENDING_ALREADY_EXISTS');
  }

  try {
    const frontPath = await uploadIdImage(payload.userId, payload.frontImageUri, 'front');
    let backPath: string | null = null;
    if (payload.backImageUri) {
      backPath = await uploadIdImage(payload.userId, payload.backImageUri, 'back');
    }

    const { data, error } = await supabase
      .from('user_verifications')
      .insert({
        user_id: payload.userId,
        document_type: payload.documentType,
        document_number: payload.documentNumber.trim(),
        full_name: payload.fullName.trim(),
        document_front_url: frontPath,
        document_back_url: backPath,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as UserVerificationRow;
  } catch (error: unknown) {
    logger.error('submitUserVerification failed', error);
    throw error;
  }
};

/** The current user's most recent application (any status). */
export const getMyVerification = async (
  userId: string,
): Promise<UserVerificationRow | null> => {
  const { data, error } = await supabase
    .from('user_verifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.warn('getMyVerification failed', error);
    return null;
  }
  return (data ?? null) as UserVerificationRow | null;
};

/** All applications visible to admins. RLS gates this to admins only. */
export const adminListVerifications = async (
  status?: VerificationStatus,
): Promise<UserVerificationRow[]> => {
  let query = supabase
    .from('user_verifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as UserVerificationRow[];
};

/** Approve. The DB trigger will flip users.is_verified. */
export const adminApproveVerification = async (
  id: string,
  reviewerId: string,
): Promise<void> => {
  const { error } = await supabase
    .from('user_verifications')
    .update({
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', id);
  if (error) throw error;
};

/** Reject with a required reason so the user knows what to fix. */
export const adminRejectVerification = async (
  id: string,
  reviewerId: string,
  reason: string,
): Promise<void> => {
  if (!reason.trim()) throw new Error('Rejection reason is required');
  const { error } = await supabase
    .from('user_verifications')
    .update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason.trim(),
    })
    .eq('id', id);
  if (error) throw error;
};

/**
 * Build a short-lived signed URL for a private document so the admin
 * UI can render the upload as an inline image.
 */
export const getSignedDocumentUrl = async (
  path: string,
  expiresInSeconds = 60 * 10,
): Promise<string | null> => {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) {
    logger.warn('getSignedDocumentUrl failed', error);
    return null;
  }
  return data?.signedUrl ?? null;
};
