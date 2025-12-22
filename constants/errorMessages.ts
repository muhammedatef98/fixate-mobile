/**
 * Centralized error messages for the app
 * Supports both Arabic and English
 */

export const errorMessages = {
  // Authentication errors
  auth: {
    invalidCredentials: {
      ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      en: 'Invalid email or password',
    },
    emailAlreadyExists: {
      ar: 'البريد الإلكتروني مستخدم بالفعل',
      en: 'Email already exists',
    },
    weakPassword: {
      ar: 'كلمة المرور ضعيفة. يجب أن تكون 6 أحرف على الأقل',
      en: 'Password is too weak. Must be at least 6 characters',
    },
    emailNotVerified: {
      ar: 'الرجاء التحقق من بريدك الإلكتروني أولاً',
      en: 'Please verify your email first',
    },
    sessionExpired: {
      ar: 'انتهت جلستك. الرجاء تسجيل الدخول مرة أخرى',
      en: 'Your session has expired. Please login again',
    },
  },

  // Network errors
  network: {
    noConnection: {
      ar: 'لا يوجد اتصال بالإنترنت',
      en: 'No internet connection',
    },
    timeout: {
      ar: 'انتهت مهلة الطلب. حاول مرة أخرى',
      en: 'Request timeout. Please try again',
    },
    serverError: {
      ar: 'خطأ في الخادم. حاول مرة أخرى لاحقاً',
      en: 'Server error. Please try again later',
    },
  },

  // Order/Request errors
  order: {
    submissionFailed: {
      ar: 'فشل إرسال الطلب. حاول مرة أخرى',
      en: 'Failed to submit order. Please try again',
    },
    invalidData: {
      ar: 'بيانات الطلب غير صحيحة',
      en: 'Invalid order data',
    },
    locationRequired: {
      ar: 'الرجاء تحديد الموقع',
      en: 'Location is required',
    },
    deviceRequired: {
      ar: 'الرجاء اختيار الجهاز',
      en: 'Device selection is required',
    },
    issueRequired: {
      ar: 'الرجاء اختيار المشكلة',
      en: 'Issue selection is required',
    },
  },

  // Upload errors
  upload: {
    failed: {
      ar: 'فشل رفع الملف',
      en: 'File upload failed',
    },
    tooLarge: {
      ar: 'حجم الملف كبير جداً. الحد الأقصى 5 ميجابايت',
      en: 'File is too large. Maximum 5MB',
    },
    invalidFormat: {
      ar: 'صيغة الملف غير مدعومة',
      en: 'File format not supported',
    },
  },

  // Permission errors
  permission: {
    locationDenied: {
      ar: 'تم رفض إذن الموقع. الرجاء تفعيله من الإعدادات',
      en: 'Location permission denied. Please enable it in settings',
    },
    cameraDenied: {
      ar: 'تم رفض إذن الكاميرا. الرجاء تفعيله من الإعدادات',
      en: 'Camera permission denied. Please enable it in settings',
    },
    galleryDenied: {
      ar: 'تم رفض إذن المعرض. الرجاء تفعيله من الإعدادات',
      en: 'Gallery permission denied. Please enable it in settings',
    },
  },

  // Generic errors
  generic: {
    unknown: {
      ar: 'حدث خطأ غير متوقع',
      en: 'An unexpected error occurred',
    },
    tryAgain: {
      ar: 'حدث خطأ. حاول مرة أخرى',
      en: 'An error occurred. Please try again',
    },
    notFound: {
      ar: 'العنصر غير موجود',
      en: 'Item not found',
    },
    unauthorized: {
      ar: 'غير مصرح لك بهذا الإجراء',
      en: 'You are not authorized for this action',
    },
  },
};

/**
 * Helper function to get error message based on language
 */
export const getErrorMessage = (
  category: keyof typeof errorMessages,
  key: string,
  language: 'ar' | 'en' = 'ar'
): string => {
  const categoryMessages = errorMessages[category] as any;
  const message = categoryMessages[key];
  return message ? message[language] : errorMessages.generic.unknown[language];
};
