import React, { useMemo, useState, useRef, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';

/**
 * Fixate Assistant — strictly app-scoped FAQ chatbot.
 *
 * Design notes
 * ────────────
 *  • Deterministic keyword matcher (no external LLM, no remote calls).
 *    This keeps the assistant honest: it can only answer from the
 *    curated FAQ set, so it physically cannot drift off-topic or
 *    hallucinate facts about the product. Anything outside the set is
 *    routed to human support.
 *  • Score-based matching — every keyword that appears in the user's
 *    question contributes to a score; the highest-scoring FAQ above a
 *    confidence floor wins. Fixes the previous first-match bug where
 *    a generic keyword in an early FAQ could hijack a more-specific
 *    question.
 *  • Follow-ups: each FAQ declares a small set of related ids. After
 *    the assistant answers, those related questions surface as one-tap
 *    chips so the user can chain questions in a single session.
 *  • Off-topic guard: a tiny set of "obviously not about Fixate"
 *    signals (jokes, weather, AI-meta, code requests, etc.) short-
 *    circuits the matcher with a polite scope message + support
 *    handoff. The bot never tries to answer them.
 */

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  /** When set, the bubble shows a "talk to support" action. */
  offerHandoff?: boolean;
  /** When set, the bubble shows tappable follow-up FAQ chips. */
  followUpIds?: string[];
  timestamp: Date;
}

interface Faq {
  id: string;
  q_ar: string;
  q_en: string;
  a_ar: string;
  a_en: string;
  /** Normalised tokens — substrings that count as a match in the user's
   *  question. Each match scores `weight` points (default 1). */
  keywords: string[];
  /** Stronger signal words. Score 3 each. Used for short or ambiguous
   *  user input where a precise word is the deciding factor. */
  strong?: string[];
  /** FAQ ids surfaced as follow-up chips after this answer. */
  related?: string[];
}

