import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  /** When set, the bubble shows a "talk to support" action. */
  offerHandoff?: boolean;
  timestamp: Date;
}

/**
 * Built-in knowledge base. Each entry is matched by keyword against free
 * text, and also surfaced as a tappable quick question. Answers are kept
 * short, plain and accurate to how the app actually works.
 */
type FaqCategory =
  | 'general'
  | 'orders'
  | 'payments'
  | 'marketplace'
  | 'technician'
  | 'courier'
  | 'account'
  | 'support';

interface Faq {
  id: string;
  cat: FaqCategory;
  q_ar: string;
  q_en: string;
  a_ar: string;
  a_en: string;
  keywords: string[];
}

/** Question sections shown as collapsible groups in the quick-questions list. */
const CATEGORIES: { id: FaqCategory; ar: string; en: string; icon: string }[] = [
  { id: 'general',     ar: 'عام',                 en: 'General',          icon: 'information-outline' },
  { id: 'orders',      ar: 'الطلبات والصيانة',     en: 'Orders & Repairs', icon: 'tools' },
  { id: 'payments',    ar: 'الدفع والفواتير',      en: 'Payments & Invoices', icon: 'credit-card-outline' },
  { id: 'marketplace', ar: 'السوق',               en: 'Marketplace',      icon: 'storefront-outline' },
  { id: 'technician',  ar: 'للفنيين',             en: 'For Technicians',  icon: 'account-wrench-outline' },
  { id: 'courier',     ar: 'لمناديب التوصيل',      en: 'For Couriers',     icon: 'moped' },
  { id: 'account',     ar: 'الحساب والمحفظة',      en: 'Account & Wallet', icon: 'wallet-outline' },
  { id: 'support',     ar: 'الدعم والمساعدة',      en: 'Support & Help',   icon: 'lifebuoy' },
];

