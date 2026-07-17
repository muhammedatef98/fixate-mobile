# 🚀 دليل البدء السريع - تطبيق Fixate

## ⚡ البدء في 5 دقائق

### 1. التثبيت

```bash
git clone https://github.com/muhammedatef98/fixate-mobile.git
cd fixate-mobile
pnpm install
```

### 2. التشغيل

```bash
# تشغيل Expo Dev Server
pnpm start

# ستظهر QR Code - امسحها بتطبيق Expo Go
```

### 3. الاختبار على جهازك

1. **حمّل Expo Go**:
   - [Android](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - [iOS](https://apps.apple.com/app/expo-go/id982107779)

2. **امسح QR Code** من Terminal

3. **التطبيق سيفتح تلقائياً!**

---

## 📱 هيكل التطبيق

```
mobile/
├── app/                    # الصفحات (Expo Router)
│   ├── _layout.tsx        # Layout رئيسي
│   ├── index.tsx          # الصفحة الرئيسية
│   ├── request.tsx        # طلب خدمة
│   ├── calculator.tsx     # حاسبة الأسعار
│   ├── login.tsx          # تسجيل الدخول
│   ├── signup.tsx         # إنشاء حساب
│   ├── profile.tsx        # الملف الشخصي
│   └── track/[id].tsx     # تتبع الطلب
├── assets/                # الصور والأيقونات
├── app.json              # إعدادات Expo
├── eas.json              # إعدادات Build
└── package.json          # المكتبات
```

---

## 🎯 الصفحات المتوفرة

| الصفحة | المسار | الوصف |
|--------|--------|-------|
| الرئيسية | `/` | Hero + Features + Devices |
| طلب خدمة | `/request` | نموذج طلب متعدد الخطوات |
| حاسبة الأسعار | `/calculator` | حساب السعر التقديري |
| تسجيل الدخول | `/login` | تسجيل دخول المستخدم |
| إنشاء حساب | `/signup` | تسجيل مستخدم جديد |
| الملف الشخصي | `/profile` | معلومات المستخدم |
| تتبع الطلب | `/track/[id]` | تتبع حالة الطلب |

---

## 🔧 التخصيص السريع

### تغيير الألوان

عدّل `app.json`:
```json
{
  "expo": {
    "splash": {
      "backgroundColor": "#10b981"  // لونك هنا
    }
  }
}
```

### تغيير الأيقونة

استبدل الملفات في `assets/`:
- `icon.png` (512x512)
- `splash.png` (512x512)
- `adaptive-icon.png` (512x512)

### تغيير النصوص

عدّل الملفات في `app/*.tsx`

---

## 📦 البناء للإنتاج

### Android APK

```bash
# تسجيل الدخول
npx eas login

# بناء APK
npx eas build --platform android --profile production

# سيستغرق 10-20 دقيقة
# ستحصل على رابط للتحميل
```

### iOS IPA

```bash
# يتطلب Apple Developer Account
npx eas build --platform ios --profile production
```

---

## 🐛 حل المشاكل

### التطبيق لا يعمل؟

```bash
# امسح الـ cache
npx expo start -c

# أعد تثبيت المكتبات
rm -rf node_modules
pnpm install
```

### الأيقونات لا تظهر؟

تأكد من وجود الملفات في `assets/`:
```bash
ls -la assets/
```

---

## 📚 موارد مفيدة

- [Expo Documentation](https://docs.expo.dev)
- [React Native Documentation](https://reactnative.dev)
- [Expo Router](https://docs.expo.dev/router/introduction/)

---

## 🎉 الخطوات التالية

1. ✅ جرب التطبيق على جهازك
2. ✅ خصص الألوان والأيقونات
3. ✅ ابنِ APK
4. ✅ ارفع على Google Play Store
5. ✅ ارفع على App Store

**راجع `DEPLOYMENT_GUIDE_AR.md` للتفاصيل الكاملة!**

---

**بالتوفيق! 🚀**
