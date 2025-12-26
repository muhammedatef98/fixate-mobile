/**
 * Input validation utilities for Fixate app
 * Ensures data integrity and security
 */

// Password validation utility
export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

export const validatePassword = (password: string, language: 'ar' | 'en' = 'ar'): PasswordValidation => {
  const errors: string[] = [];
  
  // Minimum length check
  if (password.length < 8) {
    errors.push(language === 'ar' ? 'يجب أن تكون كلمة المرور 8 أحرف على الأقل' : 'Password must be at least 8 characters');
  }
  
  // Uppercase letter check
  if (!/[A-Z]/.test(password)) {
    errors.push(language === 'ar' ? 'يجب أن تحتوي على حرف كبير واحد على الأقل' : 'Must contain at least one uppercase letter');
  }
  
  // Lowercase letter check
  if (!/[a-z]/.test(password)) {
    errors.push(language === 'ar' ? 'يجب أن تحتوي على حرف صغير واحد على الأقل' : 'Must contain at least one lowercase letter');
  }
  
  // Number check
  if (!/[0-9]/.test(password)) {
    errors.push(language === 'ar' ? 'يجب أن تحتوي على رقم واحد على الأقل' : 'Must contain at least one number');
  }
  
  // Special character check
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push(language === 'ar' ? 'يجب أن تحتوي على رمز خاص واحد على الأقل (!@#$%^&*)' : 'Must contain at least one special character (!@#$%^&*)');
  }
  
  // Calculate strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (errors.length === 0) {
    strength = 'strong';
  } else if (errors.length <= 2) {
    strength = 'medium';
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
};

export const getPasswordStrengthColor = (strength: 'weak' | 'medium' | 'strong'): string => {
  switch (strength) {
    case 'weak':
      return '#EF4444';
    case 'medium':
      return '#F59E0B';
    case 'strong':
      return '#10B981';
  }
};

export const getPasswordStrengthText = (strength: 'weak' | 'medium' | 'strong', language: 'ar' | 'en'): string => {
  if (language === 'ar') {
    switch (strength) {
      case 'weak':
        return 'ضعيفة';
      case 'medium':
        return 'متوسطة';
      case 'strong':
        return 'قوية';
    }
  } else {
    switch (strength) {
      case 'weak':
        return 'Weak';
      case 'medium':
        return 'Medium';
      case 'strong':
        return 'Strong';
    }
  }
};

