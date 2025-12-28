# دليل RTL (Right-to-Left) للتطبيق
# RTL (Right-to-Left) Guide

## 📖 نظرة عامة / Overview

التطبيق يدعم اللغة العربية بشكل كامل مع RTL (من اليمين لليسار). هذا الدليل يشرح كيفية التعامل مع RTL في التطبيق.

---

## ⚙️ الإعداد الحالي / Current Setup

### 1. I18nManager في _layout.tsx

```typescript
import { I18nManager } from 'react-native';

useEffect(() => {
  const isRTL = language === 'ar';
  if (I18nManager.isRTL !== isRTL) {
    I18nManager.forceRTL(isRTL);
    I18nManager.allowRTL(isRTL);
  }
}, [language]);
```

**ملاحظة مهمة:** تغيير RTL يتطلب إعادة تحميل التطبيق بالكامل.

### 2. اللغة الافتراضية

اللغة الافتراضية هي **العربية** في `AppContext.tsx`:

```typescript
const [language, setLanguage] = useState<Language>('ar');
```

---

## 🛠️ كيفية استخدام RTL / How to Use RTL

### الطريقة الصحيحة ✅

استخدم `I18nManager.isRTL` بدلاً من `language === 'ar'`:

```typescript
import { I18nManager } from 'react-native';

// ✅ الطريقة الصحيحة
const isRTL = I18nManager.isRTL;

// أو استخدم helper function
import { isRTL, getTextAlign, getFlexDirection } from '../utils/rtl';

<Text style={{ textAlign: getTextAlign() }}>
  النص العربي
</Text>
```

### الطريقة الخاطئة ❌

```typescript
// ❌ لا تستخدم هذه الطريقة
const isRTL = language === 'ar';
```

**السبب:** `I18nManager.isRTL` يعكس الحالة الفعلية للنظام، بينما `language === 'ar'` قد لا يتطابق إذا لم يتم إعادة تحميل التطبيق.

---

## 📦 RTL Helper Functions

تم إنشاء ملف `utils/rtl.ts` يحتوي على دوال مساعدة:

### 1. isRTL()
```typescript
import { isRTL } from '../utils/rtl';

if (isRTL()) {
  // التطبيق في وضع RTL
}
```

### 2. getTextAlign()
```typescript
import { getTextAlign } from '../utils/rtl';

<Text style={{ textAlign: getTextAlign() }}>
  النص
</Text>
```

### 3. getFlexDirection()
```typescript
import { getFlexDirection } from '../utils/rtl';

<View style={{ flexDirection: getFlexDirection() }}>
  <Text>عنصر 1</Text>
  <Text>عنصر 2</Text>
</View>
```

### 4. Margin & Padding Helpers
```typescript
import { getMarginStart, getMarginEnd, getPaddingStart, getPaddingEnd } from '../utils/rtl';

<View style={{
  ...getMarginStart(10),  // marginRight في RTL، marginLeft في LTR
  ...getPaddingEnd(20),   // paddingLeft في RTL، paddingRight في LTR
}}>
  <Text>محتوى</Text>
</View>
```

### 5. rtlStyles Object
```typescript
import { rtlStyles } from '../utils/rtl';

<Text style={[styles.text, rtlStyles]}>
  النص العربي
</Text>
```

---

## 🎨 أمثلة عملية / Practical Examples

### مثال 1: Text Alignment

```typescript
// ❌ الطريقة القديمة
<Text style={{ textAlign: language === 'ar' ? 'right' : 'left' }}>
  النص
</Text>

// ✅ الطريقة الجديدة
import { getTextAlign } from '../utils/rtl';

<Text style={{ textAlign: getTextAlign() }}>
  النص
</Text>
```

### مثال 2: Flex Direction

```typescript
// ❌ الطريقة القديمة
<View style={{ flexDirection: language === 'ar' ? 'row-reverse' : 'row' }}>
  <Icon />
  <Text>النص</Text>
</View>

// ✅ الطريقة الجديدة
import { getFlexDirection } from '../utils/rtl';

<View style={{ flexDirection: getFlexDirection() }}>
  <Icon />
  <Text>النص</Text>
</View>
```

### مثال 3: Icons Direction

```typescript
import { I18nManager } from 'react-native';

<MaterialIcons 
  name={I18nManager.isRTL ? "arrow-forward" : "arrow-back"} 
  size={24} 
/>
```

### مثال 4: Margins & Paddings

```typescript
// ❌ الطريقة القديمة
<View style={{ 
  marginLeft: language === 'ar' ? 0 : 10,
  marginRight: language === 'ar' ? 10 : 0,
}}>
  <Text>النص</Text>
</View>

// ✅ الطريقة الجديدة
import { getMarginStart } from '../utils/rtl';

<View style={getMarginStart(10)}>
  <Text>النص</Text>
</View>
```

---

## 🔧 تحديث الكود الموجود / Updating Existing Code