const FAQS: Faq[] = [
  // ── General ───────────────────────────────────────────────────────────
  {
    id: 'about',
    cat: 'general',
    q_ar: 'ما هو تطبيق Fixate؟',
    q_en: 'What is Fixate?',
    a_ar: 'Fixate منصة سعودية تربطك بفنيين معتمدين لصيانة أجهزتك، وتضم كذلك سوقاً لبيع وشراء الأجهزة المستعملة، ومجتمعاً خاصاً بالفنيين.',
    a_en: 'Fixate is a Saudi platform that connects you with verified technicians to repair your devices, plus a marketplace to buy and sell used devices and a community for technicians.',
    keywords: ['about', 'what is', 'fixate', 'ما هو', 'فكسيت', 'التطبيق', 'وش'],
  },
  {
    id: 'devices',
    cat: 'general',
    q_ar: 'ما الأجهزة التي تدعمها Fixate؟',
    q_en: 'Which devices does Fixate support?',
    a_ar: 'ندعم الجوّالات، اللابتوبات، الأجهزة اللوحية (التابلت)، الساعات الذكية وأجهزة الألعاب. اختر نوع جهازك عند إنشاء الطلب.',
    a_en: 'We support phones, laptops, tablets, smartwatches and gaming devices. Pick your device type when creating a request.',
    keywords: ['device', 'devices', 'support', 'phone', 'laptop', 'tablet', 'watch', 'gaming', 'أجهزة', 'جهاز', 'جوال', 'لابتوب', 'تابلت', 'ساعة', 'ألعاب', 'تدعم'],
  },
  {
    id: 'area',
    cat: 'general',
    q_ar: 'ما هي مناطق الخدمة؟',
    q_en: 'Which areas do you cover?',
    a_ar: 'نخدم مدناً في جميع مناطق المملكة الـ13. عند إنشاء طلب تختار منطقتك ومدينتك وحيّك، ويُربط الموقع بالخريطة لتحديده بدقة، والتغطية تتوسّع باستمرار.',
    a_en: 'We cover cities across all 13 regions of Saudi Arabia. When you create a request you pick your region, city and neighborhood, the location is linked to the map, and coverage keeps expanding.',
    keywords: ['area', 'areas', 'location', 'city', 'cover', 'coverage', 'region', 'منطقة', 'مناطق', 'مدينة', 'مدن', 'موقع', 'تغطية'],
  },
  {
    id: 'hours',
    cat: 'general',
    q_ar: 'هل الخدمة متاحة على مدار الساعة؟',
    q_en: 'Is the service available 24/7?',
    a_ar: 'يمكنك إرسال طلبك في أي وقت عبر التطبيق. تُنفَّذ الزيارات خلال ساعات العمل، ويصلك الفني في أقرب موعد متاح حسب منطقتك.',
    a_en: 'You can submit a request any time. Visits are carried out during working hours, and a technician reaches you at the earliest available slot for your area.',
    keywords: ['24', '24/7', 'hours', 'always', 'anytime', 'ساعة', 'الساعة', 'مدار', 'دوام', 'وقت'],
  },
  {
    id: 'account',
    cat: 'general',
    q_ar: 'كيف أنشئ حساباً أو أسجّل الدخول؟',
    q_en: 'How do I create an account or log in?',
    a_ar: 'سجّل وادخل برقم جوالك السعودي عبر رمز التحقق، أو بالبريد الإلكتروني. تبقى مسجّل الدخول بين الزيارات.',
    a_en: 'Sign up and log in with your Saudi phone number via an OTP code, or with your email. You stay signed in between visits.',
    keywords: ['account', 'login', 'log in', 'sign up', 'register', 'otp', 'حساب', 'تسجيل', 'دخول', 'تسجل', 'رمز'],
  },
  {
    id: 'notifications',
    cat: 'general',
    q_ar: 'أين أرى الإشعارات؟',
    q_en: 'Where do I see notifications?',
    a_ar: 'من أيقونة الجرس في التطبيق. تصلك إشعارات داخل التطبيق بكل تحديثات طلباتك وإعلاناتك وتفاعلات المجتمع أولاً بأول.',
    a_en: 'From the bell icon in the app. You get in-app notifications for every update to your orders, listings and community activity.',
    keywords: ['notification', 'notifications', 'bell', 'alerts', 'إشعار', 'إشعارات', 'تنبيه', 'جرس'],
  },
  {
    id: 'language',
    cat: 'general',
    q_ar: 'كيف أغيّر لغة التطبيق؟',
    q_en: 'How do I change the app language?',
    a_ar: 'من الإعدادات يمكنك التبديل بين العربية والإنجليزية في أي وقت.',
    a_en: 'From Settings you can switch between Arabic and English any time.',
    keywords: ['language', 'arabic', 'english', 'لغة', 'عربي', 'انجليزي', 'إنجليزي', 'تغيير اللغة'],
  },
  {
    id: 'data_safety',
    cat: 'general',
    q_ar: 'هل بياناتي وجهازي بأمان؟',
    q_en: 'Is my data and device safe?',
    a_ar: 'فنيونا معتمدون ومراجَعون من الإدارة. ننصح بعمل نسخة احتياطية لبياناتك قبل أي إصلاح، ونتعامل مع جهازك بسرية واحترافية.',
    a_en: 'Our technicians are verified and admin-approved. We recommend backing up your data before any repair, and we handle your device confidentially and professionally.',
    keywords: ['data', 'privacy', 'safe', 'secure', 'security', 'بيانات', 'خصوصية', 'أمان', 'امان', 'سرية', 'آمن'],
  },

  // ── Orders & Repairs ──────────────────────────────────────────────────
  {
    id: 'request',
    cat: 'orders',
    q_ar: 'كيف أطلب صيانة؟',
    q_en: 'How do I request a repair?',
    a_ar: 'من الصفحة الرئيسية اضغط «اطلب صيانة جديدة»، اختر جهازك ونوع العطل وطريقة الخدمة، ثم أكمل الطلب. يصل طلبك للفنيين المعتمدين القريبين، فيرسلون لك عروض أسعارهم وأنت تختار العرض الأنسب.',
    a_en: 'On the home screen tap "Request a New Repair", choose your device, the issue and a service method, then submit. Your request reaches nearby verified technicians who send you their offers — and you pick the one you like.',
    keywords: ['request', 'repair', 'book', 'order', 'طلب', 'صيانة', 'احجز', 'اطلب'],
  },
  {
    id: 'offers_flow',
    cat: 'orders',
    q_ar: 'كيف تعمل عروض الفنيين؟',
    q_en: 'How do technician offers work?',
    a_ar: 'بعد إرسال طلبك يستطيع أكثر من فني تقديم عرض سعر عليه. تشاهد العروض مع تقييم كل فني، وتقبل عرضاً واحداً أو ترفض ما لا يناسبك. بمجرد قبول عرض يُسند الطلب لذلك الفني وتُغلق باقي العروض تلقائياً، ثم تنتقل مباشرة لتأكيد الدفع.',
    a_en: 'After you submit a request, multiple technicians can quote on it. You see each offer with the technician\'s rating, and you accept one or decline the rest. Once you accept, the request is assigned to that technician, the other offers close automatically, and you go straight to payment confirmation.',
    keywords: ['offer', 'offers', 'bids', 'quotes', 'choose', 'عرض', 'عروض', 'اختار', 'أسعار', 'الفنيين'],
  },
  {
    id: 'price',
    cat: 'orders',
    q_ar: 'كيف يتم تحديد السعر؟',
    q_en: 'How is the price decided?',
    a_ar: 'عند إنشاء الطلب يظهر لك سعر تقديري مبدئي (وليس سعراً نهائياً). بعدها يرسل الفنيون عروض أسعارهم، والعرض الذي تقبله هو السعر النهائي المتفق عليه — لا مفاجآت ولا أسعار إضافية بعد الفحص.',
    a_en: 'When you create a request you see an initial estimated price (not a final one). Technicians then send their own offers, and the offer you accept IS the final agreed price — no surprises and no extra pricing after inspection.',
    keywords: ['price', 'cost', 'quote', 'how much', 'estimate', 'سعر', 'تكلفة', 'كم', 'عرض', 'تقديري'],
  },
  {
    id: 'quote_reject',
    cat: 'orders',
    q_ar: 'ماذا لو لم تعجبني العروض؟',
    q_en: "What if I don't like the offers?",
    a_ar: 'لا تدفع شيئاً. يمكنك رفض أي عرض لا يناسبك أو إلغاء الطلب بالكامل قبل تأكيد الدفع دون أي رسوم.',
    a_en: "You pay nothing. Decline any offer that doesn't suit you, or cancel the whole request before confirming payment — at no charge.",
    keywords: ['reject', 'refuse', 'decline', 'رفض', 'أرفض', 'لو رفضت', 'مارضيت'],
  },
  {
    id: 'time',
    cat: 'orders',
    q_ar: 'كم يستغرق الإصلاح؟',
    q_en: 'How long does a repair take?',
    a_ar: 'يعتمد على نوع العطل، لكن معظم الإصلاحات تكتمل خلال ساعة إلى 3 ساعات بعد تأكيد الدفع.',
    a_en: 'It depends on the issue, but most repairs are completed within 1 to 3 hours after you confirm payment.',
    keywords: ['time', 'long', 'duration', 'وقت', 'مدة', 'يستغرق', 'كم ساعة'],
  },
  {
    id: 'service_methods',
    cat: 'orders',
    q_ar: 'ما هي طرق تقديم الخدمة؟',
    q_en: 'What are the service options?',
    a_ar: 'ثلاث طرق: استلام وتوصيل الجهاز عبر مندوب توصيل معتمد، أو زيارة فني متنقل إلى موقعك، أو تسليم الجهاز بنفسك في مركز الخدمة. تختارها عند إنشاء الطلب.',
    a_en: 'Three options: pickup & delivery via a verified courier, an on-site technician visit, or dropping the device off yourself at the service center. You pick when creating the request.',
    keywords: ['service', 'method', 'options', 'on-site', 'visit', 'طرق', 'الخدمة', 'متنقل', 'زيارة', 'موقعي'],
  },
  {
    id: 'pickup',
    cat: 'orders',
    q_ar: 'هل يوجد استلام وتوصيل؟',
    q_en: 'Do you offer pickup & delivery?',
    a_ar: 'نعم. يمكنك اختيار استلام الجهاز من موقعك وتوصيله إليك بعد الإصلاح.',
    a_en: 'Yes. You can choose to have the device picked up from your location and delivered back after the repair.',
    keywords: ['pickup', 'delivery', 'collect', 'استلام', 'توصيل', 'تسليم'],
  },
  {
    id: 'track',
    cat: 'orders',
    q_ar: 'كيف أتابع حالة طلبي؟',
    q_en: 'How do I track my order?',
    a_ar: 'افتح «طلباتي» من الصفحة الرئيسية لرؤية حالة كل طلب وتفاصيله لحظة بلحظة، مع شريط تقدّم للمراحل.',
    a_en: 'Open "My Orders" from the home screen to see each order\'s live status, details and a progress bar of the stages.',
    keywords: ['track', 'status', 'my order', 'تتبع', 'حالة', 'طلباتي', 'متابعة'],
  },
  {
    id: 'chat_tech',
    cat: 'orders',
    q_ar: 'كيف أتواصل مع الفني؟',
    q_en: 'How do I contact the technician?',
    a_ar: 'بعد قبول طلبك تُفتح محادثة داخل الطلب تتواصل فيها مع الفني مباشرةً لتنسيق الموعد والتفاصيل.',
    a_en: 'Once your order is accepted, an in-order chat opens so you can talk to the technician directly to coordinate timing and details.',
    keywords: ['contact', 'chat', 'message', 'تواصل', 'محادثة', 'أكلم', 'رسالة', 'الفني'],
  },
  {
    id: 'reschedule',
    cat: 'orders',
    q_ar: 'هل أستطيع تغيير موعد الزيارة؟',
    q_en: 'Can I change the visit time?',
    a_ar: 'نعم، نسّق مع الفني عبر المحادثة داخل الطلب لتغيير الموعد بما يناسبك قبل وصوله.',
    a_en: 'Yes — coordinate with the technician through the in-order chat to reschedule before they arrive.',
    keywords: ['reschedule', 'change time', 'appointment', 'موعد', 'تغيير', 'أجل', 'تأجيل', 'الزيارة'],
  },
  {
    id: 'cancel',
    cat: 'orders',
    q_ar: 'هل يمكنني إلغاء الطلب؟',
    q_en: 'Can I cancel my order?',
    a_ar: 'نعم، يمكنك الإلغاء من «طلباتي» قبل بدء الإصلاح دون أي رسوم. بعد تأكيد الدفع وبدء العمل قد تُطبّق رسوم القطع المستخدمة.',
    a_en: 'Yes — cancel from "My Orders" before the repair starts at no charge. After you confirm payment and work begins, charges for used parts may apply.',
    keywords: ['cancel', 'cancellation', 'إلغاء', 'الغاء', 'ألغي', 'الغي', 'إلغ'],
  },
  {
    id: 'cannot_fix',
    cat: 'orders',
    q_ar: 'ماذا لو لم يتمكن الفني من إصلاح الجهاز؟',
    q_en: "What if the technician can't fix my device?",
    a_ar: 'لن تدفع تكلفة الإصلاح. الفحص مجاني دائماً، وإن كان العطل غير قابل للإصلاح سيوضّح لك الفني السبب والخيارات المتاحة.',
    a_en: "You won't pay any repair cost — inspection is always free. If it can't be repaired, the technician explains why and your options.",
    keywords: ['cannot', "can't", 'fail', 'unfixable', 'not fixed', 'يصلح', 'يصلحه', 'يتمكن', 'فشل', 'تعذر', 'مايصير'],
  },
  {
    id: 'warranty',
    cat: 'orders',
    q_ar: 'ما هو الضمان؟',
    q_en: 'What warranty do I get?',
    a_ar: 'كل إصلاح يشمل ضمان سنة كاملة (12 شهراً) على العمل والقطع المستبدلة.',
    a_en: 'Every repair includes a full 1-year (12-month) warranty covering the work and any replaced parts.',
    keywords: ['warranty', 'guarantee', 'ضمان', 'كفالة'],
  },
  {
    id: 'parts_genuine',
    cat: 'orders',
    q_ar: 'هل قطع الغيار أصلية؟',
    q_en: 'Are the spare parts genuine?',
    a_ar: 'نحرص على استخدام قطع غيار أصلية أو عالية الجودة، ويوضّح لك الفني نوع القطعة وسعرها ضمن عرض السعر قبل الموافقة.',
    a_en: 'We use genuine or high-quality parts, and the technician specifies the part type and price within the quote before you approve.',
    keywords: ['genuine', 'original', 'part', 'parts', 'quality', 'قطع', 'قطعة', 'أصلية', 'اصلية', 'غيار', 'جودة'],
  },
  {
    id: 'payment',
    cat: 'payments',
    q_ar: 'ما طرق الدفع المتاحة؟',
    q_en: 'What payment methods are available?',
    a_ar: 'يمكنك الدفع نقداً عند الإتمام أو بالبطاقة. يتم الدفع فقط بعد موافقتك على عرض السعر — لا تدفع شيئاً مقابل الفحص.',
    a_en: 'You can pay cash on completion or by card. Payment happens only after you approve the quote — you pay nothing for the inspection.',
    keywords: ['payment', 'pay', 'cash', 'card', 'دفع', 'نقد', 'بطاقة'],
  },
  {
    id: 'invoice',
    cat: 'payments',
    q_ar: 'هل أحصل على فاتورة؟',
    q_en: 'Do I get an invoice?',
    a_ar: 'نعم، بعد إتمام الدفع تُتاح لك فاتورة بتفاصيل الخدمة والقطع داخل تفاصيل الطلب، ويمكنك تنزيلها.',
    a_en: 'Yes — once payment is complete, a downloadable invoice with the service and parts breakdown is available in your order details.',
    keywords: ['invoice', 'receipt', 'bill', 'فاتورة', 'إيصال', 'ايصال', 'فواتير'],
  },
  {
    id: 'rate',
    cat: 'orders',
    q_ar: 'كيف أقيّم الفني؟',
    q_en: 'How do I rate the technician?',
    a_ar: 'بعد اكتمال الطلب يظهر لك خيار التقييم — امنح نجوماً واكتب ملاحظتك. تقييمك يساعدنا على رفع جودة الخدمة.',
    a_en: 'After an order is completed a rating option appears — give stars and leave a note. Your feedback helps us keep quality high.',
    keywords: ['rate', 'rating', 'review', 'stars', 'feedback', 'تقييم', 'أقيم', 'اقيم', 'نجوم', 'تقييمات'],
  },
  {
    id: 'rating_system',
    cat: 'orders',
    q_ar: 'كيف يعمل نظام تقييم الفنيين؟',
    q_en: 'How does the technician rating system work?',
    a_ar: 'بعد كل طلب مكتمل تقيّم الفني من 1 إلى 5 نجوم. يُحسب للفني متوسط تقييماته ويظهر على ملفه، ويؤثر على ترتيبه وأولويته في استلام الطلبات. التقييمات المنخفضة المتكررة تُراجَع من الإدارة.',
    a_en: 'After each completed order you rate the technician from 1 to 5 stars. Their average rating shows on their profile and affects their ranking and priority for receiving orders. Repeated low ratings are reviewed by the admin team.',
    keywords: ['rating system', 'how rating', 'average', 'stars work', 'نظام التقييم', 'كيف التقييم', 'متوسط', 'تأثير التقييم'],
  },
  {
    id: 'refund',
    cat: 'payments',
    q_ar: 'ما هي سياسة الاسترداد؟',
    q_en: 'What is the refund policy?',
    a_ar: 'إذا دفعت مقابل إصلاح ولم يتم تنفيذه، أو ظهر خلل في الإصلاح ضمن فترة الضمان (سنة كاملة)، تواصل مع الدعم لمراجعة حالتك واسترداد المبلغ أو إعادة الإصلاح مجاناً حسب الحالة. الفحص دائماً مجاني فلا استرداد عليه.',
    a_en: 'If you paid for a repair that was not performed, or a fault appears within the warranty period (a full year), contact support to review your case for a refund or a free re-repair as appropriate. Inspection is always free, so there is nothing to refund there.',
    keywords: ['refund', 'money back', 'return money', 'استرداد', 'استرجاع', 'فلوسي', 'إرجاع المبلغ'],
  },
  {
    id: 'tech_late',
    cat: 'orders',
    q_ar: 'ماذا أفعل إذا تأخر الفني؟',
    q_en: 'What if the technician is late?',
    a_ar: 'تواصل مع الفني عبر المحادثة داخل الطلب أولاً لمعرفة سبب التأخير. وإن لم يصلك رد أو استمر التأخير، تواصل مع فريق الدعم وسنعيد توجيه طلبك لفني آخر دون أي رسوم إضافية.',
    a_en: 'First message the technician through the in-order chat to check on the delay. If you get no reply or the delay continues, contact support and we will reassign your order to another technician at no extra charge.',
    keywords: ['late', 'delay', 'not arrived', 'no show', 'تأخر', 'متأخر', 'تأخير', 'ما وصل', 'لم يصل'],
  },

  // ── Marketplace ───────────────────────────────────────────────────────
  {
    id: 'market_sell',
    cat: 'marketplace',
    q_ar: 'كيف أبيع جهازاً في السوق؟',
    q_en: 'How do I sell a device in the marketplace?',
    a_ar: 'افتح «السوق» ثم «إعلان جديد»، أضف الصور والتفاصيل والسعر. يظهر إعلانك بعد مراجعته من الفريق.',
    a_en: 'Open "Marketplace", tap "New listing", add photos, details and a price. Your listing goes live after the team reviews it.',
    keywords: ['sell', 'marketplace', 'listing', 'market', 'سوق', 'بيع', 'إعلان', 'أبيع'],
  },
  {
    id: 'market_buy',
    cat: 'marketplace',
    q_ar: 'كيف أشتري من السوق؟',
    q_en: 'How do I buy from the marketplace?',
    a_ar: 'تصفّح الإعلانات أو ابحث وفلتر حسب الفئة والمدينة، افتح الإعلان، ثم تواصل مع البائع عبر المحادثة أو الاتصال أو واتساب.',
    a_en: 'Browse or search and filter by category and city, open a listing, then contact the seller via in-app chat, call or WhatsApp.',
    keywords: ['buy', 'purchase', 'شراء', 'أشتري', 'اشتري', 'شراءه'],
  },
  {
    id: 'market_review',
    cat: 'marketplace',
    q_ar: 'لماذا إعلاني «تحت المراجعة»؟',
    q_en: 'Why is my listing "under review"?',
    a_ar: 'كل إعلان يُراجَع من فريق Fixate قبل نشره للجميع، لضمان جودة السوق وحماية المستخدمين. يظهر بمجرد الموافقة.',
    a_en: 'Every listing is reviewed by the Fixate team before going public to keep the marketplace safe and high-quality. It appears once approved.',
    keywords: ['review', 'pending', 'approve', 'مراجعة', 'تحت المراجعة', 'لماذا إعلاني', 'متى يظهر'],
  },
  {
    id: 'market_report',
    cat: 'marketplace',
    q_ar: 'كيف أبلّغ عن إعلان مخالف؟',
    q_en: 'How do I report a listing?',
    a_ar: 'افتح الإعلان واضغط أيقونة العَلَم 🚩 في الأعلى، اختر سبب البلاغ وأضف تفاصيل إن أردت ثم أرسله. يراجعه الفريق.',
    a_en: 'Open the listing, tap the flag 🚩 icon at the top, choose a reason, add details if you want, and submit. The team reviews it.',
    keywords: ['report', 'flag', 'abuse', 'scam', 'بلاغ', 'إبلاغ', 'أبلغ', 'مخالف', 'احتيال'],
  },
  {
    id: 'market_favorite',
    cat: 'marketplace',
    q_ar: 'كيف أحفظ إعلاناً في المفضلة؟',
    q_en: 'How do I save a listing?',
    a_ar: 'اضغط أيقونة القلب ❤️ على الإعلان لحفظه، وتجد محفوظاتك من زر المفضلة في أعلى السوق.',
    a_en: 'Tap the heart ❤️ on a listing to save it; find your saved items from the favorites button at the top of the marketplace.',
    keywords: ['favorite', 'save', 'wishlist', 'مفضلة', 'حفظ', 'احفظ', 'المحفوظات', 'قلب'],
  },
  {
    id: 'market_sold',
    cat: 'marketplace',
    q_ar: 'كيف أعلّم إعلاني كمباع؟',
    q_en: 'How do I mark my listing as sold?',
    a_ar: 'من تفاصيل إعلانك اضغط «تم البيع»، فيُزال من نتائج التصفّح ويظهر عليه وسم «مباع».',
    a_en: 'From your listing details tap "Mark as Sold" — it\'s removed from browse results and shows a "Sold" badge.',
    keywords: ['sold', 'mark sold', 'مباع', 'تم البيع', 'بعته', 'انباع'],
  },
  {
    id: 'market_certified',
    cat: 'marketplace',
    q_ar: 'ما معنى «معتمد من Fixate»؟',
    q_en: 'What does "Fixate Certified" mean?',
    a_ar: 'وسم يظهر على إعلانات موثوقة أضافها أو اعتمدها فريق Fixate، لتشتري بثقة أكبر.',
    a_en: 'A badge on trusted listings added or certified by the Fixate team, so you can buy with extra confidence.',
    keywords: ['certified', 'official', 'معتمد', 'موثوق', 'fixate certified'],
  },

  // ── For Technicians ───────────────────────────────────────────────────
  {
    id: 'technician',
    cat: 'technician',
    q_ar: 'كيف أصبح فنياً معكم؟',
    q_en: 'How do I become a technician?',
    a_ar: 'سجّل كفني من التطبيق، أدخل بياناتك وتخصصك ومنطقتك وارفع وثائقك، ويُراجَع طلبك ويُعتمد من الإدارة.',
    a_en: 'Register as a technician in the app — enter your details, specialty and region, upload your documents, and your application is reviewed and approved by the admin team.',
    keywords: ['technician', 'join', 'work', 'apply', 'become', 'فني', 'فنياً', 'فنيا', 'انضمام', 'توظيف', 'اعمل', 'أصبح'],
  },
  {
    id: 'tech_verify',
    cat: 'technician',
    q_ar: 'كيف يتم توثيق الفني؟',
    q_en: 'How is a technician verified?',
    a_ar: 'برفع الهوية أو الإقامة والوثائق المطلوبة، ثم تراجعها الإدارة وتوافق عليها قبل استقبال الطلبات.',
    a_en: 'By uploading your national ID or Iqama and the required documents, which the admin team reviews and approves before you can take orders.',
    keywords: ['verify', 'verification', 'kyc', 'documents', 'توثيق', 'تحقق', 'هوية', 'إقامة', 'وثائق'],
  },
  {
    id: 'tech_accept',
    cat: 'technician',
    q_ar: 'كيف أحصل على الطلبات كفني؟',
    q_en: 'How do I get jobs as a technician?',
    a_ar: 'من الصفحة الرئيسية افتح «الطلبات المتاحة» وقدّم عرض سعرك على الطلب المناسب. إذا اختار العميل عرضك يُسند لك الطلب فوراً ويصلك إشعار، وتتابعه في «طلباتي». يمكنك تعديل عرضك أو سحبه ما دام الطلب مفتوحاً.',
    a_en: 'From your home screen open "Available Orders" and submit a price offer on a suitable request. If the customer picks your offer, the job is assigned to you instantly and you get a notification — track it under "My Orders". You can revise or withdraw your offer while the request is open.',
    keywords: ['accept', 'available', 'receive orders', 'offer', 'bid', 'استلم', 'الطلبات المتاحة', 'أقبل', 'استقبال', 'عرض', 'عروض'],
  },
  {
    id: 'courier_role',
    cat: 'technician',
    q_ar: 'كيف أصبح مندوب توصيل؟',
    q_en: 'How do I become a courier?',
    a_ar: 'من شاشة اختيار الدور اختر «مندوب توصيل» وسجّل حسابك، ثم أكمل بياناتك (المدينة ووسيلة التوصيل). بعد اعتماد الفريق لطلبك تبدأ باستلام مهمات نقل الأجهزة بين العملاء والفنيين.',
    a_en: 'On the role-selection screen choose "Courier" and create your account, then complete your details (city and vehicle). Once the team approves you, you start taking device-transport tasks between customers and technicians.',
    keywords: ['courier', 'delivery', 'driver', 'مندوب', 'توصيل', 'دليفري', 'سائق'],
  },
  {
    id: 'tech_availability',
    cat: 'technician',
    q_ar: 'كيف أضبط توفّري لاستقبال الطلبات؟',
    q_en: 'How do I set my availability?',
    a_ar: 'من شاشة التوفّر يمكنك تفعيل أو إيقاف استقبال الطلبات حسب وقتك، فلا تصلك طلبات وأنت غير متفرّغ.',
    a_en: 'From the availability screen you can turn receiving orders on or off based on your schedule, so you only get orders when you\'re free.',
    keywords: ['availability', 'available', 'online', 'offline', 'توفر', 'متاح', 'متفرغ', 'تشغيل', 'إيقاف'],
  },
  {
    id: 'tech_earnings',
    cat: 'technician',
    q_ar: 'كيف أرى أرباحي كفني؟',
    q_en: 'How do I see my earnings?',
    a_ar: 'من قسم «الأرباح» في حسابك تتابع أرباح طلباتك المكتملة، وتُضاف إلى محفظتك داخل التطبيق.',
    a_en: 'From the "Earnings" section in your account you track the earnings of your completed orders, added to your in-app wallet.',
    keywords: ['earnings', 'income', 'money', 'payout', 'أرباح', 'دخل', 'مكسب', 'فلوس'],
  },
  {
    id: 'tech_community',
    cat: 'technician',
    q_ar: 'ما هو مجتمع الفنيين؟',
    q_en: 'What is the technician community?',
    a_ar: 'مساحة خاصة بالفنيين لمشاركة الخبرات والأسئلة والنصائح، مع منشورات وتعليقات متداخلة وإعجابات، وتصنيفات للمواضيع.',
    a_en: 'A technician-only space to share experience, questions and tips — with posts, threaded comments, likes and topic tags.',
    keywords: ['community', 'forum', 'مجتمع', 'الفنيين', 'منشورات', 'بوستات'],
  },

  // ── Account & Wallet ──────────────────────────────────────────────────
  {
    id: 'wallet',
    cat: 'account',
    q_ar: 'ما هي المحفظة؟',
    q_en: 'What is the wallet?',
    a_ar: 'المحفظة رصيدك داخل التطبيق، تستخدمه في الدفع وتتابع معاملاتك من قسم «المحفظة» في حسابك.',
    a_en: 'The wallet is your in-app balance — use it to pay and track your transactions from the "Wallet" section in your account.',
    keywords: ['wallet', 'balance', 'محفظة', 'رصيد', 'المحفظة'],
  },
  {
    id: 'loyalty',
    cat: 'account',
    q_ar: 'ما هي نقاط الولاء؟',
    q_en: 'What are loyalty points?',
    a_ar: 'تكسب نقاط ولاء مع استخدامك للخدمات، وتستبدلها لاحقاً بمزايا وخصومات من قسم الولاء.',
    a_en: 'You earn loyalty points as you use the services and later redeem them for perks and discounts from the loyalty section.',
    keywords: ['loyalty', 'points', 'rewards', 'نقاط', 'ولاء', 'مكافآت', 'استبدال'],
  },
  {
    id: 'offers',
    cat: 'account',
    q_ar: 'أين أجد العروض وأكواد الخصم؟',
    q_en: 'Where are offers and discount codes?',
    a_ar: 'في قسم «العروض» بالتطبيق نطرح عروضاً وأكواد خصم من وقت لآخر، أدخل الكود عند الدفع للاستفادة منه.',
    a_en: 'In the "Offers" section we run offers and discount codes from time to time — enter the code at checkout to use it.',
    keywords: ['discount', 'promo', 'coupon', 'code', 'offer', 'offers', 'خصم', 'كود', 'أكواد', 'عرض', 'عروض', 'كوبون'],
  },
  {
    id: 'edit_profile',
    cat: 'account',
    q_ar: 'كيف أعدّل ملفي الشخصي؟',
    q_en: 'How do I edit my profile?',
    a_ar: 'من حسابك اضغط «تعديل الملف الشخصي» لتحديث اسمك وصورتك وبياناتك.',
    a_en: 'From your account tap "Edit Profile" to update your name, photo and details.',
    keywords: ['profile', 'edit', 'name', 'photo', 'ملف', 'تعديل', 'الملف الشخصي', 'اسمي', 'صورتي'],
  },
  {
    id: 'addresses',
    cat: 'account',
    q_ar: 'كيف أضيف أو أعدّل عناويني؟',
    q_en: 'How do I manage my addresses?',
    a_ar: 'من قسم «العناوين» في حسابك تضيف عنواناً وتربطه بالخريطة لتحديده بدقة عند الطلب.',
    a_en: 'From the "Addresses" section in your account you can add an address and pin it on the map for accurate requests.',
    keywords: ['address', 'addresses', 'location', 'عنوان', 'عناوين', 'موقع', 'خريطة'],
  },
  {
    id: 'verify_identity',
    cat: 'account',
    q_ar: 'لماذا أوثّق هويتي؟',
    q_en: 'Why verify my identity?',
    a_ar: 'التوثيق يرفع ثقة البائعين والمشترين بك في السوق ويفتح مزايا إضافية. يظهر شارة «موثّق» على حسابك بعد المراجعة.',
    a_en: 'Verification raises buyers\' and sellers\' trust in you on the marketplace and unlocks extra features — a "Verified" badge shows on your account after review.',
    keywords: ['verify', 'identity', 'verified', 'توثيق', 'هويتي', 'موثق', 'تحقق الهوية'],
  },
  {
    id: 'delete_account',
    cat: 'account',
    q_ar: 'كيف أحذف حسابي؟',
    q_en: 'How do I delete my account?',
    a_ar: 'من إعدادات الحساب اختر «حذف الحساب»، ويُعالَج طلبك وتُحذف بياناتك وفق سياسة الخصوصية.',
    a_en: 'From account settings choose "Delete Account"; your request is processed and your data removed per our privacy policy.',
    keywords: ['delete', 'remove account', 'close account', 'حذف', 'حذف الحساب', 'إغلاق الحساب', 'امسح حسابي'],
  },
  {
    id: 'notifications_settings',
    cat: 'account',
    q_ar: 'كيف أتحكّم في الإشعارات؟',
    q_en: 'How do I manage notifications?',
    a_ar: 'من إعدادات الإشعارات يمكنك التحكّم في أنواع التنبيهات التي تصلك داخل التطبيق.',
    a_en: 'From notification settings you can control which in-app alerts you receive.',
    keywords: ['notification settings', 'mute', 'manage notifications', 'إعدادات الإشعارات', 'تحكم', 'كتم'],
  },
  // ── General (added) ───────────────────────────────────────────────────
  {
    id: 'not_appliances',
    cat: 'general',
    q_ar: 'هل تصلحون الغسالات والثلاجات؟',
    q_en: 'Do you repair washing machines or fridges?',
    a_ar: 'لا. Fixate متخصصة في الأجهزة الإلكترونية الشخصية فقط: الجوّالات (آيفون وأندرويد)، اللابتوبات، أجهزة الكمبيوتر، التابلت والآيباد، والساعات الذكية. لا نقدم صيانة للأجهزة المنزلية.',
    a_en: 'No. Fixate covers personal electronics only: phones (iPhone and Android), laptops, computers, tablets and iPads, and smartwatches. We do not service home appliances.',
    keywords: ['washing', 'washer', 'fridge', 'refrigerator', 'appliance', 'oven', 'tv', 'غسالة', 'ثلاجة', 'مكيف', 'تلفزيون', 'فرن', 'أجهزة منزلية', 'منزلية'],
  },
  {
    id: 'roles',
    cat: 'general',
    q_ar: 'ما أنواع الحسابات في التطبيق؟',
    q_en: 'What account types exist in the app?',
    a_ar: 'أربعة أدوار: عميل يطلب الصيانة، فني ينفّذها، مندوب توصيل ينقل الأجهزة، وفريق الإدارة. تختار دورك عند التسجيل من شاشة اختيار الدور.',
    a_en: 'Four roles: a customer who requests repairs, a technician who performs them, a courier who transports devices, and the admin team. You pick your role on the role-selection screen when you sign up.',
    keywords: ['role', 'roles', 'account type', 'user types', 'دور', 'أدوار', 'نوع الحساب', 'مندوب', 'عميل', 'فني'],
  },
  {
    id: 'switch_role',
    cat: 'general',
    q_ar: 'هل يمكنني التسجيل كعميل وفني في نفس الوقت؟',
    q_en: 'Can I be both a customer and a technician?',
    a_ar: 'كل دور له حسابه الخاص. إن رغبت في العمل كفني أو مندوب، سجّل حساباً بذلك الدور من شاشة اختيار الدور.',
    a_en: 'Each role has its own account. If you want to work as a technician or courier, register an account with that role from the role-selection screen.',
    keywords: ['switch role', 'both', 'two accounts', 'تبديل الدور', 'حسابين', 'نفس الوقت', 'أغير دوري'],
  },
  {
    id: 'theme',
    cat: 'general',
    q_ar: 'هل يوجد وضع ليلي؟',
    q_en: 'Is there a dark mode?',
    a_ar: 'نعم. بدّل بين الوضع الفاتح والداكن من الإعدادات أو من القائمة الجانبية.',
    a_en: 'Yes. Switch between light and dark mode from Settings or the side menu.',
    keywords: ['dark', 'dark mode', 'night', 'theme', 'وضع ليلي', 'الوضع الداكن', 'ثيم', 'داكن'],
  },
  {
    id: 'offline',
    cat: 'general',
    q_ar: 'التطبيق لا يعمل أو يظهر أنه غير متصل، ماذا أفعل؟',
    q_en: 'The app says offline or is not working — what do I do?',
    a_ar: 'تأكد من اتصالك بالإنترنت؛ يظهر شريط تنبيه في أعلى الشاشة عند انقطاع الاتصال. جرّب إغلاق التطبيق وفتحه من جديد. إن استمرت المشكلة تواصل مع فريق الدعم.',
    a_en: 'Check your internet connection — a banner appears at the top of the screen when you go offline. Try closing and reopening the app. If it persists, contact the support team.',
    keywords: ['offline', 'not working', 'crash', 'bug', 'error', 'لا يعمل', 'غير متصل', 'مشكلة', 'خلل', 'يتوقف'],
  },

  // ── Orders & Repairs (added) ──────────────────────────────────────────
  {
    id: 'estimate_vs_final',
    cat: 'orders',
    q_ar: 'ما الفرق بين السعر التقديري وسعر العرض؟',
    q_en: 'Estimated price vs. offer price — what is the difference?',
    a_ar: 'السعر التقديري رقم إرشادي يظهر لك عند إنشاء الطلب بناءً على نوع الجهاز والعطل. العرض هو السعر الفعلي الذي يقدّمه فني معيّن، وهو الذي يصبح السعر النهائي بمجرد قبولك له.',
    a_en: 'The estimate is a guide figure shown when you create the request, based on the device and the fault. An offer is an actual price from a specific technician — and it becomes the final price the moment you accept it.',
    keywords: ['estimate', 'estimated', 'difference', 'تقديري', 'الفرق', 'السعر التقديري', 'تقدير'],
  },
  {
    id: 'request_expired',
    cat: 'orders',
    q_ar: 'لماذا انتهت مهلة طلبي؟',
    q_en: 'Why did my request expire?',
    a_ar: 'الطلب المفتوح الذي لا يتلقى عرضاً مقبولاً خلال المهلة المحددة تنتهي صلاحيته تلقائياً ويظهر بحالة «انتهت المهلة»، حتى لا يبقى معلّقاً بلا نهاية. يمكنك ببساطة إنشاء طلب جديد.',
    a_en: 'An open request that never gets an accepted offer within its window expires automatically and shows as "Expired", so it does not hang around forever. You can simply create a new request.',
    keywords: ['expire', 'expired', 'timeout', 'انتهت', 'المهلة', 'منتهي', 'انتهاء الطلب'],
  },
  {
    id: 'no_offers',
    cat: 'orders',
    q_ar: 'لم يصلني أي عرض على طلبي، لماذا؟',
    q_en: 'I got no offers on my request — why?',
    a_ar: 'قد لا يتوفر فني مناسب في منطقتك في تلك اللحظة، أو أن وصف العطل غير واضح. جرّب إضافة صور وتفاصيل أدق للعطل وأعد إرسال الطلب. إن تكرر الأمر تواصل مع فريق الدعم لمساعدتك.',
    a_en: 'There may be no matching technician free in your area right now, or the fault description was unclear. Add photos and a sharper description and submit again. If it keeps happening, contact support and we will help.',
    keywords: ['no offer', 'no offers', 'nobody', 'ما وصلني', 'لا يوجد عروض', 'مافي عروض', 'ما جاني عرض'],
  },
  {
    id: 'add_photos',
    cat: 'orders',
    q_ar: 'هل أرفق صوراً للعطل؟',
    q_en: 'Should I attach photos of the fault?',
    a_ar: 'نعم، ننصح بذلك بشدة. الصور تساعد الفني على تقدير العطل بدقة وتقديم عرض سعر أقرب للواقع. أضفها عند إنشاء الطلب.',
    a_en: 'Yes — strongly recommended. Photos help the technician judge the fault accurately and quote a realistic price. Add them when creating the request.',
    keywords: ['photo', 'photos', 'picture', 'image', 'attach', 'صور', 'صورة', 'أرفق', 'إرفاق'],
  },
  {
    id: 'service_center',
    cat: 'orders',
    q_ar: 'أين مركز الخدمة؟ وكيف أسلّم جهازي بنفسي؟',
    q_en: 'Where is the service center and how do I drop my device off?',
    a_ar: 'إذا اخترت «تسليم في مركز الخدمة» عند إنشاء الطلب، تظهر لك بطاقة المركز داخل تفاصيل الطلب بعنوانه وبيانات التواصل، وتسلّم جهازك هناك مباشرة.',
    a_en: 'If you choose "Drop off at the service center" when creating the request, a center card appears inside your order details with its address and contact details — you hand the device in there.',
    keywords: ['center', 'centre', 'branch', 'drop off', 'مركز', 'الفرع', 'المركز', 'أسلم بنفسي', 'تسليم'],
  },
  {
    id: 'spare_parts_wait',
    cat: 'orders',
    q_ar: 'لماذا حالة طلبي «بانتظار قطع الغيار»؟',
    q_en: 'Why is my order "waiting for parts"?',
    a_ar: 'يعني أن الفني طلب قطعة غيار مطلوبة لإصلاح جهازك وينتظر توفّرها. يستأنف العمل فور وصول القطعة، ويصلك إشعار بكل تغيّر في الحالة.',
    a_en: 'It means the technician has ordered a spare part your repair needs and is waiting for it to arrive. Work resumes as soon as it does, and you get a notification on every status change.',
    keywords: ['waiting parts', 'spare', 'part', 'قطع الغيار', 'بانتظار', 'قطعة', 'ننتظر'],
  },
  {
    id: 'status_log',
    cat: 'orders',
    q_ar: 'ما هو سجل حالة الطلب؟',
    q_en: 'What is the order status log?',
    a_ar: 'سجل زمني داخل تفاصيل الطلب يعرض كل تغيّر في الحالة، ومن قام به، ومتى. أثناء تنفيذ الطلب يظهر السجل كاملاً؛ وبعد اكتماله يُعرض مختصراً مع زر «عرض المزيد» لفتحه بالكامل.',
    a_en: 'A time-ordered log inside your order details showing every status change, who made it and when. While the order is active the full log is shown; once it is completed it is summarised, with a "View more" button to expand it.',
    keywords: ['log', 'history', 'timeline', 'سجل', 'الحالة', 'تاريخ الطلب', 'عرض المزيد'],
  },
  {
    id: 'live_tracking',
    cat: 'orders',
    q_ar: 'هل أستطيع تتبّع المندوب على الخريطة؟',
    q_en: 'Can I track the courier on a map?',
    a_ar: 'نعم. عند وجود مهمة استلام أو تسليم جارية، تفتح شاشة التتبّع من الطلب وتشاهد موقع المندوب على الخريطة لحظياً.',
    a_en: 'Yes. When a pickup or delivery leg is in progress, open the tracking screen from your order to see the courier live on the map.',
    keywords: ['map', 'live', 'gps', 'tracking', 'خريطة', 'تتبع المندوب', 'موقع المندوب', 'مباشر'],
  },
  {
    id: 'device_safe',
    cat: 'orders',
    q_ar: 'هل جهازي مؤمَّن أثناء النقل؟',
    q_en: 'Is my device protected during transport?',
    a_ar: 'المناديب معتمدون وموثّقة هوياتهم، وكل مرحلة نقل مسجّلة في سجل الطلب مع الوقت. إذا حدث أي ضرر أثناء النقل تواصل مع فريق الدعم فوراً لفتح بلاغ.',
    a_en: 'Couriers are vetted and identity-verified, and every transport leg is recorded in the order log with its timestamp. If any damage happens in transit, contact support immediately to open a case.',
    keywords: ['damage', 'insurance', 'lost', 'broken transit', 'تلف', 'ضرر', 'ضاع', 'أثناء النقل', 'تأمين'],
  },
  {
    id: 'complaint',
    cat: 'orders',
    q_ar: 'كيف أقدّم شكوى على الخدمة؟',
    q_en: 'How do I file a complaint?',
    a_ar: 'افتح محادثة الدعم من التطبيق واشرح المشكلة مع رقم الطلب. يراجع الفريق حالتك ويردّ عليك، ويمكنه إعادة توجيه الطلب أو معالجة الاسترداد حسب الحالة.',
    a_en: 'Open the support chat in the app and describe the problem with your order number. The team reviews your case and replies — they can reassign the order or handle a refund as appropriate.',
    keywords: ['complaint', 'complain', 'unhappy', 'bad service', 'شكوى', 'أشتكي', 'خدمة سيئة', 'زعلان'],
  },

  // ── Payments & Invoices (added) ───────────────────────────────────────
  {
    id: 'when_pay',
    cat: 'payments',
    q_ar: 'متى أدفع بالضبط؟',
    q_en: 'When exactly do I pay?',
    a_ar: 'بعد قبولك لعرض الفني ينتقل الطلب إلى «بانتظار الدفع» وتؤكد الدفع لتبدأ الصيانة. لا تدفع شيئاً قبل ذلك، والفحص مجاني.',
    a_en: 'After you accept a technician\'s offer the order moves to "Awaiting payment" and you confirm payment so the repair can start. You pay nothing before that, and inspection is free.',
    keywords: ['when pay', 'awaiting payment', 'متى أدفع', 'بانتظار الدفع', 'الدفع متى', 'أدفع'],
  },
  {
    id: 'pay_wallet',
    cat: 'payments',
    q_ar: 'هل أستطيع الدفع من رصيد المحفظة؟',
    q_en: 'Can I pay from my wallet balance?',
    a_ar: 'نعم، إذا كان في محفظتك رصيد كافٍ يمكنك استخدامه عند تأكيد الدفع، أو الدفع بالبطاقة أو نقداً حسب الخيارات المتاحة لطلبك.',
    a_en: 'Yes — if your wallet has enough balance you can use it at payment confirmation, or pay by card or cash depending on the options offered for your order.',
    keywords: ['wallet pay', 'balance pay', 'أدفع من المحفظة', 'رصيدي', 'الدفع بالرصيد'],
  },
  {
    id: 'discount_code',
    cat: 'payments',
    q_ar: 'كيف أستخدم كود الخصم؟',
    q_en: 'How do I use a discount code?',
    a_ar: 'أدخل الكود في خانة كود الخصم عند شاشة الدفع، ويُطبّق الخصم مباشرة على الإجمالي قبل التأكيد.',
    a_en: 'Enter it in the discount-code field on the payment screen — the discount applies to the total straight away, before you confirm.',
    keywords: ['coupon', 'promo code', 'discount code', 'كود خصم', 'كوبون', 'أدخل الكود', 'كود'],
  },
  {
    id: 'commitment_amount',
    cat: 'payments',
    q_ar: 'ما هو مبلغ التأكيد (العربون)؟',
    q_en: 'What is the confirmation amount (deposit)?',
    a_ar: 'مبلغ صغير يُدفع عند تأكيد الطلب لضمان جدّيته، ويُخصم بالكامل من الفاتورة النهائية — أي أنه ليس رسماً إضافياً.',
    a_en: 'A small amount paid when you confirm the order to show it is serious. It is deducted in full from the final bill — it is not an extra charge.',
    keywords: ['deposit', 'commitment', 'confirmation amount', 'عربون', 'مبلغ التأكيد', 'التأكيد'],
  },
  {
    id: 'inspection_fee',
    cat: 'payments',
    q_ar: 'هل هناك رسوم فحص؟',
    q_en: 'Is there an inspection fee?',
    a_ar: 'الفحص مجاني في الحالة الاعتيادية. إن وُجدت رسوم فحص لحالتك فستظهر بوضوح في ملخص التكلفة قبل التأكيد — لا رسوم مخفية.',
    a_en: 'Inspection is normally free. If an inspection fee applies to your case it is shown clearly in the cost summary before you confirm — there are no hidden fees.',
    keywords: ['inspection', 'diagnostic fee', 'رسوم الفحص', 'الفحص', 'مجاني'],
  },
  {
    id: 'delivery_fee',
    cat: 'payments',
    q_ar: 'كم رسوم التوصيل؟',
    q_en: 'How much is the delivery fee?',
    a_ar: 'تُحسب رسوم التوصيل حسب طريقة الخدمة ومنطقتك، وتظهر في ملخص التكلفة قبل تأكيد الطلب، وقد تكون مجانية ضمن بعض العروض.',
    a_en: 'The delivery fee depends on the service method and your area. It is shown in the cost summary before you confirm the order, and may be free under some offers.',
    keywords: ['delivery fee', 'shipping', 'رسوم التوصيل', 'التوصيل كم', 'أجرة التوصيل'],
  },
  {
    id: 'currency',
    cat: 'payments',
    q_ar: 'ما العملة المستخدمة؟',
    q_en: 'What currency do you use?',
    a_ar: 'جميع الأسعار بالريال السعودي، وتظهر برمز الريال الجديد في كل شاشات التطبيق.',
    a_en: 'All prices are in Saudi Riyal, shown with the new riyal symbol across the app.',
    keywords: ['currency', 'riyal', 'sar', 'عملة', 'ريال', 'العملة', 'الريال'],
  },

  // ── Marketplace (added) ───────────────────────────────────────────────
  {
    id: 'market_edit',
    cat: 'marketplace',
    q_ar: 'كيف أعدّل أو أحذف إعلاني؟',
    q_en: 'How do I edit or delete my listing?',
    a_ar: 'من «إعلاناتي» افتح الإعلان وعدّل تفاصيله أو احذفه. أي تعديل جوهري قد يُعيد الإعلان لمرحلة المراجعة قبل ظهوره.',
    a_en: 'From "My listings" open the listing to edit its details or delete it. A substantial edit may send it back for review before it goes live again.',
    keywords: ['edit listing', 'delete listing', 'تعديل إعلان', 'حذف إعلان', 'إعلاناتي', 'أعدل'],
  },
  {
    id: 'market_rejected',
    cat: 'marketplace',
    q_ar: 'لماذا رُفض إعلاني؟',
    q_en: 'Why was my listing rejected?',
    a_ar: 'الأسباب الشائعة: صور غير واضحة، وصف ناقص أو مضلل، سعر غير منطقي، أو مخالفة لشروط السوق. عدّل الإعلان وأعد إرساله، أو تواصل مع الدعم لمعرفة السبب الدقيق.',
    a_en: 'Common reasons: unclear photos, an incomplete or misleading description, an unrealistic price, or a breach of the marketplace rules. Fix the listing and resubmit, or contact support for the exact reason.',
    keywords: ['rejected listing', 'declined', 'refused', 'رُفض', 'رفض إعلاني', 'مرفوض'],
  },
  {
    id: 'market_chat',
    cat: 'marketplace',
    q_ar: 'كيف أتواصل مع البائع أو المشتري؟',
    q_en: 'How do I contact the seller or buyer?',
    a_ar: 'من صفحة الإعلان اضغط زر المحادثة لفتح دردشة داخل التطبيق مع الطرف الآخر، وتجد كل محادثاتك في «رسائل السوق».',
    a_en: 'From the listing page tap the chat button to open an in-app conversation with the other party — all your threads live under "Marketplace messages".',
    keywords: ['seller', 'buyer', 'contact seller', 'بائع', 'مشتري', 'أكلم البائع', 'رسائل السوق'],
  },
  {
    id: 'market_safety',
    cat: 'marketplace',
    q_ar: 'كيف أشتري بأمان من السوق؟',
    q_en: 'How do I buy safely on the marketplace?',
    a_ar: 'تعامل مع الحسابات الموثّقة، افحص الجهاز قبل الدفع، قابل البائع في مكان عام، ولا ترسل أي مبلغ قبل استلام الجهاز. أبلغ عن أي إعلان مشبوه من أيقونة العَلَم.',
    a_en: 'Prefer verified accounts, inspect the device before paying, meet in a public place, and never send money before you receive the device. Report anything suspicious with the flag icon.',
    keywords: ['safe', 'safety', 'scam', 'fraud', 'أمان', 'احتيال', 'نصب', 'آمن', 'أشتري بأمان'],
  },

  // ── For Technicians (added) ───────────────────────────────────────────
  {
    id: 'tech_changes_requested',
    cat: 'technician',
    q_ar: 'حسابي كفني بحالة «مطلوب تعديل»، ماذا يعني؟',
    q_en: 'My technician account says "changes requested" — what now?',
    a_ar: 'يعني أن الإدارة راجعت طلبك وتحتاج تعديلاً أو وثيقة أوضح قبل الاعتماد. يظهر لك سبب الطلب في ملاحظات التوثيق — عدّل ما هو مطلوب وأعد الإرسال، ولا حاجة لإنشاء حساب جديد.',
    a_en: 'It means the admin team reviewed your application and needs a correction or a clearer document before approving. The reason appears in your verification notes — fix what is asked and resubmit; you do not need a new account.',
    keywords: ['changes requested', 'resubmit', 'مطلوب تعديل', 'تعديل الطلب', 'مراجعة حسابي', 'ملاحظات التوثيق'],
  },
  {
    id: 'tech_rejected',
    cat: 'technician',
    q_ar: 'لماذا رُفض طلب انضمامي كفني؟',
    q_en: 'Why was my technician application rejected?',
    a_ar: 'يُرفض الطلب عادة لوثائق غير صالحة أو غير مكتملة أو لعدم استيفاء شروط التخصص. يظهر سبب الرفض في حسابك، ويمكنك التواصل مع الدعم لمراجعة الحالة.',
    a_en: 'Applications are usually rejected for invalid or incomplete documents, or for not meeting the specialty requirements. The reason shows on your account, and you can contact support to have the case reviewed.',
    keywords: ['rejected technician', 'refused application', 'رفض طلبي', 'رُفض انضمامي', 'مرفوض فني'],
  },
  {
    id: 'tech_edit_offer',
    cat: 'technician',
    q_ar: 'هل أستطيع تعديل أو سحب عرضي؟',
    q_en: 'Can I edit or withdraw my offer?',
    a_ar: 'نعم، ما دام الطلب مفتوحاً ولم يقبل العميل عرضاً بعد. بعد قبول عرضك يُسند الطلب إليك ولا يمكن تعديل السعر من طرف واحد.',
    a_en: 'Yes, as long as the request is still open and the customer has not accepted an offer. Once your offer is accepted the job is assigned to you and the price cannot be changed unilaterally.',
    keywords: ['edit offer', 'withdraw', 'cancel offer', 'تعديل عرضي', 'سحب العرض', 'أعدل السعر'],
  },
  {
    id: 'tech_offer_rejected',
    cat: 'technician',
    q_ar: 'العميل رفض عرضي، هل أقدّم عرضاً آخر؟',
    q_en: 'The customer declined my offer — can I send another?',
    a_ar: 'نعم. ما دام الطلب مفتوحاً يمكنك تقديم عرض جديد بسعر مختلف، ويظهر لك أن عرضك السابق قد رُفض.',
    a_en: 'Yes. While the request is still open you can submit a new offer at a different price — you will see that your previous offer was declined.',
    keywords: ['offer rejected', 'declined offer', 'رفض عرضي', 'عرض جديد', 'رفض العميل'],
  },
  {
    id: 'tech_spare_parts',
    cat: 'technician',
    q_ar: 'كيف أطلب قطعة غيار لطلب قيد التنفيذ؟',
    q_en: 'How do I request a spare part for an active job?',
    a_ar: 'من شاشة إدارة الطلب اطلب قطعة الغيار المطلوبة وحدّد بياناتها وتكلفتها. تتحوّل حالة الطلب إلى «بانتظار قطع الغيار» ويُخطر العميل، وتُحتسب تكلفة القطعة ضمن حسابك.',
    a_en: 'From the manage-order screen request the part you need with its details and cost. The order moves to "Waiting for parts", the customer is notified, and the part cost is accounted for in your earnings.',
    keywords: ['spare part', 'order part', 'supplier', 'قطعة غيار', 'أطلب قطعة', 'موردين', 'القطع'],
  },
  {
    id: 'tech_withdraw',
    cat: 'technician',
    q_ar: 'كيف أسحب أرباحي من المحفظة؟',
    q_en: 'How do I withdraw my earnings?',
    a_ar: 'من شاشة الأرباح اطلب سحب رصيد محفظتك. يُرسل الطلب للإدارة ويتم التحويل عادة خلال 1-3 أيام عمل.',
    a_en: 'From the Earnings screen request a withdrawal of your wallet balance. The request goes to the admin team and the transfer usually completes within 1–3 business days.',
    keywords: ['withdraw', 'payout', 'cash out', 'سحب', 'أسحب أرباحي', 'تحويل', 'سحب الرصيد'],
  },
  {
    id: 'tech_commission',
    cat: 'technician',
    q_ar: 'كم عمولة المنصة على كل طلب؟',
    q_en: 'What commission does the platform take?',
    a_ar: 'تُحسم عمولة المنصة من قيمة الطلب المكتمل، ويظهر لك صافي أرباحك عن كل طلب في شاشة الأرباح. تُحدَّد نسبة العمولة من الإدارة وتُطبّق على جميع الفنيين.',
    a_en: 'A platform commission is deducted from each completed order, and your net earnings per order are shown in the Earnings screen. The rate is set by the admin team and applies to all technicians.',
    keywords: ['commission', 'cut', 'percentage', 'عمولة', 'نسبة المنصة', 'خصم المنصة'],
  },
  {
    id: 'tech_complete',
    cat: 'technician',
    q_ar: 'كيف أغلق الطلب بعد انتهاء الإصلاح؟',
    q_en: 'How do I close a job after finishing the repair?',
    a_ar: 'من شاشة إدارة الطلب انقل الحالة خطوة بخطوة حتى «مكتمل». يظهر كل تغيير في سجل الطلب لدى العميل، ويُطلب منه تقييمك بعد الإغلاق.',
    a_en: 'From the manage-order screen move the status forward step by step until "Completed". Every change appears in the customer\'s order log, and they are asked to rate you once it closes.',
    keywords: ['complete', 'finish', 'close job', 'إغلاق الطلب', 'إنهاء', 'مكتمل', 'أنهي'],
  },

  // ── For Couriers ──────────────────────────────────────────────────────
  {
    id: 'courier_tasks',
    cat: 'courier',
    q_ar: 'كيف أستلم مهام التوصيل؟',
    q_en: 'How do I receive delivery tasks?',
    a_ar: 'بعد اعتماد حسابك، تظهر المهام المتاحة في منطقتك في شاشة «مهامي». تقبل المهمة وتنفّذ خطواتها: استلام الجهاز من العميل وتسليمه للفني، ثم إعادته بعد الإصلاح.',
    a_en: 'Once your account is approved, tasks available in your area show up under "My tasks". Accept one and work through its steps: collect the device from the customer, hand it to the technician, then return it after the repair.',
    keywords: ['task', 'tasks', 'delivery job', 'مهام', 'مهمة', 'مهامي', 'أستلم مهمة'],
  },
  {
    id: 'courier_fee',
    cat: 'courier',
    q_ar: 'كيف تُحسب أجرة المندوب؟',
    q_en: 'How is the courier fee calculated?',
    a_ar: 'تُحسب أجرة كل مهمة حسب المسافة والمنطقة، وتظهر لك قبل قبول المهمة. تتجمّع أجورك في محفظتك وتراها في ملفك الشخصي.',
    a_en: 'Each task\'s fee is based on distance and area, and it is shown to you before you accept. Your fees accumulate in your wallet and appear in your profile.',
    keywords: ['courier fee', 'earn', 'pay per task', 'أجرة', 'أجور', 'كم أستلم', 'أرباح المندوب'],
  },
  {
    id: 'courier_docs',
    cat: 'courier',
    q_ar: 'ما الوثائق المطلوبة لاعتماد المندوب؟',
    q_en: 'What documents does a courier need?',
    a_ar: 'الهوية أو الإقامة سارية المفعول، وبيانات وسيلة التوصيل. ترفعها من شاشة التوثيق وتراجعها الإدارة قبل تفعيل حسابك.',
    a_en: 'A valid national ID or Iqama, plus your vehicle details. Upload them on the verification screen; the admin team reviews them before your account is activated.',
    keywords: ['courier documents', 'verify courier', 'وثائق المندوب', 'توثيق المندوب', 'هوية المندوب'],
  },
  {
    id: 'courier_chat',
    cat: 'courier',
    q_ar: 'كيف أتواصل مع العميل أو الفني أثناء المهمة؟',
    q_en: 'How do I contact the customer or technician during a task?',
    a_ar: 'من داخل المهمة تفتح محادثة مباشرة مع الطرف الآخر، ويظهر لك رقم التواصل عند الحاجة لتنسيق التسليم.',
    a_en: 'From inside the task you can open a direct chat with the other party, and the contact number is shown when you need it to coordinate the handover.',
    keywords: ['courier chat', 'call customer', 'محادثة المندوب', 'أتواصل مع العميل', 'رقم العميل'],
  },

  // ── Account & Wallet (added) ──────────────────────────────────────────
  {
    id: 'otp_not_received',
    cat: 'account',
    q_ar: 'لم يصلني رمز التحقق (OTP)، ماذا أفعل؟',
    q_en: "I didn't receive the OTP code — what do I do?",
    a_ar: 'تأكد من رقم الجوال ومن تغطية الشبكة، وانتظر قليلاً ثم اطلب إعادة الإرسال. إن لم يصل بعد عدة محاولات، جرّب تسجيل الدخول بالبريد الإلكتروني أو تواصل مع الدعم.',
    a_en: 'Check the number and your signal, wait a moment, then request a resend. If it still does not arrive after a few tries, sign in with email instead or contact support.',
    keywords: ['otp', 'code', 'sms', 'verification code', 'رمز', 'الرمز', 'لم يصل', 'ما وصلني رمز', 'كود التحقق'],
  },
  {
    id: 'forgot_password',
    cat: 'account',
    q_ar: 'نسيت كلمة المرور',
    q_en: 'I forgot my password',
    a_ar: 'من شاشة الدخول بالبريد الإلكتروني اضغط «نسيت كلمة المرور» ويصلك رابط إعادة التعيين على بريدك.',
    a_en: 'On the email sign-in screen tap "Forgot password" and a reset link is sent to your email.',
    keywords: ['password', 'forgot', 'reset', 'كلمة المرور', 'نسيت', 'استعادة', 'الباسورد'],
  },
  {
    id: 'blocked_account',
    cat: 'account',
    q_ar: 'حسابي محظور، ماذا أفعل؟',
    q_en: 'My account is blocked — what should I do?',
    a_ar: 'يُحظر الحساب عند مخالفة شروط الاستخدام. تواصل مع فريق الدعم لمراجعة حالتك ومعرفة سبب الحظر وإمكانية رفعه.',
    a_en: 'Accounts are blocked for breaching the terms of use. Contact the support team to have your case reviewed, learn the reason and whether it can be lifted.',
    keywords: ['blocked', 'banned', 'suspended', 'محظور', 'حظر', 'موقوف', 'معلق'],
  },
  {
    id: 'wallet_topup',
    cat: 'account',
    q_ar: 'كيف أشحن رصيد محفظتي؟',
    q_en: 'How do I top up my wallet?',
    a_ar: 'شحن الرصيد يدوياً قيد التفعيل حالياً. يتغذّى رصيد محفظتك من المبالغ المستردة والمكافآت، وتتابع كل حركة في شاشة المحفظة.',
    a_en: 'Manual top-up is not enabled yet. Your wallet balance is fed by refunds and rewards, and you can follow every transaction on the Wallet screen.',
    keywords: ['top up', 'add funds', 'recharge', 'شحن الرصيد', 'إضافة رصيد', 'أشحن'],
  },
  {
    id: 'loyalty_redeem',
    cat: 'account',
    q_ar: 'كيف أستبدل نقاط الولاء؟',
    q_en: 'How do I redeem loyalty points?',
    a_ar: 'من قسم الولاء تشاهد رصيد نقاطك وقيمتها، وتستبدلها بخصم على طلباتك حسب المتاح. تُضاف النقاط تلقائياً بعد كل طلب مكتمل.',
    a_en: 'In the Loyalty section you see your points balance and its value, and can redeem it as a discount on your orders where available. Points are added automatically after each completed order.',
    keywords: ['redeem', 'points', 'loyalty', 'استبدال', 'نقاطي', 'أستبدل', 'مكافأة'],
  },
  {
    id: 'notif_prefs',
    cat: 'account',
    q_ar: 'كيف أوقف نوعاً معيناً من الإشعارات؟',
    q_en: 'How do I turn off a specific type of notification?',
    a_ar: 'من إعدادات الإشعارات فعّل أو أوقف كل نوع على حدة (تحديثات الطلبات، السوق، العروض...). الإشعارات المهمة عن طلباتك الجارية تبقى مفعّلة لحمايتك من تفويت تحديث.',
    a_en: 'In notification settings you can switch each type on or off individually (order updates, marketplace, offers…). Critical alerts about your active orders stay on so you never miss an update.',
    keywords: ['turn off notifications', 'mute', 'إيقاف الإشعارات', 'أوقف الإشعارات', 'كتم'],
  },
  {
    id: 'change_phone',
    cat: 'account',
    q_ar: 'كيف أغيّر رقم جوالي أو بريدي؟',
    q_en: 'How do I change my phone number or email?',
    a_ar: 'حدّث بياناتك من «تعديل الملف الشخصي». إن لم تستطع الوصول لرقمك القديم، تواصل مع فريق الدعم لمساعدتك في تحديثه.',
    a_en: 'Update your details from "Edit profile". If you no longer have access to your old number, contact the support team and they will help you update it.',
    keywords: ['change phone', 'change email', 'تغيير الرقم', 'تغيير البريد', 'رقمي الجديد'],
  },
  {
    id: 'data_deleted',
    cat: 'account',
    q_ar: 'ماذا يحدث لبياناتي بعد حذف الحساب؟',
    q_en: 'What happens to my data after I delete my account?',
    a_ar: 'تُحذف بياناتك الشخصية وفق سياسة الخصوصية، مع الاحتفاظ بالسجلات التي يفرض النظام حفظها (كسجلات الفواتير). الحذف نهائي ولا يمكن التراجع عنه.',
    a_en: 'Your personal data is removed per the privacy policy, except records we are legally required to keep (such as invoice records). Deletion is permanent and cannot be undone.',
    keywords: ['data after delete', 'privacy delete', 'بياناتي بعد الحذف', 'حذف بياناتي', 'نهائي'],
  },

  // ── Support & Help ────────────────────────────────────────────────────
  {
    id: 'contact_support',
    cat: 'support',
    q_ar: 'كيف أتواصل مع فريق الدعم؟',
    q_en: 'How do I contact the support team?',
    a_ar: 'اضغط «التحدث مع فريق الدعم» في هذه الشاشة، أو افتح «الدعم» من القائمة، وتبدأ محادثة مباشرة مع الفريق داخل التطبيق.',
    a_en: 'Tap "Talk to the support team" on this screen, or open "Support" from the menu, and you start a direct in-app conversation with the team.',
    keywords: ['contact', 'support', 'help', 'agent', 'human', 'تواصل', 'الدعم', 'مساعدة', 'موظف', 'خدمة العملاء'],
  },
  {
    id: 'support_hours',
    cat: 'support',
    q_ar: 'متى يرد فريق الدعم؟',
    q_en: 'How fast does support reply?',
    a_ar: 'يرد الفريق خلال ساعات العمل بأسرع وقت ممكن. اترك رسالتك في محادثة الدعم ويصلك الرد داخل التطبيق مع إشعار.',
    a_en: 'The team replies during working hours as quickly as they can. Leave your message in the support chat and you get the reply in-app with a notification.',
    keywords: ['reply', 'response time', 'how long support', 'متى يرد', 'وقت الرد', 'كم يستغرق الرد'],
  },
  {
    id: 'support_closed',
    cat: 'support',
    q_ar: 'لماذا أُغلقت محادثة الدعم؟',
    q_en: 'Why was my support chat closed?',
    a_ar: 'تُغلق المحادثة تلقائياً بعد فترة من عدم النشاط بعد حل المشكلة. يمكنك دائماً فتح محادثة جديدة إن احتجت لمزيد من المساعدة.',
    a_en: 'A conversation closes automatically after a period of inactivity once the issue is resolved. You can always open a new one if you need more help.',
    keywords: ['closed chat', 'support closed', 'أُغلقت', 'أغلقت المحادثة', 'سكرت'],
  },
];

