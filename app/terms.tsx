import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { RTLMaterialIcon } from '../components/RTLIcon';
import { safeBack } from '../utils/navigation';
import PolicyDocument from '../components/PolicyDocument';

export default function TermsScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = makeStyles(isRTL);

  const termsAr = `
# الشروط والأحكام

**آخر تحديث: يوليو 2026**

## 1. المقدمة

مرحباً بك في تطبيق Fixate ("التطبيق"). باستخدامك لهذا التطبيق، فإنك توافق على الالتزام بهذه الشروط والأحكام. يرجى قراءتها بعناية قبل استخدام خدماتنا.

## 2. التعريفات

- **المستخدم**: أي شخص يستخدم التطبيق، سواء كان عميلاً أو فنياً
- **العميل**: المستخدم الذي يطلب خدمات الإصلاح
- **الفني**: مقدم الخدمة المسجل في التطبيق
- **مندوب التوصيل**: الطرف المستقل المسجّل لاستلام الأجهزة وتوصيلها بين العميل والفني
- **الخدمة**: خدمات إصلاح الأجهزة الإلكترونية المقدمة من خلال التطبيق
- **الطلب**: طلب الخدمة المقدم من العميل

## 3. الأهلية

3.1. يجب أن يكون عمر المستخدم 18 عاماً على الأقل لاستخدام التطبيق
3.2. يجب تقديم معلومات صحيحة ودقيقة عند التسجيل
3.3. يحق لنا رفض أو إلغاء أي حساب في أي وقت

## 4. استخدام التطبيق

4.1. يلتزم المستخدم باستخدام التطبيق للأغراض المشروعة فقط
4.2. يُمنع استخدام التطبيق لأي نشاط غير قانوني أو احتيالي
4.3. يحظر نشر محتوى مسيء أو غير لائق
4.4. يجب الحفاظ على سرية بيانات الحساب

## 5. الخدمات والأسعار

5.1. الأسعار المعروضة هي عرض سعر مبدئي وقد تتغير بناءً على الفحص الفعلي
5.2. يتم الاتفاق على السعر النهائي بين العميل والفني قبل بدء العمل
5.3. جميع الأسعار بالريال السعودي وتشمل ضريبة القيمة المضافة

## 6. الدفع

6.1. يتم الدفع مباشرة للفني بعد إتمام الخدمة
6.2. طرق الدفع المتاحة: نقداً، بطاقة ائتمانية، تحويل بنكي
6.3. لا نتحمل مسؤولية النزاعات المالية بين العميل والفني

## 7. الإلغاء والاسترجاع

7.1. يمكن إلغاء الطلب قبل قبول الفني له دون رسوم
7.2. بعد قبول الطلب، قد تطبق رسوم إلغاء
7.3. لا يمكن استرجاع المبالغ بعد إتمام الخدمة إلا في حالات خاصة

## 8. مسؤوليات الفني

8.1. يجب أن يكون الفني مؤهلاً ومرخصاً لتقديم الخدمات
8.2. الالتزام بمعايير الجودة والاحترافية
8.3. احترام خصوصية العميل وممتلكاته
8.4. تقديم ضمان على الإصلاحات المنفذة

## 9. مسؤوليات العميل

9.1. تقديم معلومات دقيقة عن الجهاز والمشكلة
9.2. التواجد في الموقع المحدد في الوقت المتفق عليه
9.3. الدفع للفني بعد إتمام الخدمة
9.4. عدم التلاعب بالجهاز قبل وصول الفني

## 10. الضمان

10.1. يقدم الفني ضماناً على الإصلاحات حسب نوع الخدمة
10.2. مدة الضمان سنة كاملة (12 شهراً / 365 يوماً) على جميع الإصلاحات المنفذة عبر Fixate
10.3. الضمان لا يشمل الأضرار الناتجة عن سوء الاستخدام

## 11. المسؤولية

11.1. التطبيق منصة وساطة فقط بين العملاء والفنيين
11.2. لا نتحمل مسؤولية جودة الخدمات المقدمة
11.3. لا نتحمل مسؤولية أي أضرار ناتجة عن استخدام التطبيق

## 12. الخصوصية

12.1. نحترم خصوصية المستخدمين ونحمي بياناتهم
12.2. يرجى مراجعة سياسة الخصوصية للمزيد من التفاصيل
12.3. لا نشارك البيانات الشخصية مع أطراف ثالثة إلا بموافقة المستخدم

## 13. الملكية الفكرية

13.1. جميع حقوق الملكية الفكرية للتطبيق محفوظة
13.2. يُمنع نسخ أو تعديل أو توزيع محتوى التطبيق
13.3. الشعارات والعلامات التجارية مملوكة لنا

## 14. التعديلات

14.1. نحتفظ بالحق في تعديل هذه الشروط في أي وقت
14.2. سيتم إشعار المستخدمين بأي تغييرات جوهرية
14.3. استمرار استخدام التطبيق يعني الموافقة على التعديلات

## 15. إنهاء الحساب

15.1. يمكن للمستخدم إنهاء حسابه في أي وقت
15.2. نحتفظ بالحق في تعليق أو إنهاء أي حساب يخالف الشروط
15.3. عند إنهاء الحساب، تُحذف البيانات الشخصية

## 16. القانون الساري

16.1. تخضع هذه الشروط لقوانين المملكة العربية السعودية
16.2. تُحل النزاعات ودياً أو عبر المحاكم السعودية
16.3. اللغة العربية هي اللغة المعتمدة لتفسير الشروط

## 17. شروط استلام وتسليم الأجهزة

تطبق الشروط التالية عند استلام الجهاز للإصلاح وتسليمه بعد الإصلاح:

1) استقبال الجهاز المراد تصليحه بدون اكسسواراته مثل (غلاف/جراب/كابل) أو شريحة الاتصال أو ذاكرة خارجية، وعليه فإن الورشة غير مسؤولة عن فقدان أي من هذه الاكسسوارات.

2) عند تسليم العميل للجهاز المراد إصلاحه، يجب على العميل ذكر كافة الأعطال المراد إصلاحها، وفي حال لم يتم ذكر كافة الأعطال فإن الورشة غير مسؤولة عن أي عطل يتسبب في عطب الجهاز نهائيًا.

3) عند البدء في عملية الإصلاح (كتبديل شاشة الجهاز مثلًا) وتم اكتشاف عطل آخر لم يذكره العميل، فإن الورشة غير مسؤولة عن هذا العطل ويتحمل العميل كلفة إصلاحه في حال أراد ذلك.

4) في حالة تعرض الجهاز للسوائل، وتم إصلاحه من قبل الورشة وبعد استلام العميل له، فإن الورشة غير مسؤولة إذا ظهر عطل آخر في الجهاز لم يكن موجود عند تشغيل الجهاز عند استلامه.

5) جميع الشاشات التي يتم استبدالها أو تركيبها لجهاز العميل لا يوجد ضمان عليها.

6) لا يتم تسليم الجهاز للعميل إلا بفاتورة الاستلام.

7) يجب على العميل فحص الجهاز قبل مغادرة الورشة عند استلامه، وإلا فإن الورشة غير مسؤولة عن أي عطل آخر يظهر في الجهاز بعد مغادرته للورشة.

8) الورشة غير مسؤولة عن فقدان أو تلف الجهاز بعد مضي 3 أشهر من عدم استلامه.

## سياسة الضمان

أ. تقدّم Fixate ضماناً لمدة سنة كاملة (12 شهراً / 365 يوماً) على جميع الإصلاحات المنفذة عبر المنصة، ويشمل العمل والقطع المستبدلة.

ب. يبدأ سريان الضمان من تاريخ إتمام الإصلاح وتسليم الجهاز للعميل، ويظهر تاريخ انتهائه في تفاصيل الطلب.

ج. لا يشمل الضمان الأضرار الناتجة عن سوء الاستخدام أو السقوط أو السوائل أو العبث بالجهاز بعد الإصلاح أو الإصلاح لدى جهة أخرى.

د. لتفعيل الضمان يحتفظ العميل بفاتورة الإصلاح ويتواصل مع الدعم لمراجعة الحالة، وتُعاد المعالجة أو الإصلاح دون رسوم في الحالات المشمولة.

## الخصوصية وحماية البيانات

أ. نجمع فقط البيانات اللازمة لتقديم الخدمة: الاسم، رقم الجوال، البريد الإلكتروني، العنوان وموقع الخدمة، وتفاصيل الأجهزة والطلبات.

ب. تُخزَّن البيانات بشكل آمن على بنية سحابية (Supabase) مع ضوابط وصول وتشفير أثناء النقل.

ج. لا نبيع بياناتك الشخصية ولا نشاركها مع أطراف ثالثة إلا بالقدر اللازم لتنفيذ الخدمة أو حسبما يقتضيه النظام.

د. يحق للمستخدم الاطلاع على بياناته أو تصحيحها أو حذف حسابه وبياناته نهائياً عبر خيار «حذف الحساب» داخل التطبيق أو بالتواصل مع support@fixate.site.

هـ. نحتفظ بالسجلات اللازمة للفوترة والالتزامات النظامية للمدة التي يفرضها النظام فقط.

## الدفع والاسترداد

أ. طرق الدفع المتاحة: نقداً عند الإتمام، أو بالبطاقة الائتمانية/مدى، أو وسائل الدفع الإلكترونية المتاحة داخل التطبيق.

ب. الفحص مجاني دائماً ولا تُفرض عليه أي رسوم.

ج. يحق للعميل طلب الاسترداد إذا دفع مقابل إصلاح لم يُنفَّذ، أو عند ظهور خلل مشمول بالضمان ولم تتم معالجته.

د. تُقدَّم طلبات الاسترداد عبر فريق الدعم خلال 14 يوماً من تاريخ المعاملة، وتُراجَع كل حالة على حدة.

هـ. عند نشوء أي نزاع، يتولى فريق Fixate الوساطة بين العميل والفني للوصول إلى حل عادل، وما لم يُحل ودياً يُحال وفق القانون الساري.

## اعتماد الفنيين وتقييمهم

أ. يخضع كل فني لمراجعة واعتماد من إدارة Fixate قبل استقبال الطلبات، ويشمل ذلك التحقق من الهوية أو الإقامة والوثائق المطلوبة.

ب. يُقيّم العملاء الفنيين بعد كل طلب من 1 إلى 5 نجوم، ويظهر متوسط التقييم على ملف الفني ويؤثر على أولويته في استلام الطلبات.

ج. تُراقَب التقييمات المنخفضة المتكررة والبلاغات، وقد يؤدي ذلك إلى تعليق حساب الفني أو إنهائه.

## حدود المسؤولية

أ. تعمل Fixate كمنصة وساطة تربط العملاء بفنيين مستقلين، ولا تقدّم خدمة الإصلاح بنفسها.

ب. إلى الحد الذي يسمح به النظام، لا تتحمل Fixate المسؤولية عن أي أضرار غير مباشرة أو تبعية أو خاصة ناتجة عن استخدام التطبيق أو الخدمات.

ج. لا تتجاوز المسؤولية الإجمالية لـ Fixate — إن وُجدت — قيمة المبلغ المدفوع مقابل الطلب محل النزاع.

د. يتحمل العميل مسؤولية عمل نسخة احتياطية لبياناته قبل الإصلاح، ولا تتحمل المنصة مسؤولية فقدان البيانات.

## القانون الساري وتسوية النزاعات

أ. تخضع هذه الشروط وتُفسَّر وفقاً لأنظمة المملكة العربية السعودية.

ب. تُبذل المساعي لحل النزاعات ودياً عبر فريق الدعم، وما لم يتحقق ذلك تختص بنظرها الجهات القضائية المختصة في المملكة العربية السعودية.

## 19. التزامات ومسؤوليات العميل (مفصّلة)

19.1. يقرّ العميل بأن جميع البيانات المُدخلة (نوع الجهاز، العطل، العنوان، رقم الهاتف، الصور) صحيحة وكاملة، ويتحمّل وحده أي نتيجة تترتب على معلومات غير دقيقة أو مضلّلة أو ناقصة.

19.2. يقرّ العميل بأنه المالك الشرعي للجهاز أو مفوّض بإصلاحه، ويتحمّل كامل المسؤولية القانونية إذا تبيّن خلاف ذلك، وتُخلى المنصّة والفني من أي مسؤولية عن أجهزة مسروقة أو محجوزة أو محل نزاع.

19.3. يلتزم العميل بعمل نسخة احتياطية لبياناته قبل تسليم الجهاز. لا تتحمّل المنصّة ولا الفني أي مسؤولية عن فقدان البيانات أو الوسائط أو التطبيقات أو الإعدادات أثناء الفحص أو الإصلاح.

19.4. يُقرّ العميل بأن حالة الجهاز الظاهرة (كسور سابقة، تلف بالماء، أعطال مخفية، عبث سابق بالإصلاح) قد تؤثر على النتيجة، وأن أي أضرار ناتجة عن عيوب سابقة أو هشاشة في المكوّنات لا تُعدّ مسؤولية الفني أو المنصّة.

19.5. يلتزم العميل بالتواجد في الموعد المتفق عليه وبإتاحة الوصول للجهاز. التأخّر أو تعذّر التسليم/الاستلام لأسباب تخصّ العميل قد يترتب عليه رسوم أو إلغاء الطلب دون استرداد الرسوم غير القابلة للاسترداد.

19.6. يلتزم العميل بسداد كامل المبلغ المتفق عليه فور إتمام الخدمة. يُعدّ الامتناع عن الدفع إخلالاً جوهرياً يخوّل المنصّة والفني اتخاذ الإجراءات النظامية، بما في ذلك حجز الجهاز إلى حين السداد وفق الأنظمة المعمول بها.

19.7. أي إساءة استخدام للمنصّة (بلاغات كيدية، تقييمات غير صحيحة، محاولة تجاوز المنصّة للتعامل خارجها، انتحال الهوية) تخوّل المنصّة تعليق الحساب أو إنهاءه دون إشعار مسبق.

## 20. التزامات ومسؤوليات الفني (مفصّلة)

20.1. الفني مقاول مستقل وليس موظفاً لدى المنصّة. تعمل المنصّة كوسيط تقني يربط الأطراف فقط، ولا تُعدّ طرفاً في عقد الإصلاح ولا ضامنة لجودته أو نتيجته.

20.2. يتحمّل الفني وحده المسؤولية الكاملة والمباشرة عن جودة العمل، وسلامة الجهاز في عهدته، وأي ضرر أو فقدان أو سوء تشخيص أو استخدام قطع غير مطابقة، ويُعوّض العميل مباشرةً عند ثبوت تقصيره.

20.3. يلتزم الفني بتقديم تقديرات وأسعار صادقة، وبعدم المبالغة في الأعطال أو التكاليف، وبالإفصاح عن أي أعطال إضافية قبل تنفيذها والحصول على موافقة العميل.

20.4. يلتزم الفني بالمواعيد والمدد المتوقعة التي يعلنها، ويتحمّل مسؤولية أي أضرار تنشأ عن الإهمال أو التأخير غير المبرّر أو ترك الجهاز دون عناية.

20.5. يُحظر على الفني التعامل مع العميل خارج المنصّة أو تحصيل مبالغ خارج الآلية المعتمدة؛ ومخالفة ذلك تخوّل المنصّة إنهاء الحساب وحجب المستحقات ومطالبة الفني بالعمولات المستحقة.

20.6. يقرّ الفني بأنه يحمل كل التراخيص والتأمينات اللازمة لمزاولة النشاط، ويعوّض المنصّة عن أي مطالبات أو غرامات أو دعاوى تنشأ عن عمله أو تقصيره.

## 21. التزامات ومسؤوليات مندوب التوصيل (مفصّلة)

21.1. مندوب التوصيل مقاول مستقل مسؤول شخصياً عن استلام الجهاز وتسليمه بحالته المتفق عليها، وعن سلامته أثناء وجوده في عهدته من لحظة الاستلام حتى التسليم الموثّق.

21.2. يتحمّل المندوب المسؤولية الكاملة عن أي فقدان أو سرقة أو تلف أو تأخير يقع أثناء النقل، ويُعوّض الطرف المتضرّر مباشرةً، وتُخلى المنصّة من أي مسؤولية عن هذه الأضرار.

21.3. يلتزم المندوب بالتحقق من هوية الطرف المستلِم وتوثيق عملية التسليم (توقيع/صورة/تأكيد داخل التطبيق). أي تسليم لشخص خاطئ أو تسليم غير موثّق يقع على مسؤولية المندوب وحده.

21.4. يقرّ المندوب بامتلاكه رخصة قيادة سارية وتأميناً ومركبة نظامية، وبأنه المسؤول الوحيد عن أي مخالفات مرورية أو حوادث أو أضرار للغير أثناء تأدية المهمة.

21.5. يُحظر على المندوب فتح الجهاز أو تشغيله أو العبث بمحتوياته أو الاطلاع على بيانات العميل؛ ومخالفة ذلك تُعدّ خرقاً جسيماً يستوجب إنهاء الحساب والمساءلة النظامية.

21.6. في حال تعذّر التسليم أو الاستلام (غياب الطرف الآخر، عنوان خاطئ، رفض الاستلام)، يلتزم المندوب باتباع إجراءات المنصّة وتوثيق الحالة، ولا تتحمّل المنصّة تبعات فشل التسليم العائد لأي من الأطراف.

## 22. حدود مسؤولية المنصّة وإخلاء الطرف (مشدّد)

22.1. المنصّة وسيط تقني فقط لربط العملاء بالفنيين ومندوبي التوصيل، وليست طرفاً في أي عقد إصلاح أو نقل، ولا تقدّم خدمات الإصلاح أو التوصيل بنفسها.

22.2. تُقدَّم المنصّة "كما هي" و"حسب توفّرها" دون أي ضمانات صريحة أو ضمنية. لا تضمن المنصّة نتيجة أي إصلاح أو دقة أي تقدير أو سلوك أي مستخدم.

22.3. لا تتحمّل المنصّة بأي حال المسؤولية عن أضرار مباشرة أو غير مباشرة أو تبعية أو عرضية أو تحفيزية، بما في ذلك فقدان البيانات أو الأرباح أو الأجهزة، الناشئة عن استخدام الخدمة أو التعامل بين الأطراف.

22.4. تنحصر المسؤولية القصوى للمنصّة — إن وُجدت وبعد إثباتها — في قيمة العمولة التي تقاضتها المنصّة عن الطلب محل النزاع فقط، ولا تتجاوزها بأي حال.

22.5. تقع مسؤولية النزاعات المتعلقة بالتوقيت أو التسعير أو حالة الجهاز أو جودة الإصلاح أو التسليم بين الأطراف المعنيّة مباشرةً (العميل والفني والمندوب)، وتتدخّل المنصّة — إن تدخّلت — بصفة تيسيرية فقط ودون التزام أو ضمان.

22.6. يوافق كل مستخدم على تعويض المنصّة والدفاع عنها وإبراء ذمّتها من أي مطالبات أو خسائر أو أضرار أو أتعاب محاماة تنشأ عن استخدامه للخدمة أو إخلاله بهذه الشروط أو مخالفته للأنظمة أو تعديه على حقوق الغير.

22.7. تحتفظ المنصّة بحقها المطلق في تعليق أو إنهاء أي حساب، وحجب أي مستحقات مرتبطة بمخالفة أو احتيال، والإبلاغ عن أي نشاط غير مشروع للجهات المختصة، دون إشعار مسبق ودون أدنى مسؤولية.

## 18. الاتصال بنا

إذا كان لديك أي استفسارات حول هذه الشروط، يرجى التواصل معنا:

- البريد الإلكتروني: support@fixate.site
- العنوان: القطيف، المنطقة الشرقية، المملكة العربية السعودية

---

**بقبولك لهذه الشروط، فإنك تقر بأنك قرأتها وفهمتها ووافقت عليها، وتلتزم بجميع التزامات دورك (عميل / فني / مندوب توصيل) الواردة أعلاه.**
`;

  const termsEn = `
# Terms and Conditions

**Last Updated: July 2026**

## 1. Introduction

Welcome to Fixate ("the App"). By using this App, you agree to comply with these Terms and Conditions. Please read them carefully before using our services.

## 2. Definitions

- **User**: Any person using the App, whether customer or technician
- **Customer**: User requesting repair services
- **Technician**: Service provider registered in the App
- **Delivery Representative (Courier)**: The independent party registered to collect and deliver devices between the customer and the technician
- **Service**: Electronic device repair services provided through the App
- **Order**: Service request submitted by the customer

## 3. Eligibility

3.1. Users must be at least 18 years old to use the App
3.2. Accurate information must be provided during registration
3.3. We reserve the right to refuse or cancel any account at any time

## 4. Use of the App

4.1. Users must use the App for lawful purposes only
4.2. Using the App for illegal or fraudulent activities is prohibited
4.3. Posting offensive or inappropriate content is forbidden
4.4. Account credentials must be kept confidential

## 5. Services and Pricing

5.1. Displayed prices are an initial quotation and may change based on actual inspection
5.2. Final price is agreed upon between customer and technician before work begins
5.3. All prices are in Saudi Riyals and include VAT

## 6. Payment

6.1. Payment is made directly to the technician after service completion
6.2. Available payment methods: Cash, Credit Card, Bank Transfer
6.3. We are not responsible for financial disputes between customer and technician

## 7. Cancellation and Refunds

7.1. Orders can be cancelled before technician acceptance without fees
7.2. After order acceptance, cancellation fees may apply
7.3. Refunds are not available after service completion except in special cases

## 8. Technician Responsibilities

8.1. Technicians must be qualified and licensed to provide services
8.2. Commitment to quality and professionalism standards
8.3. Respect customer privacy and property
8.4. Provide warranty on completed repairs

## 9. Customer Responsibilities

9.1. Provide accurate information about device and issue
9.2. Be present at specified location at agreed time
9.3. Pay technician after service completion
9.4. Do not tamper with device before technician arrival

## 10. Warranty

10.1. Technicians provide warranty on repairs based on service type
10.2. The warranty period is a full year (12 months / 365 days) on all repairs performed through Fixate
10.3. Warranty does not cover damage from misuse

## 11. Liability

11.1. The App is only an intermediary platform between customers and technicians
11.2. We are not responsible for quality of services provided
11.3. We are not liable for any damages resulting from App use

## 12. Privacy

12.1. We respect user privacy and protect their data
12.2. Please review our Privacy Policy for more details
12.3. Personal data is not shared with third parties without user consent

## 13. Intellectual Property

13.1. All intellectual property rights of the App are reserved
13.2. Copying, modifying, or distributing App content is prohibited
13.3. Logos and trademarks are our property

## 14. Amendments

14.1. We reserve the right to modify these terms at any time
14.2. Users will be notified of any material changes
14.3. Continued use of the App implies acceptance of modifications

## 15. Account Termination

15.1. Users can terminate their account at any time
15.2. We reserve the right to suspend or terminate any account violating terms
15.3. Upon account termination, personal data is deleted

## 16. Governing Law

16.1. These terms are governed by the laws of Saudi Arabia
16.2. Disputes are resolved amicably or through Saudi courts
16.3. Arabic is the authoritative language for interpreting terms

## 17. Device Drop-off & Collection Terms

The following terms apply when a device is received for repair and collected afterwards (the Arabic text is the authoritative version):

1) The device is received for repair without its accessories such as (case/cover/cable), SIM card, or external memory; accordingly, the workshop is not responsible for the loss of any of these accessories.

2) When handing over the device for repair, the customer must mention all faults to be repaired. If not all faults are mentioned, the workshop is not responsible for any fault that causes permanent damage to the device.

3) If, during the repair (e.g. replacing the device screen), another fault not mentioned by the customer is discovered, the workshop is not responsible for that fault, and the customer bears the cost of repairing it should they wish to.

4) If the device was exposed to liquids and was repaired by the workshop, then after the customer collects it, the workshop is not responsible if another fault appears that was not present when the device was switched on at collection.

5) All screens replaced or installed on the customer's device carry no warranty.

6) The device is only handed over to the customer with the collection invoice.

7) The customer must inspect the device before leaving the workshop upon collection; otherwise the workshop is not responsible for any other fault that appears in the device after they leave the workshop.

8) The workshop is not responsible for loss of or damage to the device after 3 months from non-collection.

## Warranty Policy

a. Fixate provides a full one-year (12-month / 365-day) warranty on all repairs performed through the platform, covering both the labor and any replaced parts.

b. The warranty starts from the date the repair is completed and the device is handed back to the customer, and its expiry date is shown in the order details.

c. The warranty does not cover damage caused by misuse, drops, liquids, tampering with the device after the repair, or repairs carried out by a third party.

d. To claim the warranty, the customer keeps the repair invoice and contacts support to review the case; covered cases are re-repaired or resolved at no charge.

## Privacy & Data Protection

a. We collect only the data necessary to provide the service: name, mobile number, email, address and service location, and device and order details.

b. Data is stored securely on cloud infrastructure (Supabase) with access controls and encryption in transit.

c. We do not sell your personal data and do not share it with third parties except as necessary to deliver the service or as required by law.

d. Users may access or correct their data, or permanently delete their account and data, via the "Delete Account" option in the app or by contacting support@fixate.site.

e. We retain only the records required for billing and legal obligations, for the period required by law.

## Payment & Refunds

a. Accepted payment methods: cash on completion, credit card / mada, or the electronic payment methods available in the app.

b. Inspection is always free and is never charged for.

c. Customers may request a refund if they paid for a repair that was not performed, or if a warranty-covered fault appeared and was not resolved.

d. Refund requests are submitted through the support team within 14 days of the transaction date, and each case is reviewed individually.

e. In the event of a dispute, the Fixate team mediates between the customer and the technician to reach a fair resolution; if not resolved amicably, it is escalated under the governing law.

## Technician Vetting & Ratings

a. Every technician is reviewed and approved by Fixate before receiving orders, including verification of national ID or Iqama and the required documents.

b. Customers rate technicians from 1 to 5 stars after each order; the average rating is shown on the technician's profile and affects their priority for receiving orders.

c. Repeated low ratings and reports are monitored and may lead to suspension or termination of the technician's account.

## Limitation of Liability

a. Fixate acts as an intermediary platform connecting customers with independent technicians and does not perform the repair itself.

b. To the extent permitted by law, Fixate is not liable for any indirect, consequential or special damages arising from use of the app or the services.

c. Fixate's total liability, if any, shall not exceed the amount paid for the order in dispute.

d. The customer is responsible for backing up their data before a repair; the platform is not liable for data loss.

## Governing Law & Dispute Resolution

a. These terms are governed by and construed in accordance with the laws of the Kingdom of Saudi Arabia.

b. Efforts are made to resolve disputes amicably through the support team; failing that, the competent courts of the Kingdom of Saudi Arabia shall have jurisdiction.

## 19. Customer Obligations & Liability (Detailed)

19.1. The customer warrants that all information provided (device type, fault, address, phone, photos) is true, accurate and complete, and bears sole responsibility for any consequence of inaccurate, misleading or incomplete information.

19.2. The customer warrants they are the lawful owner of the device or authorized to have it repaired, and assumes full legal liability if proven otherwise. The platform and technician are released from any liability for stolen, seized or disputed devices.

19.3. The customer is solely responsible for backing up their data before handing over the device. Neither the platform nor the technician is liable for any loss of data, media, apps or settings during inspection or repair.

19.4. The customer acknowledges that the device's condition (prior cracks, water damage, hidden faults, previous tampering) may affect the outcome, and that damage arising from pre-existing defects or fragile components is not the responsibility of the technician or the platform.

19.5. The customer must be present at the agreed time and provide access to the device. Delays or failed hand-over/collection due to the customer may result in fees or cancellation without refund of non-refundable charges.

19.6. The customer must pay the full agreed amount immediately upon completion of the service. Non-payment is a material breach entitling the platform and technician to pursue lawful remedies, including retaining the device until payment under applicable law.

19.7. Any misuse of the platform (malicious reports, false ratings, attempts to bypass the platform to transact off-app, impersonation) entitles the platform to suspend or terminate the account without prior notice.

## 20. Technician Obligations & Liability (Detailed)

20.1. The technician is an independent contractor and not an employee of the platform. The platform acts solely as a technical intermediary connecting the parties, is not a party to the repair contract, and does not guarantee its quality or outcome.

20.2. The technician bears sole, full and direct responsibility for the quality of work, the safety of the device in their custody, and any damage, loss, misdiagnosis or use of non-conforming parts, and shall compensate the customer directly where fault is established.

20.3. The technician must provide honest estimates and pricing, must not exaggerate faults or costs, and must disclose any additional faults and obtain the customer's approval before performing extra work.

20.4. The technician must honor the timeframes and estimated durations they publish, and is liable for any damage arising from negligence, unjustified delay, or leaving the device unattended.

20.5. The technician may not deal with the customer off-platform or collect money outside the approved mechanism; breach entitles the platform to terminate the account, withhold dues, and claim any commissions owed.

20.6. The technician warrants they hold all licenses and insurance required to operate, and shall indemnify the platform against any claims, fines or actions arising from their work or default.

## 21. Delivery Representative (Courier) Obligations & Liability (Detailed)

21.1. The courier is an independent contractor personally responsible for collecting and delivering the device in its agreed condition, and for its safety while in their custody from the moment of pickup until documented delivery.

21.2. The courier bears full responsibility for any loss, theft, damage or delay occurring during transport, shall compensate the affected party directly, and the platform is released from any liability for such damage.

21.3. The courier must verify the identity of the receiving party and document the hand-over (signature/photo/in-app confirmation). Any delivery to the wrong person or undocumented delivery is the courier's sole responsibility.

21.4. The courier warrants they hold a valid driving license, insurance and a lawful vehicle, and is solely responsible for any traffic violations, accidents or third-party damage while performing the task.

21.5. The courier may not open, power on or tamper with the device or access the customer's data; breach is a gross violation warranting account termination and legal accountability.

21.6. Where delivery or collection fails (the other party is absent, wrong address, refusal to receive), the courier must follow the platform's procedures and document the case. The platform bears no consequences of a failed hand-over attributable to any party.

## 22. Platform Limitation of Liability & Release (Strengthened)

22.1. The platform is a technical intermediary only, connecting customers with technicians and couriers. It is not a party to any repair or transport contract and does not itself provide repair or delivery services.

22.2. The platform is provided "as is" and "as available" without warranties of any kind, express or implied. The platform does not guarantee the outcome of any repair, the accuracy of any estimate, or the conduct of any user.

22.3. In no event shall the platform be liable for any direct, indirect, consequential, incidental or punitive damages — including loss of data, profits or devices — arising from use of the service or dealings between the parties.

22.4. The platform's maximum liability, if any and once established, is limited to the commission the platform actually collected on the disputed order, and shall not exceed it under any circumstances.

22.5. Disputes concerning timing, pricing, device condition, repair quality or delivery rest directly with the parties involved (customer, technician and courier). The platform may intervene, if at all, on a facilitative basis only, without obligation or guarantee.

22.6. Each user agrees to indemnify, defend and hold the platform harmless from any claims, losses, damages or legal fees arising from their use of the service, their breach of these terms, their violation of law, or their infringement of the rights of others.

22.7. The platform reserves the absolute right to suspend or terminate any account, withhold any dues connected to a violation or fraud, and report any unlawful activity to the competent authorities, without prior notice and without the slightest liability.

## 18. Contact Us

If you have any questions about these terms, please contact us:

- Email: support@fixate.site
- Address: Al-Qatif, Eastern Province, Saudi Arabia

---

**By accepting these terms, you acknowledge that you have read, understood and agreed to them, and that you accept all obligations of your role (customer / technician / courier) set out above.**
`;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'رجوع' : 'Back'}
          onPress={() => safeBack()}
          style={styles.backButton}
        >
          <RTLMaterialIcon name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>
          {isRTL ? 'الشروط والأحكام' : 'Terms & Conditions'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <PolicyDocument content={isRTL ? termsAr : termsEn} isRTL={isRTL} COLORS={COLORS} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (isRTL: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      // Subtle separator now that the duplicate green nav bar is gone — gives
      // the title a visual base instead of floating against the content.
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    backButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: SPACING.lg,
    },
    text: {
      fontSize: 14,
      lineHeight: 24,
    },
  });