const FAQS: Faq[] = [
  {
    id: 'request',
    q_ar: 'كيف أطلب صيانة؟',
    q_en: 'How do I request a repair?',
    a_ar: 'من الصفحة الرئيسية اضغط «اطلب صيانة جديدة»، اختر جهازك ونوع العطل وطريقة الخدمة، ثم أكمل الطلب. سيصلك فني معتمد لفحص الجهاز.',
    a_en: 'On the home screen tap "Request a New Repair", choose your device, the issue and a service method, then submit. A verified technician will be assigned to inspect your device.',
    keywords: ['request', 'repair', 'book', 'order', 'fix', 'طلب', 'صيانة', 'احجز', 'اطلب', 'إصلاح', 'تصليح'],
    strong: ['how do i request', 'how do i book', 'كيف أطلب', 'كيف احجز'],
    related: ['price', 'time', 'pickup', 'area'],
  },
  {
    id: 'price',
    q_ar: 'كيف يتم تحديد السعر؟',
    q_en: 'How is the price decided?',
    a_ar: 'الفحص مجاني. بعد فحص الفني لجهازك يرسل لك عرض سعر دقيق، وأنت تقرر قبوله أو رفضه قبل بدء أي إصلاح.',
    a_en: 'Inspection is free. After the technician inspects your device they send an accurate quote — you accept or reject it before any repair starts.',
    keywords: ['price', 'cost', 'quote', 'how much', 'fee', 'expensive', 'cheap', 'سعر', 'تكلفة', 'كم', 'عرض', 'رسوم', 'كلفة'],
    strong: ['how much', 'كم يكلف', 'كم السعر'],
    related: ['payment', 'warranty', 'time'],
  },
  {
    id: 'time',
    q_ar: 'كم يستغرق الإصلاح؟',
    q_en: 'How long does a repair take?',
    a_ar: 'يعتمد على نوع العطل، لكن معظم الإصلاحات تكتمل خلال ساعة إلى ٣ ساعات بعد موافقتك على عرض السعر.',
    a_en: 'It depends on the issue, but most repairs are completed within 1 to 3 hours after you approve the quote.',
    keywords: ['time', 'long', 'duration', 'hours', 'wait', 'وقت', 'مدة', 'يستغرق', 'كم ساعة', 'متى', 'انتظار'],
    strong: ['how long', 'كم يستغرق', 'كم وقت'],
    related: ['track', 'request', 'pickup'],
  },
  {
    id: 'warranty',
    q_ar: 'ما هو الضمان؟',
    q_en: 'What warranty do I get?',
    a_ar: 'كل إصلاح يشمل ضمان ٦ أشهر على العمل والقطع المستبدلة. إذا عاد العطل خلال الفترة، نُصلحه مجاناً.',
    a_en: 'Every repair includes a 6-month warranty covering the work and any replaced parts. If the issue returns during that window we fix it for free.',
    keywords: ['warranty', 'guarantee', 'cover', 'broken again', 'ضمان', 'كفالة', 'يرجع', 'عاد'],
    strong: ['warranty', 'ضمان'],
    related: ['refund', 'cancel', 'price'],
  },
  {
    id: 'payment',
    q_ar: 'ما طرق الدفع المتاحة؟',
    q_en: 'What payment methods are available?',
    a_ar: 'يمكنك الدفع نقداً عند الإتمام أو بالبطاقة. يتم الدفع فقط بعد موافقتك على عرض السعر — لا تدفع شيئاً مقابل الفحص.',
    a_en: 'You can pay cash on completion or by card. Payment happens only after you approve the quote — you pay nothing for the inspection.',
    keywords: ['payment', 'pay', 'cash', 'card', 'visa', 'mada', 'apple pay', 'دفع', 'نقد', 'بطاقة', 'فيزا', 'مدى'],
    strong: ['how do i pay', 'كيف أدفع', 'طرق الدفع'],
    related: ['price', 'refund', 'loyalty'],
  },
  {
    id: 'area',
    q_ar: 'ما المناطق المغطاة؟',
    q_en: 'Which areas do you cover?',
    a_ar: 'الخدمة متاحة حالياً في القطيف والمناطق التابعة لها (مثل سيهات وصفوى وتاروت)، ونعمل على توسيع التغطية لباقي المنطقة الشرقية قريباً.',
    a_en: 'Service is currently available in Al Qatif and the areas administratively under it (Saihat, Safwa, Tarout). We are expanding coverage across the Eastern Province soon.',
    keywords: ['area', 'location', 'city', 'cover', 'coverage', 'qatif', 'dammam', 'khobar', 'منطقة', 'مدينة', 'موقع', 'القطيف', 'تغطية', 'سيهات', 'الدمام', 'الخبر'],
    strong: ['where do you', 'do you cover', 'هل تغطون', 'متى توسع'],
    related: ['request', 'pickup', 'time'],
  },
  {
    id: 'pickup',
    q_ar: 'هل يوجد استلام وتوصيل؟',
    q_en: 'Do you offer pickup & delivery?',
    a_ar: 'نعم. يمكنك اختيار الاستلام والتوصيل، أو زيارة فني متنقل، أو تسليم الجهاز بنفسك في مركز الخدمة.',
    a_en: 'Yes. You can choose pickup & delivery, an on-site technician visit, or drop the device off yourself at our service center.',
    keywords: ['pickup', 'delivery', 'collect', 'come to me', 'mobile', 'استلام', 'توصيل', 'تسليم', 'يجي', 'متنقل'],
    strong: ['pickup and delivery', 'استلام وتوصيل'],
    related: ['area', 'request', 'time'],
  },
  {
    id: 'track',
    q_ar: 'كيف أتابع حالة طلبي؟',
    q_en: 'How do I track my order?',
    a_ar: 'افتح «طلباتي» من الصفحة الرئيسية لرؤية حالة كل طلب وتفاصيله لحظة بلحظة.',
    a_en: 'Open "My Requests" from the home screen to see the live status and details of every order.',
    keywords: ['track', 'status', 'my order', 'where is', 'progress', 'تتبع', 'حالة', 'طلباتي', 'متابعة', 'وين طلبي'],
    strong: ['track my order', 'where is my', 'أين طلبي'],
    related: ['cancel', 'time', 'request'],
  },
  {
    id: 'cancel',
    q_ar: 'هل أستطيع إلغاء الطلب؟',
    q_en: 'Can I cancel my order?',
    a_ar: 'نعم. يمكنك إلغاء الطلب قبل بدء الفني بالعمل بدون أي رسوم. بعد بدء الإصلاح قد تُطبَّق رسوم تشخيص بسيطة.',
    a_en: 'Yes. You can cancel the order any time before the technician begins work — free of charge. Once the repair starts a small inspection fee may apply.',
    keywords: ['cancel', 'stop', 'abort', 'remove order', 'إلغاء', 'الغي', 'وقف'],
    strong: ['cancel my order', 'إلغاء الطلب'],
    related: ['refund', 'track', 'warranty'],
  },
  {
    id: 'refund',
    q_ar: 'كيف يتم استرداد المبلغ؟',
    q_en: 'How do refunds work?',
    a_ar: 'إذا كنت دفعت مقدماً وأُلغي الطلب أو لم يتم الإصلاح، يُعاد المبلغ إلى نفس وسيلة الدفع خلال ٣ إلى ٧ أيام عمل.',
    a_en: 'If you paid up front and the order was cancelled or the repair could not be completed, the amount is returned to your original payment method within 3 to 7 business days.',
    keywords: ['refund', 'money back', 'reimburse', 'استرداد', 'استرجاع', 'فلوس', 'ارجاع المبلغ'],
    strong: ['get my money back', 'استرداد المبلغ'],
    related: ['cancel', 'payment', 'warranty'],
  },
  {
    id: 'market',
    q_ar: 'كيف أبيع جهازاً في السوق؟',
    q_en: 'How do I sell a device in the marketplace?',
    a_ar: 'افتح «السوق» ثم «إعلان جديد»، أضف الصور والتفاصيل والسعر. يظهر الإعلان بعد مراجعته من الفريق.',
    a_en: 'Open "Marketplace", tap "New listing", add photos, details and a price. Your listing goes live after the team reviews it.',
    keywords: ['sell', 'marketplace', 'listing', 'market', 'post listing', 'سوق', 'بيع', 'إعلان', 'انشر إعلان'],
    strong: ['sell my', 'post a listing', 'بيع جهاز'],
    related: ['account', 'support', 'price'],
  },
  {
    id: 'technician',
    q_ar: 'كيف أصبح فنياً معكم؟',
    q_en: 'How do I become a technician?',
    a_ar: 'سجّل كفني من شاشة اختيار الدور، أكمل بياناتك ووثائقك، وبعد اعتماد الفريق ستبدأ باستقبال الطلبات.',
    a_en: 'Sign up as a technician from the role-selection screen, complete your details and documents, and once the team approves you, you can start receiving jobs.',
    keywords: ['technician', 'join', 'work', 'apply', 'become', 'فني', 'انضمام', 'توظيف', 'اعمل', 'وظيفة'],
    strong: ['become a technician', 'انضم كفني'],
    related: ['support', 'account'],
  },
  {
    id: 'loyalty',
    q_ar: 'كيف يعمل برنامج الولاء؟',
    q_en: 'How does the loyalty program work?',
    a_ar: 'تكسب نقاطاً مع كل طلب مكتمل، ويمكنك استبدالها بخصم على إصلاح أو إكسسوار. تابع رصيد نقاطك من شاشة «الولاء».',
    a_en: 'You earn points on every completed order and can redeem them for a discount on a future repair or accessory. Check your balance from the "Loyalty" screen.',
    keywords: ['loyalty', 'points', 'reward', 'redeem', 'ولاء', 'نقاط', 'مكافأة', 'استبدال'],
    strong: ['loyalty', 'reward points', 'برنامج الولاء'],
    related: ['payment', 'price'],
  },
  {
    id: 'account',
    q_ar: 'كيف أعدّل حسابي وعنواني؟',
    q_en: 'How do I edit my profile and address?',
    a_ar: 'افتح «حسابي» من القائمة، ثم «تعديل الملف الشخصي» للاسم والصورة، و«عناويني» لإضافة أو تعديل عنوان.',
    a_en: 'Open "Profile" from the menu, then "Edit Profile" for name and photo, or "Addresses" to add or edit an address.',
    keywords: ['profile', 'account', 'edit', 'name', 'photo', 'address', 'phone', 'حساب', 'ملف', 'تعديل', 'الاسم', 'صورة', 'عنوان', 'رقم'],
    strong: ['edit my profile', 'change my address', 'تعديل ملفي'],
    related: ['market', 'support'],
  },
  {
    id: 'support',
    q_ar: 'كيف أتواصل مع الدعم؟',
    q_en: 'How do I contact support?',
    a_ar: 'اضغط على «تواصل مع الدعم» أعلى الشاشة في أي وقت — فريقنا متاح ٧ أيام في الأسبوع للرد على أسئلتك.',
    a_en: 'Tap "Talk to support" at the top of this screen any time — our team is available 7 days a week to answer your questions.',
    keywords: ['support', 'help', 'contact', 'human', 'representative', 'agent', 'دعم', 'مساعدة', 'تواصل', 'موظف', 'خدمة العملاء'],
    strong: ['talk to support', 'human', 'تكلم مع', 'محتاج دعم'],
    related: [],
  },
];