const HANDOFF_KEYWORDS = [
  'human', 'agent', 'support', 'representative', 'person', 'help me',
  'موظف', 'دعم', 'خدمة العملاء', 'شخص', 'مساعدة',
];

export default function ChatbotScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = makeStyles(COLORS, isRTL);
  const scrollViewRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: isRTL
        ? 'مرحباً! أنا مساعد Fixate الذكي. اسألني عن الطلبات، الأسعار والدفع، الضمان، التوصيل، السوق، أو حسابك — سواء كنت عميلاً أو فنياً أو مندوب توصيل. وإن لم تكن لدي الإجابة سأحوّلك لفريق الدعم.'
        : "Hi! I'm the Fixate assistant. Ask me about orders, pricing and payment, warranty, delivery, the marketplace or your account — whether you're a customer, a technician or a courier. If I don't have the answer, I'll hand you to our support team.",
      isBot: true,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  // FEAT-03 — the quick questions stay visible & tappable the whole session.
  // Track the last-tapped one to highlight it.
  const [activeFaqId, setActiveFaqId] = useState<string | null>(null);
  // Collapsible question sections — 'general' open by default so the list
  // shows useful content immediately without overwhelming the screen.
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(['general']));
  const toggleCat = (id: string) =>
    setOpenCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  useEffect(() => {
    const t = setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(t);
  }, [messages]);

  // Token-boundary keyword match. The old logic used naive `includes`, which
  // matched substrings across word boundaries — e.g. "مع‌كم" (with you) hit
  // the price FAQ's "كم" keyword, so "كيف أصبح فنياً معكم؟" returned the
  // wrong (pricing) answer. We now tokenize the message and require a token
  // to *equal or start with* the keyword (single words), or match the whole
  // phrase (multi-word keywords). The FAQ with the most hits wins.
  const matchFaq = (msg: string): Faq | null => {
    const tokens = msg.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    let best: Faq | null = null;
    let bestScore = 0;
    for (const f of FAQS) {
      let score = 0;
      for (const raw of f.keywords) {
        const k = raw.toLowerCase();
        const hit = k.includes(' ')
          ? msg.includes(k)
          : tokens.some((t) => t === k || (k.length >= 3 && t.startsWith(k)));
        if (hit) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
    return bestScore > 0 ? best : null;
  };

  const findAnswer = (raw: string): { text: string; offerHandoff: boolean } => {
    const msg = raw.toLowerCase().trim();
    if (HANDOFF_KEYWORDS.some((k) => msg.includes(k))) {
      return {
        text: isRTL
          ? 'بالتأكيد — يمكنني تحويلك إلى فريق الدعم للرد عليك مباشرة.'
          : 'Of course — I can connect you with our support team for direct help.',
        offerHandoff: true,
      };
    }
    // Answer from the app's own knowledge base first.
    const hit = matchFaq(msg);
    if (hit) {
      return { text: isRTL ? hit.a_ar : hit.a_en, offerHandoff: false };
    }
    // Nothing matched → say so plainly and hand off. NEVER improvise an answer:
    // a confident guess about a price, a policy or a warranty is worse than no
    // answer at all, because the customer will act on it.
    return {
      text: isRTL
        ? 'لا تتوفر لدي إجابة عن هذا السؤال، ولا أريد أن أخمّن. تواصل مع فريق الدعم وسيجيبك مباشرة — أو أعد صياغة سؤالك واختر من الأقسام أعلاه.'
        : "I don't have an answer for that, and I won't guess. Please contact our support team — they'll answer you directly. You can also rephrase your question or pick one from the sections above.",
      offerHandoff: true,
    };
  };

  const pushBot = (text: string, offerHandoff: boolean) => {
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-bot`, text, isBot: true, offerHandoff, timestamp: new Date() },
    ]);
  };

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-user`, text: trimmed, isBot: false, timestamp: new Date() },
    ]);
    setInputText('');
    setTimeout(() => {
      const { text: answer, offerHandoff } = findAnswer(trimmed);
      pushBot(answer, offerHandoff);
    }, 600);
  };

  const goToSupport = () => router.push('/support-chat');

  // Tapping a quick question highlights it and answers — and the list stays
  // open so the user can immediately tap another (FEAT-03).
  const handleQuickQuestion = (f: Faq) => {
    setActiveFaqId(f.id);
    // Answer directly from the tapped FAQ instead of round-tripping through
    // keyword matching — guarantees the right answer for the exact question.
    const question = isRTL ? f.q_ar : f.q_en;
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-user`, text: question, isBot: false, timestamp: new Date() },
    ]);
    setTimeout(() => pushBot(isRTL ? f.a_ar : f.a_en, false), 500);
  };

  // Single message bubble (+ optional "talk to support" action). Shared so the
  // greeting, the quick-questions panel and the live conversation can be laid
  // out in the right order (greeting → questions → answers at the bottom).
  const renderMessage = (m: Message) => (
    <View key={m.id} style={{ width: '100%' }}>
      <View style={[styles.bubble, m.isBot ? styles.botBubble : styles.userBubble]}>
        <Text style={[styles.bubbleText, { color: m.isBot ? COLORS.text : '#fff' }]}>
          {m.text}
        </Text>
      </View>
      {m.offerHandoff && (
        <TouchableOpacity style={styles.handoffBtn} onPress={goToSupport} activeOpacity={0.85}>
          <Ionicons name="headset" size={16} color="#fff" />
          <Text style={styles.handoffBtnText}>
            {isRTL ? 'التحدث مع فريق الدعم' : 'Talk to the support team'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // 'padding' on BOTH platforms: with SDK 54's always-on edge-to-edge,
        // Android's adjustResize no longer lifts the composer by itself, so
        // relying on it (behavior undefined) left the input covered by the
        // keyboard.
        behavior="padding"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safeBack('/contact')} style={styles.headerBtn}>
            <RTLIonicon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>
              {isRTL ? 'مساعد Fixate' : 'Fixate Assistant'}
            </Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>{isRTL ? 'متصل الآن' : 'Online now'}</Text>
            </View>
          </View>
          {/* Support shortcut removed — human handoff appears inline only when
              the bot can't answer (out-of-scope question). */}
          <View style={styles.headerBtn} />
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messages}
          contentContainerStyle={{ padding: SPACING.md }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Greeting first. */}
          {messages.length > 0 && renderMessage(messages[0])}

          {/* Quick questions — grouped into collapsible sections. Tap a
              section header to expand it, then tap any question to get its
              answer instantly. The list stays open so you can ask several.
              It sits ABOVE the live conversation so a tapped question's answer
              is appended below it and scrollToEnd brings the answer into view
              (instead of the answer being hidden above this panel). */}
          <View style={styles.quickWrap}>
            <Text style={styles.quickHint}>
              {isRTL ? 'اختر سؤالاً من الأقسام:' : 'Pick a question by section:'}
            </Text>
            {CATEGORIES.map((cat) => {
              const catFaqs = FAQS.filter((f) => f.cat === cat.id);
              if (catFaqs.length === 0) return null;
              const open = openCats.has(cat.id);
              return (
                <View key={cat.id} style={styles.catBlock}>
                  <TouchableOpacity
                    style={styles.catHeader}
                    onPress={() => toggleCat(cat.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                  >
                    <View style={styles.catHeaderLeft}>
                      <MaterialCommunityIcons name={cat.icon as any} size={18} color={COLORS.primary} />
                      <Text style={styles.catTitle}>{isRTL ? cat.ar : cat.en}</Text>
                      <View style={styles.catCount}>
                        <Text style={styles.catCountText}>{catFaqs.length}</Text>
                      </View>
                    </View>
                    <Ionicons
                      name={open ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={COLORS.textSecondary}
                    />
                  </TouchableOpacity>

                  {open &&
                    catFaqs.map((f) => {
                      const active = activeFaqId === f.id;
                      return (
                        <TouchableOpacity
                          key={f.id}
                          style={[
                            styles.quickChip,
                            active && { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '14' },
                          ]}
                          onPress={() => handleQuickQuestion(f)}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                        >
                          <MaterialCommunityIcons
                            name={active ? 'message-question' : 'message-question-outline'}
                            size={16}
                            color={COLORS.primary}
                          />
                          <Text
                            style={[styles.quickChipText, active && { color: COLORS.primary, fontWeight: '800' }]}
                          >
                            {isRTL ? f.q_ar : f.q_en}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                </View>
              );
            })}
          </View>

          {/* Live conversation — questions you tap or type, and the bot's
              answers, appear here BELOW the quick-questions panel so each new
              answer lands at the bottom and scrolls into view. */}
          {messages.slice(1).map(renderMessage)}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={isRTL ? 'اكتب سؤالك…' : 'Type your question…'}
            placeholderTextColor={COLORS.textSecondary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { opacity: inputText.trim() ? 1 : 0.5 }]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim()}
          >
            <RTLIonicon name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: C.primary,
      paddingHorizontal: SPACING.md,
      paddingVertical: 14,
    },
    headerBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
    headerInfo: { flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' },
    headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
    onlineRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 5, marginTop: 2 },
    onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
    onlineText: { fontSize: 11, color: '#ffffffcc' },
    messages: { flex: 1 },
    bubble: {
      maxWidth: '82%',
      padding: 12,
      borderRadius: 16,
      marginBottom: 8,
    },
    botBubble: {
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      backgroundColor: C.card,
      borderBottomLeftRadius: isRTL ? 16 : 4,
      borderBottomRightRadius: isRTL ? 4 : 16,
    },
    userBubble: {
      alignSelf: isRTL ? 'flex-start' : 'flex-end',
      backgroundColor: C.primary,
      borderBottomRightRadius: isRTL ? 16 : 4,
      borderBottomLeftRadius: isRTL ? 4 : 16,
    },
    bubbleText: { fontSize: 14, lineHeight: 21, textAlign: isRTL ? 'right' : 'left' },
    handoffBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.primary,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      marginBottom: 12,
    },
    handoffBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    quickWrap: { marginTop: 8, gap: 8 },
    catBlock: { gap: 8 },
    catHeader: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 11,
      marginTop: 4,
    },
    catHeaderLeft: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
    },
    catTitle: { fontSize: 14, fontWeight: '800', color: C.text },
    catCount: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      backgroundColor: C.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    catCountText: { fontSize: 11, fontWeight: '800', color: C.primary },
    quickHint: {
      fontSize: 12,
      fontWeight: '700',
      color: C.textSecondary,
      textAlign: isRTL ? 'right' : 'left',
      marginBottom: 2,
    },
    quickChip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    quickChipText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
      color: C.text,
      textAlign: isRTL ? 'right' : 'left',
    },
    inputBar: {
      // Send button always on the RIGHT (user preference), in both languages.
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      padding: 10,
      paddingBottom: Platform.OS === 'ios' ? 24 : 12,
      backgroundColor: C.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    input: {
      flex: 1,
      maxHeight: 110,
      minHeight: 44,
      backgroundColor: C.background,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 14,
      paddingTop: 11,
      paddingBottom: 11,
      fontSize: 14,
      color: C.text,
      textAlign: isRTL ? 'right' : 'left',
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
