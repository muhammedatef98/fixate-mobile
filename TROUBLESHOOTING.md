# Fixatee Mobile App - Troubleshooting Guide

## Issue: Updates Not Showing After Scanning QR Code

If you've pulled the latest changes from GitHub but the updates are not reflecting in the Expo Go app after scanning the QR code, follow these steps:

### Solution 1: Clear Expo Cache and Restart

```bash
# Stop the current development server (Ctrl+C)

# Clear Expo cache
npx expo start -c

# Or use pnpm
pnpm expo start -c
```

The `-c` flag clears the bundler cache and forces a fresh build.

### Solution 2: Clear Expo Go App Cache (On Your Phone)

**For iOS:**
1. Open Expo Go app
2. Shake your device to open the developer menu
3. Tap "Reload"
4. If that doesn't work, close and reopen Expo Go completely

**For Android:**
1. Open Expo Go app
2. Shake your device or press Ctrl+M (if using emulator)
3. Tap "Reload"
4. If that doesn't work, go to Settings → Apps → Expo Go → Storage → Clear Cache
5. Close and reopen Expo Go

### Solution 3: Completely Uninstall and Reinstall Expo Go

This is the most reliable solution if caching issues persist:

1. **Uninstall Expo Go** from your device completely
2. **Restart your device** (important!)
3. **Reinstall Expo Go** from App Store or Google Play
4. **Restart the development server** with cache clearing:
   ```bash
   npx expo start -c
   ```
5. **Scan the QR code** again with the fresh Expo Go installation

### Solution 4: Verify You're on the Same Network

Make sure:
- Your phone and development computer are on the **same Wi-Fi network**
- No VPN is active on either device
- Firewall isn't blocking the connection

### Solution 5: Use Tunnel Mode (If Network Issues Persist)

```bash
npx expo start --tunnel
```

This uses a tunnel connection instead of LAN, which can help with network issues.

### Solution 6: Verify Latest Code is Pulled

```bash
# Make sure you have the latest code
git pull origin master

# Verify you're on the right branch
git branch

# Check latest commits
git log --oneline -5
```

### Solution 7: Delete node_modules and Reinstall

```bash
# Remove node_modules and lock file
rm -rf node_modules pnpm-lock.yaml

# Reinstall dependencies
pnpm install

# Start with cache clearing
pnpm expo start -c
```

### Solution 8: Check for JavaScript Errors

When you scan the QR code, check the terminal for any errors. Common issues:
- Missing dependencies
- Syntax errors
- Import path errors

### Latest Commits (As of Dec 23, 2025)

The mobile app repository is up to date with these recent changes:
- ✅ 89b0bf6: Fixed AuthSessionMissingError handling
- ✅ ae7f3e3: Fixed Base64 encoding issues
- ✅ 620f70e: Added expo-file-system dependency
- ✅ 59a69a4: Added OAuth authentication (Google, Apple, Facebook)
- ✅ a308934: Added password validation and skeleton loaders
- ✅ ba5c8d7: Added technician profile page

### Still Not Working?

If none of the above solutions work:

1. **Check the GitHub repository** to confirm your latest commits are there:
   https://github.com/muhammedatef98/fixatee-mobile

2. **Try on a different device** to isolate the issue

3. **Check Expo Go version** - make sure you have the latest version from the app store

4. **Create a new Expo project** to test if Expo Go is working at all:
   ```bash
   npx create-expo-app test-app
   cd test-app
   npx expo start
   ```

### Recommended Solution for Persistent Issues

**The most reliable fix is Solution 3**: Completely uninstall Expo Go, restart your device, reinstall Expo Go, and start the dev server with cache clearing (`npx expo start -c`).

This clears all cached data on both the phone and development server, ensuring you see the latest code.

---

## Other Common Issues

### Issue: "Unable to resolve module"

**Solution:**
```bash
pnpm install
npx expo start -c
```

### Issue: "Network response timed out"

**Solution:**
- Check Wi-Fi connection
- Try tunnel mode: `npx expo start --tunnel`
- Restart router if needed

### Issue: White screen or app crashes

**Solution:**
- Check terminal for JavaScript errors
- Look for syntax errors in recently modified files
- Verify all imports are correct

---

**Need More Help?**

Check the Expo documentation: https://docs.expo.dev/troubleshooting/
