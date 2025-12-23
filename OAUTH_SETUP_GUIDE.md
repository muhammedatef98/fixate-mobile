# 🔐 دليل إعداد OAuth - Fixatee Mobile App

## ✅ تم إنجازه

الكود الكامل للـ OAuth تم إضافته في التطبيق! الآن تحتاج فقط لتفعيل الـ Providers في Supabase Dashboard.

---

## 📋 الخطوات المطلوبة

### 1️⃣ افتح Supabase Dashboard

1. اذهب إلى: https://supabase.com/dashboard
2. اختر مشروعك (Fixatee)
3. من القائمة الجانبية، اختر **Authentication** → **Providers**

---

### 2️⃣ تفعيل Google OAuth

#### أ. إنشاء Google OAuth App:

1. اذهب إلى: https://console.cloud.google.com/
2. أنشئ مشروع جديد أو اختر مشروع موجود
3. من القائمة الجانبية: **APIs & Services** → **Credentials**
4. اضغط **Create Credentials** → **OAuth 2.0 Client ID**
5. اختر **Application type**: **Web application**
6. أضف **Authorized redirect URIs**:
   ```
   https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
   ```
   (استبدل `[YOUR-PROJECT-REF]` بـ project reference من Supabase)

7. احفظ **Client ID** و **Client Secret**

#### ب. تفعيل في Supabase:

1. في Supabase Dashboard → **Authentication** → **Providers**
2. اضغط على **Google**
3. فعّل **Enable Sign in with Google**
4. الصق **Client ID** و **Client Secret**
5. احفظ التغييرات

---

### 3️⃣ تفعيل Apple OAuth

#### أ. إنشاء Apple OAuth:

1. اذهب إلى: https://developer.apple.com/account/
2. من القائمة: **Certificates, Identifiers & Profiles**
3. اختر **Identifiers** → اضغط **+** لإنشاء جديد
4. اختر **App IDs** → اضغط **Continue**
5. اختر **App** → اضغط **Continue**
6. املأ البيانات:
   - **Description**: Fixatee Mobile
   - **Bundle ID**: com.fixatee.mobile (أو Bundle ID الخاص بك)
7. فعّل **Sign in with Apple**
8. احفظ

#### ب. إنشاء Service ID:

1. ارجع لـ **Identifiers** → اضغط **+**
2. اختر **Services IDs** → اضغط **Continue**
3. املأ البيانات:
   - **Description**: Fixatee Mobile Auth
   - **Identifier**: com.fixatee.mobile.auth
4. فعّل **Sign in with Apple**
5. اضغط **Configure**
6. أضف **Return URLs**:
   ```
   https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
   ```
7. احفظ

#### ج. إنشاء Key:

1. اذهب إلى **Keys** → اضغط **+**
2. املأ:
   - **Key Name**: Fixatee Auth Key
   - فعّل **Sign in with Apple**
3. اضغط **Configure** → اختر **Primary App ID**
4. احفظ واحفظ الـ **Key ID** و **Download** الملف `.p8`

#### د. تفعيل في Supabase:

1. في Supabase Dashboard → **Authentication** → **Providers**
2. اضغط على **Apple**
3. فعّل **Enable Sign in with Apple**
4. املأ:
   - **Services ID**: com.fixatee.mobile.auth
   - **Team ID**: (من Apple Developer Account)
   - **Key ID**: (من الخطوة السابقة)
   - **Private Key**: (محتوى ملف .p8)
5. احفظ التغييرات

---

### 4️⃣ تفعيل Facebook OAuth

#### أ. إنشاء Facebook App:

1. اذهب إلى: https://developers.facebook.com/
2. اضغط **My Apps** → **Create App**
3. اختر **Consumer** → اضغط **Next**
4. املأ البيانات:
   - **App Name**: Fixatee
   - **App Contact Email**: your-email@example.com
5. اضغط **Create App**
6. من Dashboard، اختر **Add Product** → **Facebook Login** → **Set Up**
7. اختر **Settings** من القائمة الجانبية
8. أضف **Valid OAuth Redirect URIs**:
   ```
   https://[YOUR-PROJECT-REF].supabase.co/auth/v1/callback
   ```
9. احفظ التغييرات
10. من **Settings** → **Basic**، احفظ **App ID** و **App Secret**

#### ب. تفعيل في Supabase:

1. في Supabase Dashboard → **Authentication** → **Providers**
2. اضغط على **Facebook**
3. فعّل **Enable Sign in with Facebook**
4. الصق **App ID** و **App Secret**
5. احفظ التغييرات

---

## 🎯 بعد الإعداد

### اختبار OAuth:

1. شغّل التطبيق:
   ```bash
   cd fixatee-mobile
   pnpm start
   ```

2. اذهب لصفحة تسجيل الدخول أو إنشاء الحساب

3. اضغط على أي زر من أزرار OAuth (Google, Apple, Facebook)

4. يجب أن يفتح متصفح ويطلب منك تسجيل الدخول

5. بعد التسجيل، سيتم إرجاعك للتطبيق تلقائياً

---

## 📝 ملاحظات مهمة

### للإنتاج (Production):

1. **Google**: تأكد من إضافة التطبيق للـ OAuth consent screen
2. **Apple**: تأكد من نشر التطبيق على App Store
3. **Facebook**: غيّر الـ App Mode من **Development** إلى **Live**

### للتطوير (Development):

- يمكنك استخدام OAuth في وضع التطوير مباشرة
- تأكد من إضافة حسابك كـ Test User في كل Platform

---

## 🔍 استكشاف الأخطاء

### الخطأ: "Invalid redirect URI"
**الحل:** تأكد من إضافة الـ Redirect URI الصحيح في كل Platform

### الخطأ: "Client ID not found"
**الحل:** تأكد من نسخ الـ Client ID و Secret بشكل صحيح

### الخطأ: "OAuth provider not enabled"
**الحل:** تأكد من تفعيل الـ Provider في Supabase Dashboard

---

## 📚 مصادر إضافية

- [Supabase OAuth Docs](https://supabase.com/docs/guides/auth/social-login)
- [Google OAuth Setup](https://developers.google.com/identity/protocols/oauth2)
- [Apple Sign In](https://developer.apple.com/sign-in-with-apple/)
- [Facebook Login](https://developers.facebook.com/docs/facebook-login/)

---

## ✅ الكود الموجود في التطبيق

### في `app/login.tsx`:
```typescript
const handleGoogleLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });
  if (error) Alert.alert('خطأ', error.message);
};

const handleAppleLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
  });
  if (error) Alert.alert('خطأ', error.message);
};

const handleFacebookLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
  });
  if (error) Alert.alert('خطأ', error.message);
};
```

### في `app/signup.tsx`:
نفس الكود موجود في أزرار OAuth

---

**كل شيء جاهز! فقط اتبع الخطوات أعلاه وسيعمل OAuth بشكل كامل! 🎉**
