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
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

export default function TermsScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const termsAr = `
# الشروط والأحكام

**آخر تحديث: ديسمبر 2025**

## 1. المقدمة

مرحباً بك في تطبيق Fixatee ("التطبيق"). باستخدامك لهذا التطبيق، فإنك توافق على الالتزام بهذه الشروط والأحكام. يرجى قراءتها بعناية قبل استخدام خدماتنا.

## 2. التعريفات

- **المستخدم**: أي شخص يستخدم التطبيق، سواء كان عميلاً أو فنياً
- **العميل**: المستخدم الذي يطلب خدمات الإصلاح
- **الفني**: مقدم الخدمة المسجل في التطبيق
- **الخدمة**: خدمات إصلاح الأجهزة الإلكترونية المقدمة من خلال التطبيق
- **الطلب**: طلب الخدمة المقدم من العميل

## 3. الأهلية

3.1. يجب أن يكون عمر المستخدم 18 عاماً على الأقل لاستخدام التطبيق
3.2. يجب تقديم معلومات صحيحة ودقيقة عند التسجيل
3.3. يحق لنا رفض أو إلغاء أي حساب في أي وقت

## 4. استخدام التطبيق

4.1. يلتزم المستخدم باستخدام التطبيق للأغراض المشروعة فقط
4.2. يُمنع استخدام التطبيق لأي نشاط غير قانوني أو احتيالي
4.3. يحظر نشر محتوى مسيء أو غير لائق
4.4. يجب الحفاظ على سرية بيانات الحساب

## 5. الخدمات والأسعار

5.1. الأسعار المعروضة هي أسعار تقديرية وقد تتغير بناءً على الفحص الفعلي
5.2. يتم الاتفاق على السعر النهائي بين العميل والفني قبل بدء العمل
5.3. جميع الأسعار بالريال السعودي وتشمل ضريبة القيمة المضافة

## 6. الدفع

6.1. يتم الدفع مباشرة للفني بعد إتمام الخدمة
6.2. طرق الدفع المتاحة: نقداً، بطاقة ائتمانية، تحويل بنكي
6.3. لا نتحمل مسؤولية النزاعات المالية بين العميل والفني

## 7. الإلغاء والاسترجاع

7.1. يمكن إلغاء الطلب قبل قبول الفني له دون رسوم
7.2. بعد قبول الطلب، قد تطبق رسوم إلغاء
7.3. لا يمكن استرجاع المبالغ بعد إتمام الخدمة إلا في حالات خاصة

## 8. مسؤوليات الفني

8.1. يجب أن يكون الفني مؤهلاً ومرخصاً لتقديم الخدمات
8.2. الالتزام بمعايير الجودة والاحترافية
8.3. احترام خصوصية العميل وممتلكاته
8.4. تقديم ضمان على الإصلاحات المنفذة

## 9. مسؤوليات العميل

9.1. تقديم معلومات دقيقة عن الجهاز والمشكلة
9.2. التواجد في الموقع المحدد في الوقت المتفق عليه
9.3. الدفع للفني بعد إتمام الخدمة
9.4. عدم التلاعب بالجهاز قبل وصول الفني

## 10. الضمان

10.1. يقدم الفني ضماناً على الإصلاحات حسب نوع الخدمة
10.2. مدة الضمان تتراوح من 7 إلى 90 يوماً
10.3. الضمان لا يشمل الأضرار الناتجة عن سوء الاستخدام

## 11. المسؤولية

11.1. التطبيق منصة وساطة فقط بين العملاء والفنيين
11.2. لا نتحمل مسؤولية جودة الخدمات المقدمة
11.3. لا نتحمل مسؤولية أي أضرار ناتجة عن استخدام التطبيق

## 12. الخصوصية

12.1. نحترم خصوصية المستخدمين ونحمي بياناتهم
12.2. يرجى مراجعة سياسة الخصوصية للمزيد من التفاصيل
12.3. لا نشارك البيانات الشخصية مع أطراف ثالثة إلا بموافقة المستخدم

## 13. الملكية الفكرية

13.1. جميع حقوق الملكية الفكرية للتطبيق محفوظة
13.2. يُمنع نسخ أو تعديل أو توزيع محتوى التطبيق
13.3. الشعارات والعلامات التجارية مملوكة لنا

## 14. التعديلات

14.1. نحتفظ بالحق في تعديل هذه الشروط في أي وقت
14.2. سيتم إشعار المستخدمين بأي تغييرات جوهرية
14.3. استمرار استخدام التطبيق يعني الموافقة على التعديلات

## 15. إنهاء الحساب

15.1. يمكن للمستخدم إنهاء حسابه في أي وقت
15.2. نحتفظ بالحق في تعليق أو إنهاء أي حساب يخالف الشروط
15.3. عند إنهاء الحساب، تُحذف البيانات الشخصية

## 16. القانون الساري

16.1. تخضع هذه الشروط لقوانين المملكة العربية السعودية
16.2. تُحل النزاعات ودياً أو عبر المحاكم السعودية
16.3. اللغة العربية هي اللغة المعتمدة لتفسير الشروط

## 17. الاتصال بنا

إذا كان لديك أي استفسارات حول هذه الشروط، يرجى التواصل معنا:

- البريد الإلكتروني: support@fixatee.com
- الهاتف: +966 XX XXX XXXX
- العنوان: الرياض، المملكة العربية السعودية

---

**بقبولك لهذه الشروط، فإنك تقر بأنك قرأتها وفهمتها ووافقت عليها.**
`;

  const termsEn = `
# Terms and Conditions

**Last Updated: December 2025**

## 1. Introduction

Welcome to Fixatee ("the App"). By using this App, you agree to comply with these Terms and Conditions. Please read them carefully before using our services.

## 2. Definitions

- **User**: Any person using the App, whether customer or technician
- **Customer**: User requesting repair services
- **Technician**: Service provider registered in the App
- **Service**: Electronic device repair services provided through the App
- **Order**: Service request submitted by the customer

## 3. Eligibility

3.1. Users must be at least 18 years old to use the App
3.2. Accurate information must be provided during registration
3.3. We reserve the right to refuse or cancel any account at any time

## 4. Use of the App

4.1. Users must use the App for lawful purposes only
4.2. Using the App for illegal or fraudulent activities is prohibited
4.3. Posting offensive or inappropriate content is forbidden
4.4. Account credentials must be kept confidential

## 5. Services and Pricing

5.1. Displayed prices are estimates and may change based on actual inspection
5.2. Final price is agreed upon between customer and technician before work begins
5.3. All prices are in Saudi Riyals and include VAT

## 6. Payment

6.1. Payment is made directly to the technician after service completion
6.2. Available payment methods: Cash, Credit Card, Bank Transfer
6.3. We are not responsible for financial disputes between customer and technician

## 7. Cancellation and Refunds

7.1. Orders can be cancelled before technician acceptance without fees
7.2. After order acceptance, cancellation fees may apply
7.3. Refunds are not available after service completion except in special cases

## 8. Technician Responsibilities

8.1. Technicians must be qualified and licensed to provide services
8.2. Commitment to quality and professionalism standards
8.3. Respect customer privacy and property
8.4. Provide warranty on completed repairs

## 9. Customer Responsibilities

9.1. Provide accurate information about device and issue
9.2. Be present at specified location at agreed time
9.3. Pay technician after service completion
9.4. Do not tamper with device before technician arrival

## 10. Warranty

10.1. Technicians provide warranty on repairs based on service type
10.2. Warranty period ranges from 7 to 90 days
10.3. Warranty does not cover damage from misuse

## 11. Liability

11.1. The App is only an intermediary platform between customers and technicians
11.2. We are not responsible for quality of services provided
11.3. We are not liable for any damages resulting from App use

## 12. Privacy

12.1. We respect user privacy and protect their data
12.2. Please review our Privacy Policy for more details
12.3. Personal data is not shared with third parties without user consent

## 13. Intellectual Property

13.1. All intellectual property rights of the App are reserved
13.2. Copying, modifying, or distributing App content is prohibited
13.3. Logos and trademarks are our property

## 14. Amendments

14.1. We reserve the right to modify these terms at any time
14.2. Users will be notified of any material changes
14.3. Continued use of the App implies acceptance of modifications

## 15. Account Termination

15.1. Users can terminate their account at any time
15.2. We reserve the right to suspend or terminate any account violating terms
15.3. Upon account termination, personal data is deleted

## 16. Governing Law

16.1. These terms are governed by the laws of Saudi Arabia
16.2. Disputes are resolved amicably or through Saudi courts
16.3. Arabic is the authoritative language for interpreting terms

## 17. Contact Us

If you have any questions about these terms, please contact us:

- Email: support@fixatee.com
- Phone: +966 XX XXX XXXX
- Address: Riyadh, Saudi Arabia

---

**By accepting these terms, you acknowledge that you have read, understood, and agreed to them.**
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
          {isRTL ? 'الشروط والأحكام' : 'Terms & Conditions'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={[styles.text, { color: COLORS.text }]}>
            {isRTL ? termsAr : termsEn}
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