const FAQ_BY_ID: Record<string, Faq> = Object.fromEntries(FAQS.map((f) => [f.id, f]));

/** Explicit handoff intent — fast-path before scoring. */
const HANDOFF_KEYWORDS = [
  'talk to human', 'talk to agent', 'real person', 'representative', 'support team',
  'موظف', 'إنسان', 'شخص حقيقي', 'تكلم مع', 'تحدث مع',
];

/** Off-topic signals — if the question is obviously not about the app,
 *  refuse politely instead of guessing. Kept small and conservative so
 *  legitimate edge cases aren't blocked. */
const OFF_TOPIC_PATTERNS: RegExp[] = [
  /\b(weather|news|stock|crypto|football|movie|recipe|joke|riddle|chatgpt|gpt|openai|claude|gemini)\b/i,
  /\b(write code|generate code|code for|debug|sql|python|javascript)\b/i,
  /(الطقس|الأخبار|أسعار العملات|نكتة|نكت|اكتب لي كود|اكتب كود)/,
];

/** Score a single FAQ against a normalised question. Higher is better. */
function scoreFaq(faq: Faq, qLower: string): number {
  let score = 0;
  for (const k of faq.keywords) {
    if (qLower.includes(k.toLowerCase())) score += 1;
  }
  for (const s of faq.strong ?? []) {
    if (qLower.includes(s.toLowerCase())) score += 3;
  }
  return score;
}

