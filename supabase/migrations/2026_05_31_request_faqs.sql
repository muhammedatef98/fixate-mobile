-- ============================================================================
-- Request FAQs — admin-controlled chatbot content
-- ----------------------------------------------------------------------------
-- The in-app chatbot used to ship a hardcoded list of FAQs in
-- `app/chatbot.tsx`. That meant every content change (wording, new
-- question, removing an outdated answer) required a code release. This
-- migration lifts the catalogue into a DB table the admin can manage
-- from the existing /admin-request-settings screen.
--
-- Schema mirrors the in-memory shape exactly so the customer-side
-- matcher (score-based keyword lookup) keeps working unchanged after
-- swapping its data source. Critical detail: `related` stores OTHER
-- faq CODES (not UUIDs) so reordering / soft-renames don't break the
-- follow-up chip references.
--
-- The off-topic regex guard, the handoff keyword list, and the welcome
-- bubble's seeded follow-up codes deliberately stay code-side — they
-- are scope guarantees and starter UX, not content.
--
-- RLS posture is identical to request_device_types: anyone reads (the
-- customer chat needs them), only admins write. No new admin-promotion
-- path is introduced.
--
-- All clauses are idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.request_faqs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,                    -- stable join key (e.g. 'price')
  q_ar        text NOT NULL,
  q_en        text NOT NULL,
  a_ar        text NOT NULL,
  a_en        text NOT NULL,
  keywords    text[] NOT NULL DEFAULT '{}',            -- match terms, weight 1
  strong      text[] NOT NULL DEFAULT '{}',            -- match phrases, weight 3
  related     text[] NOT NULL DEFAULT '{}',            -- other faq codes (follow-up chips)
  enabled     boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 100,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS request_faqs_sort_idx
  ON public.request_faqs (sort_order);

CREATE INDEX IF NOT EXISTS request_faqs_enabled_idx
  ON public.request_faqs (enabled)
  WHERE enabled = true;

ALTER TABLE public.request_faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "request_faqs_read" ON public.request_faqs;
CREATE POLICY "request_faqs_read"
  ON public.request_faqs
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "request_faqs_admin_all" ON public.request_faqs;
CREATE POLICY "request_faqs_admin_all"
  ON public.request_faqs
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS touch_request_faqs ON public.request_faqs;
CREATE TRIGGER touch_request_faqs
  BEFORE UPDATE ON public.request_faqs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Seed the 15 FAQs currently hardcoded in app/chatbot.tsx, preserving codes.
-- ON CONFLICT (code) DO NOTHING so re-applying never overwrites admin edits.
-- Content kept byte-for-byte identical to the current hardcoded fallback so
-- the migration is a pure lift — no behavior change at first read.
-- ---------------------------------------------------------------------------
INSERT INTO public.request_faqs
  (code, q_ar, q_en, a_ar, a_en, keywords, strong, related, sort_order)
