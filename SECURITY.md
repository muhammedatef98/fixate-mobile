# Security Guidelines for Fixate App

## 🔐 Current Security Status

### ✅ Good Practices Implemented:
1. **Supabase Anon Key**: Using public anon key (safe for client-side)
2. **Row Level Security (RLS)**: Should be enabled on Supabase tables
3. **Authentication**: Using Supabase Auth with secure token management
4. **Storage**: Using AsyncStorage for secure session persistence
5. **HTTPS**: All API calls go through HTTPS (Supabase)
6. **Gitignore**: Sensitive files (.env, keystore) are ignored

### ⚠️ Security Recommendations:

#### 1. Environment Variables
**Current**: API keys are hardcoded in `lib/supabase.ts`
**Recommendation**: Move to environment variables

```typescript
// lib/supabase.ts
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
```

Create `.env` file:
```
EXPO_PUBLIC_SUPABASE_URL=https://gpucisjxecupcyosumgy.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 2. Row Level Security (RLS)
**Must verify on Supabase Dashboard**:
- Enable RLS on all tables
- Users can only read/write their own data
- Technicians can only update orders assigned to them
- Public read access only for services table

Example RLS policies:
```sql
-- Orders table
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = technician_id);

CREATE POLICY "Users can create own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Technicians can update assigned orders"
  ON orders FOR UPDATE
  USING (auth.uid() = technician_id);
```

#### 3. Input Validation
**Recommendation**: Add validation for all user inputs
- Phone numbers: Saudi format (+966XXXXXXXXX)
- Email: Valid email format
- Prices: Positive numbers only
- Addresses: Non-empty strings
- File uploads: Size limits, type validation

#### 4. Rate Limiting
**Recommendation**: Implement rate limiting for:
- Login attempts (prevent brute force)
- Order creation (prevent spam)
- Image uploads (prevent abuse)

#### 5. Data Encryption
**Current**: Data in transit encrypted (HTTPS)
**Recommendation**: 
- Sensitive data at rest should be encrypted
- Use Supabase's built-in encryption
- Consider encrypting user addresses before storage

#### 6. File Upload Security
**Current**: Direct upload to Supabase Storage
**Recommendations**:
- Validate file types (images only)
- Limit file sizes (max 5MB)
- Scan for malware (if possible)
- Generate unique filenames to prevent overwriting

```typescript
const validateImage = (uri: string): boolean => {
  const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  // Add validation logic
  return true;
};
```

#### 7. API Key Rotation
**Recommendation**: 
- Rotate Supabase keys periodically
- Use different keys for dev/staging/production
- Never commit keys to Git

#### 8. User Data Privacy
**GDPR/Saudi Compliance**:
- Allow users to delete their account
- Provide data export functionality
- Clear privacy policy (already done ✅)
- Cookie consent (if using web)

#### 9. Secure Communication
**Current**: Using HTTPS ✅
**Additional**:
- Implement certificate pinning (advanced)
- Validate SSL certificates

#### 10. Error Handling
**Current**: Basic error handling
**Recommendation**: 
- Don't expose sensitive info in error messages
- Log errors securely (not to console in production)
- Use error boundary (already implemented ✅)

---

## 🔒 Before Production Checklist:

- [ ] Move API keys to environment variables
- [ ] Verify RLS policies on Supabase
- [ ] Add input validation everywhere
- [ ] Implement rate limiting
- [ ] Test file upload security
- [ ] Review and update privacy policy
- [ ] Add account deletion feature
- [ ] Test authentication flows
- [ ] Verify HTTPS everywhere
- [ ] Remove console.log statements
- [ ] Enable ProGuard/R8 for Android
- [ ] Test on multiple devices
- [ ] Penetration testing (if possible)

---

## 📱 Android-Specific Security:

### APK Signing
- Use secure keystore
- Store keystore password securely (not in Git)
- Use separate keys for debug/release

### ProGuard/R8
Enable code obfuscation in `app.json`:
```json
{
  "android": {
    "enableProguardInReleaseBuilds": true,
    "enableShrinkResourcesInReleaseBuilds": true
  }
}
```

### Network Security Config
Add to prevent cleartext traffic:
```xml
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
</network-security-config>
```

---

## 🚨 Incident Response:

If security breach occurs:
1. Immediately rotate all API keys
2. Force logout all users
3. Investigate breach scope
4. Notify affected users (if required by law)
5. Patch vulnerability
6. Document incident

---

## 📞 Security Contacts:

- **Developer**: fixate01@gmail.com
- **Supabase Support**: https://supabase.com/support
- **Google Play Support**: https://support.google.com/googleplay/android-developer

---

**Last Updated**: December 2024
**Review Frequency**: Quarterly
