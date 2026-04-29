/**
 * Map technical errors (Supabase, network) to user-friendly Arabic messages.
 * Keep the original error logged via logger; only the returned string is shown to the user.
 */

interface SupabaseLikeError {
  message?: string;
  code?: string;
  status?: number;
}

const isSupabaseError = (e: unknown): e is SupabaseLikeError =>
  typeof e === 'object' && e !== null && ('message' in e || 'code' in e);

export const getFriendlyError = (error: unknown, language: 'ar' | 'en' = 'ar'): string => {
  if (!isSupabaseError(error)) {
    return language === 'ar' ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred';
  }

  const message = (error.message || '').toLowerCase();
  const code = error.code || '';

  // Auth errors
  if (message.includes('invalid login credentials') || message.includes('invalid_credentials')) {
    return language === 'ar' ? 'بيانات الدخول غير صحيحة' : 'Invalid email or password';
  }
  if (message.includes('email not confirmed')) {
    return language === 'ar' ? 'يرجى تأكيد بريدك الإلكتروني أولاً' : 'Please confirm your email first';
  }
  if (message.includes('user already registered') || message.includes('already_registered')) {
    return language === 'ar' ? 'هذا البريد الإلكتروني مسجّل مسبقاً' : 'This email is already registered';
  }
  if (message.includes('password should be at least')) {
    return language === 'ar' ? 'كلمة المرور قصيرة جداً' : 'Password is too short';
  }
  if (message.includes('rate limit') || code === 'over_email_send_rate_limit') {
    return language === 'ar' ? 'محاولات كثيرة، يرجى المحاولة لاحقاً' : 'Too many attempts, please try again later';
  }

  // Network
  if (message.includes('network') || message.includes('fetch')) {
    return language === 'ar' ? 'تعذّر الاتصال بالخادم، تحقّق من الإنترنت' : 'Network error, check your connection';
  }

  // Postgres / RLS
  if (code === 'PGRST116') {
    return language === 'ar' ? 'لم يتم العثور على البيانات' : 'No data found';
  }
  if (code === '42501' || message.includes('row level security') || message.includes('not authorized')) {
    return language === 'ar' ? 'ليس لديك صلاحية لهذا الإجراء' : 'You are not authorized for this action';
  }
  if (code === '23505') {
    return language === 'ar' ? 'هذه البيانات موجودة مسبقاً' : 'This record already exists';
  }
  if (code === '23503') {
    return language === 'ar' ? 'البيانات المرجعية غير موجودة' : 'Referenced record not found';
  }

  return error.message || (language === 'ar' ? 'حدث خطأ' : 'An error occurred');
};