// Email validation
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone validation (Saudi Arabia format)
export const validatePhone = (phone: string): boolean => {
  // Saudi phone: 05xxxxxxxx or +9665xxxxxxxx or 5xxxxxxxx
  const phoneRegex = /^(05|5|\+9665)[0-9]{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

/**
 * Normalize Saudi phone number to +966XXXXXXXXX format
 */
export const normalizeSaudiPhone = (phone: string): string => {
  const cleanPhone = phone.replace(/[\s-]/g, '');

  // Already in correct format
  if (cleanPhone.startsWith('+966')) {
    return cleanPhone;
  }

  // 05XXXXXXXX -> +9665XXXXXXXX
  if (cleanPhone.startsWith('05')) {
    return '+966' + cleanPhone.substring(1);
  }

  // 5XXXXXXXX -> +9665XXXXXXXX
  if (cleanPhone.startsWith('5')) {
    return '+966' + cleanPhone;
  }

  return cleanPhone;
};

/**
 * Validate price (must be positive number)
 */
export const validatePrice = (price: number | string): { valid: boolean; message: string } => {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;

  if (isNaN(numPrice)) {
    return {
      valid: false,
      message: 'السعر يجب أن يكون رقماً / Price must be a number',
    };
  }

  if (numPrice < 0) {
    return {
      valid: false,
      message: 'السعر يجب أن يكون موجباً / Price must be positive',
    };
  }

  if (numPrice > 100000) {
    return {
      valid: false,
      message: 'السعر مرتفع جداً / Price is too high',
    };
  }

  return {
    valid: true,
    message: '',
  };
};

/**
 * Validate address (non-empty string)
 */
export const validateAddress = (address: string): { valid: boolean; message: string } => {
  if (!address || address.trim().length === 0) {
    return {
      valid: false,
      message: 'العنوان مطلوب / Address is required',
    };
  }

  if (address.trim().length < 10) {
    return {
      valid: false,
      message: 'العنوان قصير جداً / Address is too short',
    };
  }

  if (address.length > 500) {
    return {
      valid: false,
      message: 'العنوان طويل جداً / Address is too long',
    };
  }

  return {
    valid: true,
    message: '',
  };
};

/**
 * Validate name (non-empty, alphabetic)
 */
export const validateName = (name: string): { valid: boolean; message: string } => {
  if (!name || name.trim().length === 0) {
    return {
      valid: false,
      message: 'الاسم مطلوب / Name is required',
    };
  }

  if (name.trim().length < 2) {
    return {
      valid: false,
      message: 'الاسم قصير جداً / Name is too short',
    };
  }

  if (name.length > 100) {
    return {
      valid: false,
      message: 'الاسم طويل جداً / Name is too long',
    };
  }

  // Allow Arabic, English, and spaces
  const nameRegex = /^[\u0600-\u06FFa-zA-Z\s]+$/;
  if (!nameRegex.test(name)) {
    return {
      valid: false,
      message: 'الاسم يجب أن يحتوي على أحرف فقط / Name must contain only letters',
    };
  }

  return {
    valid: true,
    message: '',
  };
};

/**
 * Validate description/notes
 */
export const validateDescription = (description: string, minLength: number = 10, maxLength: number = 1000): { valid: boolean; message: string } => {
  if (!description || description.trim().length === 0) {
    return {
      valid: false,
      message: 'الوصف مطلوب / Description is required',
    };
  }

  if (description.trim().length < minLength) {
    return {
      valid: false,
      message: `الوصف قصير جداً (الحد الأدنى ${minLength} حرف) / Description is too short (minimum ${minLength} characters)`,
    };
  }

  if (description.length > maxLength) {
    return {
      valid: false,
      message: `الوصف طويل جداً (الحد الأقصى ${maxLength} حرف) / Description is too long (maximum ${maxLength} characters)`,
    };
  }

  return {
    valid: true,
    message: '',
  };
};

/**
 * Validate file size (in bytes)
 */
export const validateFileSize = (sizeInBytes: number, maxSizeMB: number = 5): { valid: boolean; message: string } => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (sizeInBytes > maxSizeBytes) {
    return {
      valid: false,
      message: `حجم الملف كبير جداً (الحد الأقصى ${maxSizeMB}MB) / File size is too large (maximum ${maxSizeMB}MB)`,
    };
  }

  return {
    valid: true,
    message: '',
  };
};

/**
 * Validate image file type
 */
export const validateImageType = (mimeType: string): { valid: boolean; message: string } => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(mimeType.toLowerCase())) {
    return {
      valid: false,
      message: 'نوع الملف غير مدعوم. استخدم JPG أو PNG / Unsupported file type. Use JPG or PNG',
    };
  }

  return {
    valid: true,
    message: '',
  };
};

/**
 * Sanitize input to prevent XSS
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Validate coordinates (latitude, longitude)
 */
export const validateCoordinates = (lat: number, lng: number): { valid: boolean; message: string } => {
  if (isNaN(lat) || isNaN(lng)) {
    return {
      valid: false,
      message: 'الإحداثيات غير صحيحة / Invalid coordinates',
    };
  }

  // Saudi Arabia approximate bounds
  // Latitude: 16°N to 32°N
  // Longitude: 34°E to 56°E
  if (lat < 16 || lat > 32 || lng < 34 || lng > 56) {
    return {
      valid: false,
      message: 'الموقع خارج المملكة العربية السعودية / Location is outside Saudi Arabia',
    };
  }

  return {
    valid: true,
    message: '',
  };
};

/**
 * Validate all form fields at once
 */
export const validateForm = (fields: Record<string, any>, rules: Record<string, (value: any) => { valid: boolean; message: string }>): { valid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};
  let valid = true;

  for (const [field, rule] of Object.entries(rules)) {
    const result = rule(fields[field]);
    if (!result.valid) {
      errors[field] = result.message;
      valid = false;
    }
  }

  return { valid, errors };
};
