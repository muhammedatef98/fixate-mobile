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
import { decode } from 'base64-arraybuffer';
// expo-file-system v19 routed readAsStringAsync through a deprecation warning
// on every call; the /legacy path is the same function without the noise.
import { readAsStringAsync } from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

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
  selfie_url: string | null;
  challenge_text: string | null;
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
  /** Selfie of the user performing the on-screen challenge (FEATURE-1 KYC). */
  selfieImageUri: string;
  /** The random anti-replay challenge text shown when the selfie was taken. */
  challengeText: string;
}

const BUCKET = 'user-id-documents';

/**
 * Anti-replay liveness challenges (FEATURE-1). A fresh one is generated each
 * time the verification screen opens; the user must perform it in the selfie.
 * Templates that embed a random 4-digit number defeat replays of old selfies.
 */
const CHALLENGE_TEMPLATES: {
  ar: (n: string) => string;
  en: (n: string) => string;
}[] = [
  { ar: () => 'ارفع إصبعك الأيمن', en: () => 'Raise your right index finger' },
  {
    ar: (n) => `أمسك ورقة مكتوب عليها الرقم ${n}`,
    en: (n) => `Hold a paper showing the number ${n}`,
  },
  { ar: () => 'اعمل علامة النصر (V) بيدك', en: () => 'Make a V (victory) sign with your hand' },
  { ar: () => 'أشر لأعلى بيدك اليسرى', en: () => 'Point upward with your left hand' },
  { ar: () => 'ضع يدك اليمنى على كتفك الأيسر', en: () => 'Place your right hand on your left shoulder' },
];

/**
 * Generate a fresh challenge string in the requested language. Avoids returning
 * the exact same text as `previousText` so consecutive sessions differ.
 */
export const generateChallenge = (
  isRTL: boolean,
  previousText?: string | null,
): string => {
  let text = '';
  let guard = 0;
  do {
    const tpl = CHALLENGE_TEMPLATES[Math.floor(Math.random() * CHALLENGE_TEMPLATES.length)];
    const n = String(Math.floor(1000 + Math.random() * 9000));
    text = isRTL ? tpl.ar(n) : tpl.en(n);
    guard += 1;
  } while (previousText && text === previousText && guard < 10);
  return text;
};

/**
 * Upload an image picked from the device into the private bucket
 * under the user's own folder. The bucket's RLS only allows writes
 * where the path's first segment matches auth.uid().
 *
 * IMPORTANT: we read the file as base64 and decode it to an ArrayBuffer
 * rather than using `fetch(uri).blob()`. In React Native / Expo, feeding a
 * Blob built from a local file:// URI to the Supabase upload silently writes
 * a ZERO-BYTE object — the upload "succeeds" but the file is empty, so the
 * admin panel later shows a valid signed URL that resolves to nothing. The
 * base64 → decode path (the same one storageService.uploadOne uses for order
 * and market photos) is the proven way to upload real bytes on RN.
 */
const uploadIdImage = async (
  userId: string,
  uri: string,
  side: 'front' | 'back' | 'selfie',
): Promise<string> => {
  // Normalise to a compressed JPEG so every upload is a known-good format and
  // the payload stays small (ID photos from a 12 MP camera are needlessly big).
  let sourceUri = uri;
  try {
    const manipulated = await manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.85, format: SaveFormat.JPEG },
    );
    sourceUri = manipulated.uri;
  } catch (e) {
    logger.warn('uploadIdImage compress failed, using original', e);
  }

  const path = `${userId}/${side}-${Date.now()}.jpg`;
  const base64 = await readAsStringAsync(sourceUri, { encoding: 'base64' });
  const fileBytes = decode(base64);
  if (fileBytes.byteLength === 0) {
    // Guard against re-introducing the zero-byte bug from any future refactor.
    throw new Error(`Refusing to upload empty ${side} image`);
  }
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileBytes, { contentType: 'image/jpeg', upsert: false });
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
  if (!p.selfieImageUri) throw new Error('Selfie image is required');
  if (!p.challengeText?.trim()) throw new Error('Challenge text is required');
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
    const selfiePath = await uploadIdImage(payload.userId, payload.selfieImageUri, 'selfie');

    const { data, error } = await supabase
      .from('user_verifications')
      .insert({
        user_id: payload.userId,
        document_type: payload.documentType,
        document_number: payload.documentNumber.trim(),
        full_name: payload.fullName.trim(),
        document_front_url: frontPath,
        document_back_url: backPath,
        selfie_url: selfiePath,
        challenge_text: payload.challengeText.trim(),
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
