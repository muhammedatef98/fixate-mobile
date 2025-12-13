# Firebase Push Notifications Setup

## ✅ What's Already Done:

1. ✅ Firebase project created (`fixate`)
2. ✅ Android app added to Firebase
3. ✅ `google-services.json` downloaded and added to project
4. ✅ Firebase SDK installed in the app
5. ✅ Available requests screen created for technicians
6. ✅ Accept/reject functionality implemented
7. ✅ Real-time updates when new orders arrive

---

## 🔧 What You Need to Do:

### Step 1: Get Firebase Server Key

1. Go to Firebase Console: https://console.firebase.google.com/project/fixate/settings/cloudmessaging
2. Scroll down to **"Cloud Messaging API (Legacy)"**
3. Copy the **Server key**
4. Save it somewhere safe

### Step 2: Enable Cloud Messaging API

1. Go to: https://console.cloud.google.com/apis/library/fcm.googleapis.com?project=fixate
2. Click **"Enable"**
3. Wait for it to activate

### Step 3: Send Notifications (Two Options)

#### Option A: Manual Testing (Quick & Easy)

When a new order comes in, you can manually send notifications to technicians using this curl command:

```bash
curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Authorization: key=YOUR_SERVER_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "/topics/technicians",
    "notification": {
      "title": "🔔 طلب جديد متاح!",
      "body": "iPhone 15 - شاشة مكسورة",
      "sound": "default"
    },
    "data": {
      "orderId": "123",
      "type": "new_order"
    }
  }'
```

#### Option B: Automatic (Recommended for Production)

Deploy the Supabase Edge Function to automatically notify technicians:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref gpucisjxecupcyosumgy

# Deploy the function
supabase functions deploy notify-technicians
```

Then create a Database Trigger in Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION notify_technicians_on_new_order()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://gpucisjxecupcyosumgy.supabase.co/functions/v1/notify-technicians',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := json_build_object(
      'orderId', NEW.id,
      'orderData', row_to_json(NEW)
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_order_created
AFTER INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_technicians_on_new_order();
```

---

## 📱 How It Works:

### For Customers:
1. Customer creates a new repair request
2. Email notification sent to fixate01@gmail.com ✅ (Already working!)
3. Order saved to database ✅

### For Technicians:
1. All technicians receive push notification on their phones 📱
2. They open the app and see the request in "Available Requests"
3. First technician to accept gets the job
4. Other technicians see the request disappear
5. Customer gets notified that a technician accepted

---

## 🧪 Testing:

1. **Install the app** on an Android device (not emulator for push notifications)
2. **Login as a technician**
3. **Grant notification permissions** when prompted
4. **Create a test order** from another account
5. **Check if notification appears** on the technician's device

---

## 🚨 Troubleshooting:

### Notifications not working?
- Make sure you enabled Cloud Messaging API
- Check that the app has notification permissions
- Verify the Firebase Server Key is correct
- Test with a real device (not emulator)

### Real-time updates not working?
- Check internet connection
- Verify Supabase connection
- Check browser console for errors

---

## 📚 Next Steps:

1. Get Firebase Server Key from console
2. Test manual notifications first
3. Deploy automatic Edge Function
4. Create database trigger
5. Test end-to-end flow

---

**Need help?** Check the Firebase documentation or ask for assistance!
