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
interface Faq {
  id: string;
  q_ar: string;
  q_en: string;
  a_ar: string;
  a_en: string;
  keywords: string[];
}

const FAQS: Faq[] = [
  {
    id: 'request',
    q_ar: 'كيف أطلب صيانة؟',
    q_en: 'How do I request a repair?',
    a_ar: 'من الصفحة الرئيسية اضغط «اطلب صيانة جديدة»، اختر جهازك ونوع العطل وطريقة الخدمة، ثم أكمل الطلب. سيصلك فني معتمد لفحص الجهاز.',
    a_en: 'On the home screen tap "Request a New Repair", choose your device, the issue and a service method, then submit. A verified technician will be assigned to inspect your device.',
    keywords: ['request', 'repair', 'book', 'order', 'طلب', 'صيانة', 'احجز', 'اطلب'],
  },
  {
    id: 'price',
    q_ar: 'كيف يتم تحديد السعر؟',
    q_en: 'How is the price decided?',
    a_ar: 'الفحص مجاني. بعد فحص الفني لجهازك يرسل لك عرض سعر دقيق، وأنت تقرر قبوله أو رفضه قبل بدء أي إصلاح.',
    a_en: 'Inspection is free. After the technician inspects your device they send an accurate quote — you accept or reject it before any repair starts.',
    keywords: ['price', 'cost', 'quote', 'how much', 'سعر', 'تكلفة', 'كم', 'عرض'],
  },
  {
    id: 'time',
    q_ar: 'كم يستغرق الإصلاح؟',
    q_en: 'How long does a repair take?',
    a_ar: 'يعتمد على نوع العطل، لكن معظم الإصلاحات تكتمل خلال ساعة إلى ٣ ساعات بعد موافقتك على عرض السعر.',
    a_en: 'It depends on the issue, but most repairs are completed within 1 to 3 hours after you approve the quote.',
    keywords: ['time', 'long', 'duration', 'وقت', 'مدة', 'يستغرق', 'كم ساعة'],
  },
  {
    id: 'warranty',
    q_ar: 'ما هو الضمان؟',
    q_en: 'What warranty do I get?',
    a_ar: 'كل إصلاح يشمل ضمان ٦ أشهر على العمل والقطع المستبدلة.',
    a_en: 'Every repair includes a 6-month warranty covering the work and any replaced parts.',
    keywords: ['warranty', 'guarantee', 'ضمان', 'كفالة'],
  },
  {
    id: 'payment',
    q_ar: 'ما طرق الدفع المتاحة؟',
    q_en: 'What payment methods are available?',
    a_ar: 'يمكنك الدفع نقداً عند الإتمام أو بالبطاقة. يتم الدفع فقط بعد موافقتك على عرض السعر — لا تدفع شيئاً مقابل الفحص.',
    a_en: 'You can pay cash on completion or by card. Payment happens only after you approve the quote — you pay nothing for the inspection.',
    keywords: ['payment', 'pay', 'cash', 'card', 'دفع', 'نقد', 'بطاقة'],
  },
  {
    id: 'area',
    q_ar: 'ما هي مناطق الخدمة؟',
    q_en: 'Which areas do you cover?',
    a_ar: 'نخدم مدناً في جميع مناطق المملكة الـ13. عند إنشاء طلب تختار منطقتك ومدينتك وحيّك، ويتم ربط الموقع بالخريطة لتحديده بدقة. التغطية تتوسّع باستمرار.',
    a_en: 'We cover cities across all 13 regions of Saudi Arabia. When you create a request you pick your region, city and neighborhood, and the location is linked to the map for accuracy. Coverage keeps expanding.',
    keywords: ['area', 'areas', 'location', 'city', 'cover', 'coverage', 'region', 'منطقة', 'مناطق', 'مدينة', 'مدن', 'موقع', 'تغطية', 'خدمة'],
  },
  {
    id: 'pickup',
    q_ar: 'هل يوجد استلام وتوصيل؟',
    q_en: 'Do you offer pickup & delivery?',
    a_ar: 'نعم. يمكنك اختيار استلام وتوصيل الجهاز، أو زيارة فني متنقل، أو تسليم الجهاز بنفسك في مركز الخدمة.',
    a_en: 'Yes. You can choose pickup & delivery, an on-site technician visit, or drop the device off yourself at our service center.',
    keywords: ['pickup', 'delivery', 'collect', 'استلام', 'توصيل', 'تسليم'],
  },
  {
    id: 'track',
    q_ar: 'كيف أتابع حالة طلبي؟',
    q_en: 'How do I track my order?',
    a_ar: 'افتح «طلباتي» من الصفحة الرئيسية لرؤية حالة كل طلب وتفاصيله لحظة بلحظة.',
    a_en: 'Open "My Requests" from the home screen to see the live status and details of every order.',
    keywords: ['track', 'status', 'my order', 'تتبع', 'حالة', 'طلباتي', 'متابعة'],
  },
  {
    id: 'market',
    q_ar: 'كيف أبيع جهازاً في السوق؟',
    q_en: 'How do I sell a device in the marketplace?',
    a_ar: 'افتح «السوق» ثم «إعلان جديد»، أضف الصور والتفاصيل والسعر. يظهر الإعلان بعد مراجعته من الفريق.',
    a_en: 'Open "Marketplace", tap "New listing", add photos, details and a price. Your listing goes live after the team reviews it.',
    keywords: ['sell', 'marketplace', 'listing', 'market', 'سوق', 'بيع', 'إعلان'],
  },
  {
    id: 'technician',
    q_ar: 'كيف أصبح فنياً معكم؟',
    q_en: 'How do I become a technician?',
    a_ar: 'يمكنك التسجيل كفني من خلال تطبيق Fixate، أدخل بياناتك وتخصصك ومنطقتك، وسيتم مراجعة طلبك من قِبل الإدارة والموافقة عليه.',
    a_en: 'You can register as a technician through the Fixate app — enter your details, specialty and region, and your application will be reviewed and approved by the admin team.',
    keywords: ['technician', 'join', 'work', 'apply', 'become', 'فني', 'فنياً', 'فنيا', 'انضمام', 'توظيف', 'اعمل', 'أصبح'],
  },
  {
    id: 'cannot_fix',
    q_ar: 'ماذا لو لم يتمكن الفني من إصلاح الجهاز؟',
    q_en: "What if the technician can't fix my device?",
    a_ar: 'إذا تعذّر الإصلاح فلن تدفع تكلفة الإصلاح. الفحص مجاني دائماً، وإن كان العطل غير قابل للإصلاح سيوضّح لك الفني السبب والخيارات المتاحة.',
    a_en: "If the device can't be repaired you won't pay any repair cost — inspection is always free. The technician will explain why and what your options are.",
    keywords: ['cannot', "can't", 'fail', 'unfixable', 'not fixed', 'يصلح', 'يصلحه', 'يتمكن', 'فشل', 'تعذر', 'مايصير'],
  },
  {
    id: 'cancel',
    q_ar: 'هل يمكنني إلغاء الطلب؟',
    q_en: 'Can I cancel my order?',
    a_ar: 'نعم، يمكنك إلغاء الطلب من «طلباتي» قبل بدء الإصلاح دون أي رسوم. بعد الموافقة على عرض السعر وبدء العمل قد تُطبّق رسوم القطع المستخدمة.',
    a_en: 'Yes — you can cancel from "My Requests" before the repair starts at no charge. After you approve a quote and work begins, charges for used parts may apply.',
    keywords: ['cancel', 'cancellation', 'إلغاء', 'الغاء', 'ألغي', 'الغي', 'إلغ'],
  },
  {
    id: 'rate',
    q_ar: 'كيف أقيّم الفني؟',
    q_en: 'How do I rate the technician?',
    a_ar: 'بعد اكتمال الطلب يظهر لك خيار التقييم في تفاصيل الطلب — امنح نجوماً واكتب ملاحظتك. تقييمك يساعدنا على رفع جودة الخدمة.',
    a_en: 'After an order is completed a rating option appears in the order details — give stars and leave a note. Your feedback helps us keep quality high.',
    keywords: ['rate', 'rating', 'review', 'stars', 'feedback', 'تقييم', 'أقيم', 'اقيم', 'نجوم', 'تقييمات'],
  },
  {
    id: 'hours',
    q_ar: 'هل الخدمة متاحة على مدار الساعة؟',
    q_en: 'Is the service available 24/7?',
    a_ar: 'يمكنك إرسال طلبك في أي وقت عبر التطبيق. تُنفَّذ الزيارات خلال ساعات العمل، ويصلك الفني في أقرب موعد متاح حسب منطقتك.',
    a_en: 'You can submit a request any time in the app. Visits are carried out during working hours, and a technician reaches you at the earliest available slot for your area.',
    keywords: ['24', '24/7', 'hours', 'always', 'anytime', 'ساعة', 'الساعة', 'مدار', 'دوام', 'وقت'],
  },
  {
    id: 'devices',
    q_ar: 'ما الأجهزة التي تدعمها Fixate؟',
    q_en: 'Which devices does Fixate support?',
    a_ar: 'ندعم الجوّالات، اللابتوبات، الأجهزة اللوحية (التابلت)، الساعات الذكية وأجهزة الألعاب. اختر نوع جهازك عند إنشاء الطلب.',
    a_en: 'We support phones, laptops, tablets, smartwatches and gaming devices. Pick your device type when creating a request.',
    keywords: ['device', 'devices', 'support', 'phone', 'laptop', 'tablet', 'watch', 'gaming', 'أجهزة', 'جهاز', 'جوال', 'لابتوب', 'تابلت', 'ساعة', 'ألعاب', 'تدعم'],
  },
  {
    id: 'parts_genuine',
    q_ar: 'هل قطع الغيار أصلية؟',
    q_en: 'Are the spare parts genuine?',
    a_ar: 'نحرص على استخدام قطع غيار أصلية أو عالية الجودة، ويوضّح لك الفني نوع القطعة وسعرها ضمن عرض السعر قبل الموافقة.',
    a_en: 'We use genuine or high-quality parts, and the technician specifies the part type and price within the quote before you approve.',
    keywords: ['genuine', 'original', 'part', 'parts', 'quality', 'قطع', 'قطعة', 'أصلية', 'اصلية', 'غيار', 'جودة'],
  },
  {
    id: 'reschedule',
    q_ar: 'هل أستطيع تغيير موعد الزيارة؟',
    q_en: 'Can I change the visit time?',
    a_ar: 'نعم، يمكنك التنسيق مع الفني عبر المحادثة داخل الطلب لتغيير الموعد بما يناسبك قبل وصوله.',
    a_en: "Yes — coordinate with the technician through the in-order chat to reschedule before they arrive.",
    keywords: ['reschedule', 'change time', 'appointment', 'موعد', 'تغيير', 'أجل', 'تأجيل', 'الزيارة'],
  },
  {
    id: 'discount',
    q_ar: 'هل توجد أكواد خصم؟',
    q_en: 'Are there discount codes?',
    a_ar: 'نطرح عروضاً وأكواد خصم من وقت لآخر. تابع قسم العروض في التطبيق وأدخل الكود عند الدفع للاستفادة منه.',
    a_en: 'We run offers and discount codes from time to time. Check the offers section in the app and enter the code at checkout to use it.',
    keywords: ['discount', 'promo', 'coupon', 'code', 'offer', 'offers', 'خصم', 'كود', 'أكواد', 'عرض', 'عروض', 'كوبون'],
  },
  {
    id: 'account',
    q_ar: 'كيف أنشئ حساباً أو أسجّل الدخول؟',
    q_en: 'How do I create an account or log in?',
    a_ar: 'يمكنك التسجيل والدخول برقم جوالك السعودي عبر رمز التحقق، أو بالبريد الإلكتروني. لن تحتاج لإعادة الإدخال في كل مرة.',
    a_en: 'You can sign up and log in with your Saudi phone number via an OTP code, or with your email. You stay signed in between visits.',
    keywords: ['account', 'login', 'log in', 'sign up', 'register', 'otp', 'حساب', 'تسجيل', 'دخول', 'تسجل', 'رمز'],
  },
  {
    id: 'invoice',
    q_ar: 'هل أحصل على فاتورة؟',
    q_en: 'Do I get an invoice?',
    a_ar: 'نعم، بعد إتمام الدفع تُتاح لك فاتورة بتفاصيل الخدمة والقطع داخل تفاصيل الطلب.',
    a_en: 'Yes — once payment is complete an invoice with the service and parts breakdown is available in your order details.',
    keywords: ['invoice', 'receipt', 'bill', 'فاتورة', 'إيصال', 'ايصال', 'فواتير'],
  },
  {
    id: 'data_safety',
    q_ar: 'هل بياناتي وجهازي بأمان؟',
    q_en: 'Is my data and device safe?',
    a_ar: 'فنيونا معتمدون ومراجَعون من الإدارة. ننصح بعمل نسخة احتياطية لبياناتك قبل أي إصلاح، ونتعامل مع جهازك بسرية واحترافية.',
    a_en: 'Our technicians are verified and admin-approved. We recommend backing up your data before any repair, and we handle your device confidentially and professionally.',
    keywords: ['data', 'privacy', 'safe', 'secure', 'security', 'بيانات', 'خصوصية', 'أمان', 'امان', 'سرية', 'آمن'],
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
          {messages.map((m) => (
            <View key={m.id} style={{ width: '100%' }}>
              <View
                style={[
                  styles.bubble,
                  m.isBot ? styles.botBubble : styles.userBubble,
                ]}
              >
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
          ))}

          {/* Quick questions — always visible and tappable so the user can
              ask several in a row without the list resetting (FEAT-03). */}
          <View style={styles.quickWrap}>
            <Text style={styles.quickHint}>
              {isRTL ? 'أسئلة شائعة:' : 'Common questions:'}
            </Text>
            {FAQS.map((f) => {
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
