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
  // Saudi phone: 05xxxxxxxx or +9665xxxxxxxx
  const phoneRegex = /^(05|5|\+9665)[0-9]{8}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};