### خطوات التحديث:

1. **استبدل `language === 'ar'` بـ `I18nManager.isRTL`**

```typescript
// قبل
const isRTL = language === 'ar';

// بعد
import { I18nManager } from 'react-native';
const isRTL = I18nManager.isRTL;
```

2. **استخدم helper functions**

```typescript
// قبل
textAlign: language === 'ar' ? 'right' : 'left'

// بعد
import { getTextAlign } from '../utils/rtl';
textAlign: getTextAlign()
```

3. **استخدم marginStart/marginEnd بدلاً من marginLeft/marginRight**

```typescript
// قبل
marginLeft: 10,
marginRight: 20,

// بعد (React Native يدعم هذا)
marginStart: 10,
marginEnd: 20,
```

---

## 📱 اختبار RTL / Testing RTL

### 1. تشغيل التطبيق بالعربية

```bash
pnpm expo start
# التطبيق سيبدأ بالعربية (RTL) افتراضياً
```

### 2. تبديل اللغة

في التطبيق، اذهب إلى:
- Settings / الإعدادات
- Language / اللغة
- اختر English أو العربية

**ملاحظة:** يجب إعادة تحميل التطبيق بعد تغيير اللغة.

### 3. فحص RTL في المحاكي

**Android:**
```
Settings > System > Languages & input > Languages
أضف العربية وضعها في الأعلى
```

**iOS:**
```
Settings > General > Language & Region
اختر العربية
```

---

## ⚠️ مشاكل شائعة / Common Issues

### المشكلة 1: النص لا يبدأ من اليمين

**الحل:**
```typescript
// تأكد من استخدام textAlign
<Text style={{ textAlign: getTextAlign() }}>
  النص العربي
</Text>
```

### المشكلة 2: الأيقونات في الاتجاه الخاطئ

**الحل:**
```typescript
// اعكس الأيقونات في RTL
<MaterialIcons 
  name={I18nManager.isRTL ? "arrow-forward" : "arrow-back"} 
/>
```

### المشكلة 3: التطبيق لا يتحول لـ RTL

**الحل:**
```typescript
// تأكد من استدعاء forceRTL
I18nManager.forceRTL(true);
// ثم أعد تحميل التطبيق
```

### المشكلة 4: بعض العناصر لا تحترم RTL

**الحل:**
```typescript
// استخدم flexDirection: 'row-reverse' للعناصر المرنة
<View style={{ flexDirection: getFlexDirection() }}>
  {children}
</View>
```

---

## 📋 Checklist للمطورين / Developer Checklist

عند إضافة صفحة أو مكون جديد، تأكد من:

- [ ] استخدام `I18nManager.isRTL` بدلاً من `language === 'ar'`
- [ ] إضافة `textAlign: getTextAlign()` للنصوص
- [ ] استخدام `flexDirection: getFlexDirection()` للصفوف
- [ ] عكس الأيقونات (arrows, chevrons) في RTL
- [ ] استخدام `marginStart/marginEnd` بدلاً من `marginLeft/marginRight`
- [ ] اختبار الصفحة بالعربية والإنجليزية
- [ ] التأكد من أن جميع النصوص العربية تبدأ من اليمين

---

## 🚀 أفضل الممارسات / Best Practices

### 1. استخدم React Native's Built-in RTL Support

```typescript
// ✅ جيد - يدعم RTL تلقائياً
marginStart: 10,
paddingEnd: 20,

// ❌ تجنب - لا يدعم RTL
marginLeft: 10,
paddingRight: 20,
```

### 2. اختبر دائماً بكلتا اللغتين

```typescript
// اختبر كل صفحة بـ:
// 1. العربية (RTL)
// 2. الإنجليزية (LTR)
```

### 3. استخدم Helper Functions

```typescript
// بدلاً من كتابة نفس الكود في كل مكان
import { getTextAlign, getFlexDirection } from '../utils/rtl';
```

### 4. وثق الكود

```typescript
// أضف تعليقات للأماكن التي تحتاج معالجة خاصة لـ RTL
// RTL: This component needs special handling for Arabic
```

---

## 📚 موارد إضافية / Additional Resources

- [React Native I18nManager](https://reactnative.dev/docs/i18nmanager)
- [RTL Support in React Native](https://reactnative.dev/blog/2016/08/19/right-to-left-support-for-react-native-apps)
- [Expo Localization](https://docs.expo.dev/versions/latest/sdk/localization/)

---

## ✅ الخلاصة / Summary

- ✅ التطبيق يدعم RTL بشكل كامل
- ✅ اللغة الافتراضية هي العربية
- ✅ استخدم `I18nManager.isRTL` للتحقق من RTL
- ✅ استخدم helper functions من `utils/rtl.ts`
- ✅ اختبر دائماً بكلتا اللغتين

---

**آخر تحديث / Last Updated:** December 28, 2025