VALUES
  (
    'request',
    'كيف أطلب صيانة؟',
    'How do I request a repair?',
    'من الصفحة الرئيسية اضغط «اطلب صيانة جديدة»، اختر جهازك ونوع العطل وطريقة الخدمة، ثم أكمل الطلب. سيصلك فني معتمد لفحص الجهاز.',
    'On the home screen tap "Request a New Repair", choose your device, the issue and a service method, then submit. A verified technician will be assigned to inspect your device.',
    ARRAY['request','repair','book','order','fix','طلب','صيانة','احجز','اطلب','إصلاح','تصليح'],
    ARRAY['how do i request','how do i book','كيف أطلب','كيف احجز'],
    ARRAY['price','time','pickup','area'],
    1
  ),
  (
    'price',
    'كيف يتم تحديد السعر؟',
    'How is the price decided?',
    'الفحص مجاني. بعد فحص الفني لجهازك يرسل لك عرض سعر دقيق، وأنت تقرر قبوله أو رفضه قبل بدء أي إصلاح.',
    'Inspection is free. After the technician inspects your device they send an accurate quote — you accept or reject it before any repair starts.',
    ARRAY['price','cost','quote','how much','fee','expensive','cheap','سعر','تكلفة','كم','عرض','رسوم','كلفة'],
    ARRAY['how much','كم يكلف','كم السعر'],
    ARRAY['payment','warranty','time'],
    2
  ),
  (
    'time',
    'كم يستغرق الإصلاح؟',
    'How long does a repair take?',
    'يعتمد على نوع العطل، لكن معظم الإصلاحات تكتمل خلال ساعة إلى ٣ ساعات بعد موافقتك على عرض السعر.',
    'It depends on the issue, but most repairs are completed within 1 to 3 hours after you approve the quote.',
    ARRAY['time','long','duration','hours','wait','وقت','مدة','يستغرق','كم ساعة','متى','انتظار'],
    ARRAY['how long','كم يستغرق','كم وقت'],
    ARRAY['track','request','pickup'],
    3
  ),
  (
    'warranty',
    'ما هو الضمان؟',
    'What warranty do I get?',
    'كل إصلاح يشمل ضمان ٦ أشهر على العمل والقطع المستبدلة. إذا عاد العطل خلال الفترة، نُصلحه مجاناً.',
    'Every repair includes a 6-month warranty covering the work and any replaced parts. If the issue returns during that window we fix it for free.',
    ARRAY['warranty','guarantee','cover','broken again','ضمان','كفالة','يرجع','عاد'],
    ARRAY['warranty','ضمان'],
    ARRAY['refund','cancel','price'],
    4
  ),
  (
    'payment',
    'ما طرق الدفع المتاحة؟',
    'What payment methods are available?',
    'يمكنك الدفع نقداً عند الإتمام أو بالبطاقة. يتم الدفع فقط بعد موافقتك على عرض السعر — لا تدفع شيئاً مقابل الفحص.',
    'You can pay cash on completion or by card. Payment happens only after you approve the quote — you pay nothing for the inspection.',
    ARRAY['payment','pay','cash','card','visa','mada','apple pay','دفع','نقد','بطاقة','فيزا','مدى'],
    ARRAY['how do i pay','كيف أدفع','طرق الدفع'],
    ARRAY['price','refund','loyalty'],
    5
  ),
  (
    'area',
    'ما المناطق المغطاة؟',
    'Which areas do you cover?',
    'الخدمة متاحة حالياً في القطيف والمناطق التابعة لها (مثل سيهات وصفوى وتاروت)، ونعمل على توسيع التغطية لباقي المنطقة الشرقية قريباً.',
    'Service is currently available in Al Qatif and the areas administratively under it (Saihat, Safwa, Tarout). We are expanding coverage across the Eastern Province soon.',
    ARRAY['area','location','city','cover','coverage','qatif','dammam','khobar','منطقة','مدينة','موقع','القطيف','تغطية','سيهات','الدمام','الخبر'],
    ARRAY['where do you','do you cover','هل تغطون','متى توسع'],
    ARRAY['request','pickup','time'],
    6
  ),
  (
    'pickup',
    'هل يوجد استلام وتوصيل؟',
    'Do you offer pickup & delivery?',
    'نعم. يمكنك اختيار الاستلام والتوصيل، أو زيارة فني متنقل، أو تسليم الجهاز بنفسك في مركز الخدمة.',
    'Yes. You can choose pickup & delivery, an on-site technician visit, or drop the device off yourself at our service center.',
    ARRAY['pickup','delivery','collect','come to me','mobile','استلام','توصيل','تسليم','يجي','متنقل'],
    ARRAY['pickup and delivery','استلام وتوصيل'],
    ARRAY['area','request','time'],
    7
  ),
  (
    'track',
    'كيف أتابع حالة طلبي؟',
    'How do I track my order?',
    'افتح «طلباتي» من الصفحة الرئيسية لرؤية حالة كل طلب وتفاصيله لحظة بلحظة.',
    'Open "My Requests" from the home screen to see the live status and details of every order.',
    ARRAY['track','status','my order','where is','progress','تتبع','حالة','طلباتي','متابعة','وين طلبي'],
    ARRAY['track my order','where is my','أين طلبي'],
    ARRAY['cancel','time','request'],
    8
  ),
  (
    'cancel',
    'هل أستطيع إلغاء الطلب؟',
    'Can I cancel my order?',
    'نعم. يمكنك إلغاء الطلب قبل بدء الفني بالعمل بدون أي رسوم. بعد بدء الإصلاح قد تُطبَّق رسوم تشخيص بسيطة.',
    'Yes. You can cancel the order any time before the technician begins work — free of charge. Once the repair starts a small inspection fee may apply.',
    ARRAY['cancel','stop','abort','remove order','إلغاء','الغي','وقف'],
    ARRAY['cancel my order','إلغاء الطلب'],
    ARRAY['refund','track','warranty'],
    9
  ),
  (
    'refund',
    'كيف يتم استرداد المبلغ؟',
    'How do refunds work?',
    'إذا كنت دفعت مقدماً وأُلغي الطلب أو لم يتم الإصلاح، يُعاد المبلغ إلى نفس وسيلة الدفع خلال ٣ إلى ٧ أيام عمل.',
    'If you paid up front and the order was cancelled or the repair could not be completed, the amount is returned to your original payment method within 3 to 7 business days.',
    ARRAY['refund','money back','reimburse','استرداد','استرجاع','فلوس','ارجاع المبلغ'],
    ARRAY['get my money back','استرداد المبلغ'],
    ARRAY['cancel','payment','warranty'],
    10
  ),
  (
    'market',
    'كيف أبيع جهازاً في السوق؟',
    'How do I sell a device in the marketplace?',
    'افتح «السوق» ثم «إعلان جديد»، أضف الصور والتفاصيل والسعر. يظهر الإعلان بعد مراجعته من الفريق.',
    'Open "Marketplace", tap "New listing", add photos, details and a price. Your listing goes live after the team reviews it.',
    ARRAY['sell','marketplace','listing','market','post listing','سوق','بيع','إعلان','انشر إعلان'],
    ARRAY['sell my','post a listing','بيع جهاز'],
    ARRAY['account','support','price'],
    11
  ),
  (
    'technician',
    'كيف أصبح فنياً معكم؟',
    'How do I become a technician?',
    'سجّل كفني من شاشة اختيار الدور، أكمل بياناتك ووثائقك، وبعد اعتماد الفريق ستبدأ باستقبال الطلبات.',
    'Sign up as a technician from the role-selection screen, complete your details and documents, and once the team approves you, you can start receiving jobs.',
    ARRAY['technician','join','work','apply','become','فني','انضمام','توظيف','اعمل','وظيفة'],
    ARRAY['become a technician','انضم كفني'],
    ARRAY['support','account'],
    12
  ),
  (
    'loyalty',
    'كيف يعمل برنامج الولاء؟',
    'How does the loyalty program work?',
    'تكسب نقاطاً مع كل طلب مكتمل، ويمكنك استبدالها بخصم على إصلاح أو إكسسوار. تابع رصيد نقاطك من شاشة «الولاء».',
    'You earn points on every completed order and can redeem them for a discount on a future repair or accessory. Check your balance from the "Loyalty" screen.',
    ARRAY['loyalty','points','reward','redeem','ولاء','نقاط','مكافأة','استبدال'],
    ARRAY['loyalty','reward points','برنامج الولاء'],
    ARRAY['payment','price'],
    13
  ),
  (
    'account',
    'كيف أعدّل حسابي وعنواني؟',
    'How do I edit my profile and address?',
    'افتح «حسابي» من القائمة، ثم «تعديل الملف الشخصي» للاسم والصورة، و«عناويني» لإضافة أو تعديل عنوان.',
    'Open "Profile" from the menu, then "Edit Profile" for name and photo, or "Addresses" to add or edit an address.',
    ARRAY['profile','account','edit','name','photo','address','phone','حساب','ملف','تعديل','الاسم','صورة','عنوان','رقم'],
    ARRAY['edit my profile','change my address','تعديل ملفي'],
    ARRAY['market','support'],
    14
  ),
  (
    'support',
    'كيف أتواصل مع الدعم؟',
    'How do I contact support?',
    'اضغط على «تواصل مع الدعم» أعلى الشاشة في أي وقت — فريقنا متاح ٧ أيام في الأسبوع للرد على أسئلتك.',
    'Tap "Talk to support" at the top of this screen any time — our team is available 7 days a week to answer your questions.',
    ARRAY['support','help','contact','human','representative','agent','دعم','مساعدة','تواصل','موظف','خدمة العملاء'],
    ARRAY['talk to support','human','تكلم مع','محتاج دعم'],
    ARRAY[]::text[],
    15
  )
ON CONFLICT (code) DO NOTHING;
