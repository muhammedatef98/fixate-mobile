import * as yup from 'yup';

export const orderSchema = yup.object({
  service: yup.string().required('الخدمة مطلوبة'),
  description: yup
    .string()
    .min(10, 'الوصف قصير جداً، 10 أحرف على الأقل')
    .required('الوصف مطلوب'),
  address: yup
    .string()
    .min(5, 'العنوان قصير جداً')
    .required('العنوان مطلوب'),
  price: yup
    .number()
    .min(1, 'السعر يجب أن يكون أكبر من 0')
    .required('السعر مطلوب'),
});

export const profileSchema = yup.object({
  name: yup.string().min(2, 'الاسم قصير جداً').required('الاسم مطلوب'),
  phone: yup
    .string()
    .matches(/^01[0-9]{9}$/, 'رقم الهاتف غير صحيح')
    .required('رقم الهاتف مطلوب'),
  email: yup.string().email('البريد الإلكتروني غير صحيح').optional(),
});

export const loginSchema = yup.object({
  email: yup.string().email('البريد غير صحيح').required('البريد مطلوب'),
  password: yup
    .string()
    .min(6, 'كلمة المرور 6 أحرف على الأقل')
    .required('كلمة المرور مطلوبة'),
});
