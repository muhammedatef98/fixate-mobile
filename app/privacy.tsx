import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getColors, SPACING } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

export default function PrivacyScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const privacyAr = `
# سياسة الخصوصية

**آخر تحديث: ديسمبر 2025**

## 1. المقدمة

نحن في Fixatee نلتزم بحماية خصوصيتك. توضح هذه السياسة كيفية جمع واستخدام وحماية معلوماتك الشخصية وفقاً لنظام حماية البيانات الشخصية في المملكة العربية السعودية.

## 2. المعلومات التي نجمعها

### 2.1 المعلومات الشخصية
- الاسم الكامل
- رقم الهاتف
- عنوان البريد الإلكتروني
- الموقع الجغرافي
- صور الجهاز المراد إصلاحه

### 2.2 معلومات الاستخدام
- سجل الطلبات
- تفضيلات التطبيق
- بيانات التفاعل مع التطبيق
- معلومات الجهاز (نوع الجهاز، نظام التشغيل)

### 2.3 معلومات الموقع
- نجمع موقعك الجغرافي لتوفير خدمات الفنيين المتنقلين
- يمكنك إيقاف مشاركة الموقع من إعدادات الجهاز

## 3. كيفية استخدام المعلومات

نستخدم معلوماتك للأغراض التالية:

3.1. تقديم وتحسين خدماتنا
3.2. التواصل معك بخصوص طلباتك
3.3. معالجة المدفوعات
3.4. إرسال إشعارات مهمة
3.5. تحسين تجربة المستخدم
3.6. الامتثال للمتطلبات القانونية

## 4. مشاركة المعلومات

### 4.1 مع الفنيين
نشارك معلومات الاتصال والموقع مع الفني المعين لطلبك فقط.

### 4.2 مع الجهات الحكومية
قد نشارك المعلومات عند الطلب من الجهات الحكومية المختصة.

### 4.3 مع مقدمي الخدمات
نستخدم خدمات طرف ثالث (مثل Supabase) لتخزين البيانات بشكل آمن.

### 4.4 عدم البيع
لا نبيع أو نؤجر معلوماتك الشخصية لأطراف ثالثة.

## 5. حماية المعلومات

### 5.1 التشفير
نستخدم تشفير SSL/TLS لحماية البيانات أثناء النقل.

### 5.2 التخزين الآمن
تُخزن البيانات في خوادم آمنة مع ضوابط وصول صارمة.

### 5.3 المراجعة الأمنية
نجري مراجعات أمنية دورية لحماية البيانات.

## 6. حقوقك

لديك الحق في:

6.1. الوصول إلى معلوماتك الشخصية
6.2. تصحيح المعلومات غير الدقيقة
6.3. حذف حسابك ومعلوماتك
6.4. الاعتراض على معالجة بياناتك
6.5. طلب نسخة من بياناتك
6.6. سحب الموافقة في أي وقت

## 7. الاحتفاظ بالبيانات

### 7.1 المدة
نحتفظ بمعلوماتك طالما كان حسابك نشطاً أو حسب الحاجة لتقديم الخدمات.

### 7.2 الحذف
عند حذف حسابك، نحذف معلوماتك الشخصية خلال 30 يوماً.

### 7.3 الاستثناءات
قد نحتفظ ببعض المعلومات للامتثال للمتطلبات القانونية.

## 8. ملفات تعريف الارتباط (Cookies)

8.1. نستخدم ملفات تعريف الارتباط لتحسين تجربتك
8.2. يمكنك تعطيل ملفات تعريف الارتباط من إعدادات المتصفح
8.3. تعطيل ملفات تعريف الارتباط قد يؤثر على بعض الوظائف

## 9. خصوصية الأطفال

9.1. التطبيق غير موجه للأطفال دون 18 عاماً
9.2. لا نجمع معلومات من الأطفال عن قصد
9.3. إذا اكتشفنا جمع معلومات من طفل، سنحذفها فوراً

## 10. التعديلات على السياسة

10.1. قد نحدث هذه السياسة من وقت لآخر
10.2. سنخطرك بأي تغييرات جوهرية
10.3. استمرار استخدام التطبيق يعني قبول التعديلات

## 11. الامتثال للأنظمة

نلتزم بـ:

11.1. نظام حماية البيانات الشخصية السعودي
11.2. اللائحة التنفيذية لحماية البيانات
11.3. معايير الأمن السيبراني الوطنية

## 12. الاتصال بنا

لأي استفسارات حول الخصوصية:

- البريد الإلكتروني: privacy@fixatee.com
- الهاتف: +966 XX XXX XXXX
- العنوان: الرياض، المملكة العربية السعودية

---

**آخر تحديث: ديسمبر 2025**
`;

  const privacyEn = `
# Privacy Policy

**Last Updated: December 2025**

## 1. Introduction

At Fixatee, we are committed to protecting your privacy. This policy explains how we collect, use, and protect your personal information in accordance with Saudi Arabia's Personal Data Protection Law.

## 2. Information We Collect

### 2.1 Personal Information
- Full name
- Phone number
- Email address
- Geographic location
- Device photos for repair

### 2.2 Usage Information
- Order history
- App preferences
- App interaction data
- Device information (device type, operating system)

### 2.3 Location Information
- We collect your geographic location to provide mobile technician services
- You can disable location sharing from device settings

## 3. How We Use Information

We use your information for the following purposes:

3.1. Provide and improve our services
3.2. Communicate with you about your orders
3.3. Process payments
3.4. Send important notifications
3.5. Improve user experience
3.6. Comply with legal requirements

## 4. Information Sharing

### 4.1 With Technicians
We share contact and location information only with the technician assigned to your order.

### 4.2 With Government Authorities
We may share information when requested by competent government authorities.

### 4.3 With Service Providers
We use third-party services (such as Supabase) to store data securely.

### 4.4 No Selling
We do not sell or rent your personal information to third parties.

## 5. Information Protection

### 5.1 Encryption
We use SSL/TLS encryption to protect data in transit.

### 5.2 Secure Storage
Data is stored on secure servers with strict access controls.

### 5.3 Security Audits
We conduct regular security audits to protect data.

## 6. Your Rights

You have the right to:

6.1. Access your personal information
6.2. Correct inaccurate information
6.3. Delete your account and information
6.4. Object to data processing
6.5. Request a copy of your data
6.6. Withdraw consent at any time

## 7. Data Retention

### 7.1 Duration
We retain your information as long as your account is active or as needed to provide services.

### 7.2 Deletion
Upon account deletion, we delete your personal information within 30 days.

### 7.3 Exceptions
We may retain some information to comply with legal requirements.

## 8. Cookies

8.1. We use cookies to improve your experience
8.2. You can disable cookies from browser settings
8.3. Disabling cookies may affect some features

## 9. Children's Privacy

9.1. The App is not directed to children under 18
9.2. We do not knowingly collect information from children
9.3. If we discover collection of information from a child, we will delete it immediately

## 10. Policy Updates

10.1. We may update this policy from time to time
10.2. We will notify you of any material changes
10.3. Continued use of the App implies acceptance of updates

## 11. Regulatory Compliance

We comply with:

11.1. Saudi Personal Data Protection Law
11.2. Data Protection Executive Regulations
11.3. National Cybersecurity Standards

## 12. Contact Us

For any privacy inquiries:

- Email: privacy@fixatee.com
- Phone: +966 XX XXX XXXX
- Address: Riyadh, Saudi Arabia

---

**Last Updated: December 2025**
`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons 
            name={isRTL ? 'arrow-forward' : 'arrow-back'} 
            size={24} 
            color={COLORS.text} 
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>
          {isRTL ? 'سياسة الخصوصية' : 'Privacy Policy'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={[styles.text, { color: COLORS.text }]}>
            {isRTL ? privacyAr : privacyEn}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
  },
  text: {
    fontSize: 14,
    lineHeight: 24,
  },
});
