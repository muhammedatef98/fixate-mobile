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
type FaqCategory = 'general' | 'orders' | 'marketplace' | 'technician' | 'account';

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
  { id: 'general',     ar: 'عام',                 en: 'General',      icon: 'information-outline' },
  { id: 'orders',      ar: 'الطلبات والصيانة',     en: 'Orders & Repairs', icon: 'tools' },
  { id: 'marketplace', ar: 'السوق',               en: 'Marketplace',  icon: 'storefront-outline' },
  { id: 'technician',  ar: 'للفنيين',             en: 'For Technicians', icon: 'account-wrench-outline' },
  { id: 'account',     ar: 'الحساب والمحفظة',      en: 'Account & Wallet', icon: 'wallet-outline' },
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
    a_ar: 'من الصفحة الرئيسية اضغط «اطلب صيانة جديدة»، اختر جهازك ونوع العطل وطريقة الخدمة، ثم أكمل الطلب. سيصلك فني معتمد لفحص الجهاز.',
    a_en: 'On the home screen tap "Request a New Repair", choose your device, the issue and a service method, then submit. A verified technician will be assigned to inspect your device.',
    keywords: ['request', 'repair', 'book', 'order', 'طلب', 'صيانة', 'احجز', 'اطلب'],
  },
  {
    id: 'price',
    cat: 'orders',
    q_ar: 'كيف يتم تحديد السعر؟',
    q_en: 'How is the price decided?',
    a_ar: 'الفحص مجاني. بعد فحص الفني لجهازك يرسل لك عرض سعر دقيق، وأنت تقرر قبوله أو رفضه قبل بدء أي إصلاح.',
    a_en: 'Inspection is free. After the technician inspects your device they send an accurate quote — you accept or reject it before any repair starts.',
    keywords: ['price', 'cost', 'quote', 'how much', 'سعر', 'تكلفة', 'كم', 'عرض'],
  },
  {
    id: 'quote_reject',
    cat: 'orders',
    q_ar: 'ماذا لو رفضت عرض السعر؟',
    q_en: 'What if I reject the quote?',
    a_ar: 'لا تدفع شيئاً. الفحص مجاني، وإذا رفضت العرض يُغلق الطلب دون أي رسوم.',
    a_en: 'You pay nothing. Inspection is free, and if you reject the quote the order is closed at no charge.',
    keywords: ['reject', 'refuse', 'decline', 'رفض', 'أرفض', 'لو رفضت', 'مارضيت'],
  },
  {
    id: 'time',
    cat: 'orders',
    q_ar: 'كم يستغرق الإصلاح؟',
    q_en: 'How long does a repair take?',
    a_ar: 'يعتمد على نوع العطل، لكن معظم الإصلاحات تكتمل خلال ساعة إلى ٣ ساعات بعد موافقتك على عرض السعر.',
    a_en: 'It depends on the issue, but most repairs are completed within 1 to 3 hours after you approve the quote.',
    keywords: ['time', 'long', 'duration', 'وقت', 'مدة', 'يستغرق', 'كم ساعة'],
  },
  {
    id: 'service_methods',
    cat: 'orders',
    q_ar: 'ما هي طرق تقديم الخدمة؟',
    q_en: 'What are the service options?',
    a_ar: 'ثلاث طرق: استلام وتوصيل الجهاز، أو زيارة فني متنقل إلى موقعك، أو تسليم الجهاز بنفسك في مركز الخدمة. تختارها عند إنشاء الطلب.',
    a_en: 'Three options: pickup & delivery, an on-site technician visit, or dropping the device off yourself at the service center. You pick when creating the request.',
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
    a_ar: 'نعم، يمكنك الإلغاء من «طلباتي» قبل بدء الإصلاح دون أي رسوم. بعد الموافقة على عرض السعر وبدء العمل قد تُطبّق رسوم القطع المستخدمة.',
    a_en: 'Yes — cancel from "My Orders" before the repair starts at no charge. After you approve a quote and work begins, charges for used parts may apply.',
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
    cat: 'orders',
    q_ar: 'ما طرق الدفع المتاحة؟',
    q_en: 'What payment methods are available?',
    a_ar: 'يمكنك الدفع نقداً عند الإتمام أو بالبطاقة. يتم الدفع فقط بعد موافقتك على عرض السعر — لا تدفع شيئاً مقابل الفحص.',
    a_en: 'You can pay cash on completion or by card. Payment happens only after you approve the quote — you pay nothing for the inspection.',
    keywords: ['payment', 'pay', 'cash', 'card', 'دفع', 'نقد', 'بطاقة'],
  },
  {
    id: 'invoice',
    cat: 'orders',
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
    a_ar: 'بعد كل طلب مكتمل تقيّم الفني من ١ إلى ٥ نجوم. يُحسب للفني متوسط تقييماته ويظهر على ملفه، ويؤثر على ترتيبه وأولويته في استلام الطلبات. التقييمات المنخفضة المتكررة تُراجَع من الإدارة.',
    a_en: 'After each completed order you rate the technician from 1 to 5 stars. Their average rating shows on their profile and affects their ranking and priority for receiving orders. Repeated low ratings are reviewed by the admin team.',
    keywords: ['rating system', 'how rating', 'average', 'stars work', 'نظام التقييم', 'كيف التقييم', 'متوسط', 'تأثير التقييم'],
  },
  {
    id: 'refund',
    cat: 'orders',
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
    q_ar: 'كيف أستلم الطلبات كفني؟',
    q_en: 'How do I receive orders as a technician?',
    a_ar: 'من الصفحة الرئيسية افتح «الطلبات المتاحة»، واقبل الطلب المناسب لتبدأ العمل وتتابعه في «طلباتي».',
    a_en: 'From your home screen open "Available Orders" and accept a suitable one to start, then track it under "My Orders".',
    keywords: ['accept', 'available', 'receive orders', 'استلم', 'الطلبات المتاحة', 'أقبل', 'استقبال'],
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
        ? 'مرحباً! أنا مساعد Fixate الذكي. اسألني عن الأسعار، الضمان، التوصيل أو أي شيء آخر — أو اطلب التحدث مع فريق الدعم.'
        : "Hi! I'm the Fixate assistant. Ask me about pricing, warranty, delivery or anything else — or ask to talk to our support team.",
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
    const hit = matchFaq(msg);
    if (hit) {
      return { text: isRTL ? hit.a_ar : hit.a_en, offerHandoff: false };
    }
    return {
      text: isRTL
        ? 'لم أتمكن من فهم سؤالك تماماً. يمكنك إعادة صياغته، أو التحدث مباشرة مع فريق الدعم.'
        : "I couldn't quite answer that. Try rephrasing, or talk directly with our support team.",
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          <TouchableOpacity onPress={goToSupport} style={styles.headerBtn} accessibilityLabel={isRTL ? 'الدعم' : 'Support'}>
            <Ionicons name="headset" size={22} color="#fff" />
          </TouchableOpacity>
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

        {/* Persistent transfer-to-support strip */}
        <TouchableOpacity style={styles.supportStrip} onPress={goToSupport} activeOpacity={0.85}>
          <Ionicons name="headset" size={16} color={COLORS.primary} />
          <Text style={styles.supportStripText}>
            {isRTL ? 'تحتاج مساعدة بشرية؟ تواصل مع الدعم' : 'Need a human? Contact support'}
          </Text>
          <RTLIonicon name="chevron-forward" size={16} color={COLORS.primary} />
        </TouchableOpacity>

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
    supportStrip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.primary + '12',
      paddingHorizontal: SPACING.md,
      paddingVertical: 10,
    },
    supportStripText: {
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      color: C.primary,
      textAlign: isRTL ? 'right' : 'left',
    },
    inputBar: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
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