/** Minimum score the winning FAQ must reach for us to return its answer.
 *  Below this we treat the question as "out of scope" and offer support. */
const CONFIDENCE_FLOOR = 1;

export default function ChatbotScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = useMemo(() => makeStyles(COLORS, isRTL), [COLORS, isRTL]);
  const scrollViewRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: isRTL
        ? 'مرحباً! أنا مساعد Fixate المخصّص للأسئلة عن التطبيق. اسألني عن الأسعار، الضمان، التوصيل، أو أي شيء داخل التطبيق — أو اطلب التحدث مع فريق الدعم.'
        : "Hi! I'm the Fixate in-app assistant. Ask me about pricing, warranty, delivery, or anything inside the app — or ask to talk to our support team.",
      isBot: true,
      followUpIds: ['request', 'price', 'warranty', 'area'],
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [allFaqsOpen, setAllFaqsOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 120);
    return () => clearTimeout(t);
  }, [messages, thinking]);

  const findAnswer = (raw: string): { text: string; offerHandoff: boolean; followUpIds?: string[] } => {
    const q = raw.toLowerCase().trim();
    if (!q) {
      return { text: '', offerHandoff: false };
    }

    // Fast-path 1: explicit support handoff request.
    if (HANDOFF_KEYWORDS.some((k) => q.includes(k.toLowerCase()))) {
      return {
        text: isRTL
          ? 'بالتأكيد — يمكنني تحويلك إلى فريق الدعم للرد عليك مباشرة.'
          : 'Of course — I can connect you with our support team for direct help.',
        offerHandoff: true,
      };
    }

    // Fast-path 2: off-topic refusal. The assistant is strictly app-scoped;
    // we never attempt to answer questions about the world at large.
    if (OFF_TOPIC_PATTERNS.some((re) => re.test(q))) {
      return {
        text: isRTL
          ? 'أنا متخصّص فقط في أسئلة تطبيق Fixate (الإصلاح، الأسعار، الضمان، التوصيل، السوق، الحساب). لأي سؤال خارج هذا، يمكنك التواصل مع فريق الدعم مباشرة.'
          : "I'm scoped strictly to Fixate app questions (repairs, pricing, warranty, delivery, marketplace, your account). For anything outside that, our support team can help directly.",
        offerHandoff: true,
        followUpIds: ['request', 'price', 'support'],
      };
    }

    // Score every FAQ and pick the highest. Tie-break by FAQ position
    // (earlier = more important).
    let best: Faq | null = null;
    let bestScore = 0;
    for (const f of FAQS) {
      const s = scoreFaq(f, q);
      if (s > bestScore) {
        bestScore = s;
        best = f;
      }
    }

    if (best && bestScore >= CONFIDENCE_FLOOR) {
      return {
        text: isRTL ? best.a_ar : best.a_en,
        offerHandoff: false,
        followUpIds: best.related,
      };
    }

    // No FAQ matched confidently — be honest, offer support, and surface
    // a few common starting points so the session doesn't dead-end.
    return {
      text: isRTL
        ? 'لم أتمكن من فهم سؤالك تماماً. جرّب صياغته بشكل آخر أو اختر من الأسئلة الشائعة بالأسفل — وإذا احتجت، يمكنني تحويلك إلى فريق الدعم.'
        : "I couldn't quite match that to a topic I know. Try rephrasing, pick one of the common questions below, or I can hand you off to support.",
      offerHandoff: true,
      followUpIds: ['request', 'price', 'warranty', 'support'],
    };
  };

  const pushBot = (text: string, offerHandoff: boolean, followUpIds?: string[]) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-bot`,
        text,
        isBot: true,
        offerHandoff,
        followUpIds,
        timestamp: new Date(),
      },
    ]);
  };

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-user`, text: trimmed, isBot: false, timestamp: new Date() },
    ]);
    setInputText('');
    setAllFaqsOpen(false);
    setThinking(true);
    // Short artificial delay so the conversation reads naturally and
    // the "thinking" indicator has time to render.
    setTimeout(() => {
      const { text: answer, offerHandoff, followUpIds } = findAnswer(trimmed);
      pushBot(answer, offerHandoff, followUpIds);
      setThinking(false);
    }, 450);
  };

  const goToSupport = () => router.push('/support-chat');

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
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m, idx) => {
            // Only the most recent bot message shows follow-up chips —
            // keeps the scroll clean and the chips contextual.
            const isLatestBot = m.isBot && idx === messages.length - 1;
            return (
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
                {isLatestBot && m.followUpIds && m.followUpIds.length > 0 && (
                  <FollowUpChips
                    ids={m.followUpIds}
                    onPick={(id) => sendMessage(isRTL ? FAQ_BY_ID[id].q_ar : FAQ_BY_ID[id].q_en)}
                    isRTL={isRTL}
                    COLORS={COLORS}
                  />
                )}
              </View>
            );
          })}

          {thinking && (
            <View style={[styles.bubble, styles.botBubble, styles.thinkingBubble]}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={[styles.bubbleText, { color: COLORS.textSecondary, marginStart: 8 }]}>
                {isRTL ? 'جارٍ التفكير…' : 'Thinking…'}
              </Text>
            </View>
          )}

          {/* "All common questions" inline drawer — always reachable, not
              locked to the first two messages like before. */}
          {allFaqsOpen && (
            <View style={styles.allFaqsWrap}>
              <Text style={styles.quickHint}>{isRTL ? 'الأسئلة الشائعة:' : 'Common questions:'}</Text>
              {FAQS.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={styles.quickChip}
                  onPress={() => sendMessage(isRTL ? f.q_ar : f.q_en)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="message-question-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.quickChipText}>{isRTL ? f.q_ar : f.q_en}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Toolbar above the input — toggles the full FAQ list and routes
            to support without forcing the user to scroll back up. */}
        <View style={styles.toolbar}>
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={() => setAllFaqsOpen((v) => !v)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons
              name={allFaqsOpen ? 'close-circle-outline' : 'help-circle-outline'}
              size={16}
              color={COLORS.primary}
            />
            <Text style={styles.toolbarBtnText}>
              {allFaqsOpen
                ? (isRTL ? 'إخفاء الأسئلة' : 'Hide questions')
                : (isRTL ? 'كل الأسئلة الشائعة' : 'All common questions')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolbarBtn, { backgroundColor: COLORS.primary + '12' }]}
            onPress={goToSupport}
            activeOpacity={0.85}
          >
            <Ionicons name="headset" size={14} color={COLORS.primary} />
            <Text style={styles.toolbarBtnText}>{isRTL ? 'الدعم' : 'Support'}</Text>
          </TouchableOpacity>
        </View>

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
            onSubmitEditing={() => sendMessage(inputText)}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, { opacity: inputText.trim() && !thinking ? 1 : 0.5 }]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || thinking}
          >
            <RTLIonicon name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Horizontal-scrolling follow-up chips. Always reflects the latest bot
 * answer so multi-turn conversations have a clear next step without the
 * user having to type or scroll back to the common-questions block.
 */
function FollowUpChips({
  ids, onPick, isRTL, COLORS,
}: {
  ids: string[];
  onPick: (id: string) => void;
  isRTL: boolean;
  COLORS: any;
}) {
  const valid = ids.map((id) => FAQ_BY_ID[id]).filter(Boolean);
  if (valid.length === 0) return null;
  return (
    <View style={{ marginBottom: 14, marginTop: 2 }}>
      <Text style={{
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textSecondary,
        marginBottom: 6,
        textAlign: isRTL ? 'right' : 'left',
      }}>
        {isRTL ? 'أسئلة متابعة:' : 'Follow-up questions:'}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 8,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        }}
      >
        {valid.map((f) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => onPick(f.id)}
            activeOpacity={0.8}
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: COLORS.primary + '40',
              backgroundColor: COLORS.primary + '0E',
            }}
          >
            <MaterialCommunityIcons name="arrow-right-circle-outline" size={14} color={COLORS.primary} />
            <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 12 }}>
              {isRTL ? f.q_ar : f.q_en}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
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
    thinkingBubble: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      paddingVertical: 10,
    },
    handoffBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignSelf: isRTL ? 'flex-end' : 'flex-start',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.primary,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      marginBottom: 10,
    },
    handoffBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
    allFaqsWrap: {
      marginTop: 8,
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
      paddingTop: 12,
    },
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
    toolbar: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: C.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    toolbarBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: C.primary + '12',
    },
    toolbarBtnText: { color: C.primary, fontWeight: '800', fontSize: 12 },
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
