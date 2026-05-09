import { supabase } from './supabaseClient';
import { logger } from '../utils/logger';
import { validateSaudiId, validateSaudiIban, validatePhone, normalizeSaudiPhone } from '../utils/validation';

export interface TechnicianOnboardingPayload {
  userId: string;
  fullName: string;
  phone: string;
  nationalId: string;
  city: string;
  specialty: string;
  yearsOfExperience: number;
  bio: string;
  iban: string;
  idDocumentUri?: string;
  certificateUri?: string;
}

const uploadDoc = async (userId: string, uri: string, kind: 'id' | 'cert'): Promise<string> => {
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${userId}/${kind}-${Date.now()}.${ext}`;
  const response = await fetch(uri);
  const blob = await response.blob();
  const contentType = blob.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
  const { error } = await supabase.storage
    .from('technician-docs')
    // upsert:false because the filename has Date.now() so it's already
    // unique. With upsert:true Supabase Storage demands BOTH an INSERT and
    // an UPDATE policy on the bucket folder, and we only have INSERT — that
    // mismatch produced "ليس لديك صلاحية" (RLS denial) when submitting.
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  return path;
};

export const submitTechnicianApplication = async (
  payload: TechnicianOnboardingPayload
): Promise<void> => {
  if (!payload.fullName.trim()) throw new Error('الاسم الكامل مطلوب');
  if (!validatePhone(payload.phone)) throw new Error('رقم الجوال غير صحيح');
  const idCheck = validateSaudiId(payload.nationalId);
  if (!idCheck.valid) throw new Error(idCheck.message);
  const ibanCheck = validateSaudiIban(payload.iban);
  if (!ibanCheck.valid) throw new Error(ibanCheck.message);
  if (!payload.specialty.trim()) throw new Error('التخصّص مطلوب');
  if (payload.yearsOfExperience < 0 || payload.yearsOfExperience > 60) throw new Error('سنوات الخبرة غير منطقية');
  if (!payload.idDocumentUri) throw new Error('صورة الهوية مطلوبة');

  try {
    const idDocPath = await uploadDoc(payload.userId, payload.idDocumentUri, 'id');
    let certPath: string | undefined;
    if (payload.certificateUri) {
      certPath = await uploadDoc(payload.userId, payload.certificateUri, 'cert');
    }

    // Match the actual technicians schema:
    //   specialization is text[], not a singular text "specialty"
    //   available is the bool, not is_available
    //   total_jobs is the counter, not completed_jobs
    const { error } = await supabase.from('technicians').upsert(
      {
        user_id: payload.userId,
        full_name: payload.fullName.trim(),
        phone: normalizeSaudiPhone(payload.phone),
        specialization: [payload.specialty.trim()],
        years_of_experience: payload.yearsOfExperience,
        national_id: idCheck.valid ? payload.nationalId.replace(/\D/g, '') : payload.nationalId,
        id_document_url: idDocPath,
        certificate_url: certPath,
        iban: payload.iban.replace(/\s/g, '').toUpperCase(),
        city: payload.city.trim(),
        bio: payload.bio.trim(),
        available: false,
        total_jobs: 0,
        rating: 0,
        verification_status: 'submitted',
      },
      { onConflict: 'user_id' }
    );
    if (error) throw error;

    // Also upgrade users.role to technician
    await supabase
      .from('users')
      .update({ role: 'technician', name: payload.fullName.trim() })
      .eq('id', payload.userId);
  } catch (error: any) {
    logger.error('submitTechnicianApplication error', error);
    throw error;
  }
};

export const getMyTechnicianProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('technicians')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
};
