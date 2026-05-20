import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
  Linking,
  Share,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import {
  getListing,
  listComments,
  addComment,
  deleteComment,
  resolveContactMethods,
  type MarketListing,
  type ListingComment,
} from '../services/marketService';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = Math.round(SCREEN_W * 0.78);

function timeAgo(iso: string | undefined, isRTL: boolean): string {
  if (!iso) return '';
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return isRTL ? 'الآن' : 'just now';
  if (m < 60) return isRTL ? `قبل ${m} د` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return isRTL ? `قبل ${h} س` : `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return isRTL ? `قبل ${d} ي` : `${d}d ago`;
  return new Date(iso).toLocaleDateString(isRTL ? 'ar' : 'en-GB');
}

const DEVICE_LABEL: Record<string, { ar: string; en: string }> = {
  phone:     { ar: 'جوال',     en: 'Phone' },
  laptop:    { ar: 'لابتوب',   en: 'Laptop' },
  tablet:    { ar: 'تابلت',    en: 'Tablet' },
  watch:     { ar: 'ساعة',     en: 'Watch' },
  accessory: { ar: 'إكسسوار',  en: 'Accessory' },
  other:     { ar: 'أخرى',     en: 'Other' },
};

const CONDITION_LABEL: Record<string, { ar: string; en: string }> = {
  new:         { ar: 'جديد',     en: 'New' },
  like_new:    { ar: 'شبه جديد', en: 'Like new' },
  refurbished: { ar: 'مجدّد',    en: 'Refurbished' },
  used:        { ar: 'مستعمل',   en: 'Used' },
  for_parts:   { ar: 'قطع غيار', en: 'For parts' },
};

export default function MarketDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [listing, setListing] = useState<MarketListing | null>(null);
  const [comments, setComments] = useState<ListingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<ListingComment | null>(null);

  // Photo pager — track which index is currently visible for the dot
  // indicator. Updated on momentum-scroll-end so we only re-render
  // when the user actually settles on a page.
  const [photoIdx, setPhotoIdx] = useState(0);
  const heroRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [l, c] = await Promise.all([getListing(id), listComments(id)]);
      setListing(l);
      setComments(c);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const styles = useMemo(() => createStyles(COLORS, isRTL), [COLORS, isRTL]);

  const submitComment = async () => {
    if (!user) {
      Alert.alert(isRTL ? 'تسجيل الدخول مطلوب' : 'Login required');
      return;
    }
    const text = commentText.trim();
    if (!text || !id) return;
    setPosting(true);
    try {
      const authorName =
        (userProfile as any)?.name ||
        (user as any)?.user_metadata?.name ||
        (isRTL ? 'مستخدم' : 'User');
      await addComment(id, user.id, text, {
        parentId: replyTo?.id ?? null,
        authorName,
      });
      setCommentText('');
      setReplyTo(null);
      setComments(await listComments(id));
    } catch (e: any) {
      Alert.alert(
        isRTL ? 'تعذّر إرسال التعليق' : 'Could not post comment',
        e?.message ?? String(e)
      );
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteComment = (c: ListingComment) => {
    Alert.alert(
      isRTL ? 'حذف التعليق' : 'Delete comment',
      isRTL ? 'هل تريد حذف هذا التعليق؟' : 'Delete this comment?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteComment(c.id);
              setComments((prev) => prev.filter((x) => x.id !== c.id && x.parent_id !== c.id));
            } catch (e: any) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
            }
          },
        },
      ]
    );
  };

  const handleCallSeller = () => {
    if (!listing?.contact_phone) return;
    Linking.openURL(`tel:${listing.contact_phone}`);
  };
  const handleWhatsAppSeller = () => {
    if (!listing?.contact_phone) return;
    const digits = listing.contact_phone.replace(/[^\d]/g, '');
    const text = encodeURIComponent(
      (isRTL ? 'مرحباً، رأيت إعلانك في Fixate: ' : 'Hi, I saw your Fixate listing: ') +
      (listing?.title ?? '')
    );
    Linking.openURL(`https://wa.me/${digits}?text=${text}`);
  };
  const handleShare = async () => {
    if (!listing) return;
    try {
      await Share.share({
        title: listing.title,
        message: `${listing.title} — ${listing.price} ${listing.currency}\n${listing.description ?? ''}`,
      });
    } catch {/* user cancelled */}
  };
  const handleReport = () => {
    Alert.alert(
      isRTL ? 'الإبلاغ عن الإعلان' : 'Report listing',
      isRTL
        ? 'سيراجع فريق Fixate هذا الإعلان. شكراً لمساعدتك في الحفاظ على سوق آمن.'
        : 'The Fixate team will review this listing. Thanks for keeping the market safe.',
      [{ text: 'OK' }]
    );
  };

  const onHeroScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SCREEN_W);
    if (idx !== photoIdx) setPhotoIdx(idx);
  };

  const methods = listing ? resolveContactMethods(listing) : new Set<string>();
  const showPhone   = methods.has('phone')    && !!listing?.contact_phone;
  const showWhats   = methods.has('whatsapp') && !!listing?.contact_phone;
  const showInApp   = methods.has('in_app');

  const deviceLbl = listing?.device_type ? DEVICE_LABEL[listing.device_type]?.[isRTL ? 'ar' : 'en'] : null;
  const conditionLbl = listing?.condition ? CONDITION_LABEL[listing.condition]?.[isRTL ? 'ar' : 'en'] : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={isRTL ? 'رجوع' : 'Back'}>
          <RTLIonicon name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {isRTL ? 'تفاصيل الإعلان' : 'Listing details'}
        </Text>
        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 6 }}>
          <TouchableOpacity onPress={handleShare} style={styles.headerIconBtn} accessibilityLabel={isRTL ? 'مشاركة' : 'Share'}>
            <Ionicons name="share-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleReport} style={styles.headerIconBtn} accessibilityLabel={isRTL ? 'إبلاغ' : 'Report'}>
            <MaterialCommunityIcons name="flag-outline" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : !listing ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={56} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>
            {isRTL ? 'الإعلان غير متاح' : 'Listing not available'}
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
            {/* Photo swiper with paging dots + counter pill. */}
            {listing.images && listing.images.length > 0 ? (
              <View style={styles.heroWrap}>
                <ScrollView
                  ref={heroRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={onHeroScroll}
                >
                  {listing.images.map((uri, i) => (
                    <Image key={i} source={{ uri }} style={{ width: SCREEN_W, height: HERO_H }} resizeMode="cover" />
                  ))}
                </ScrollView>
                {/* Counter pill (top-right) */}
                <View style={styles.heroCounter}>
                  <Ionicons name="images" size={11} color="#fff" />
                  <Text style={styles.heroCounterText}>
                    {photoIdx + 1} / {listing.images.length}
                  </Text>
                </View>
                {/* Paging dots */}
                {listing.images.length > 1 && (
                  <View style={styles.dotsRow} pointerEvents="none">
                    {listing.images.map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          i === photoIdx && { backgroundColor: '#fff', width: 16 },
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.heroWrap, styles.heroPlaceholder, { backgroundColor: COLORS.card }]}>
                <MaterialCommunityIcons name="image-off" size={48} color={COLORS.textSecondary} />
              </View>
            )}

            <View style={styles.body}>
              {/* Title + price hero */}
              <Text style={styles.listingTitle}>{listing.title}</Text>
              <Text style={styles.price}>
                {listing.price.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'ر.س' : listing.currency}
              </Text>

              {/* Pills: device / condition / city */}
              <View style={styles.pillsRow}>
                {deviceLbl && (
                  <View style={[styles.pill, { backgroundColor: COLORS.primary + '15' }]}>
                    <MaterialCommunityIcons name="devices" size={12} color={COLORS.primary} />
                    <Text style={[styles.pillText, { color: COLORS.primary }]}>{deviceLbl}</Text>
                  </View>
                )}
                {conditionLbl && (
                  <View style={[styles.pill, { backgroundColor: '#3b82f6' + '15' }]}>
                    <MaterialCommunityIcons name="star-circle-outline" size={12} color="#3b82f6" />
                    <Text style={[styles.pillText, { color: '#3b82f6' }]}>{conditionLbl}</Text>
                  </View>
                )}
                {listing.city ? (
                  <View style={[styles.pill, { backgroundColor: COLORS.border }]}>
                    <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
                    <Text style={[styles.pillText, { color: COLORS.text }]}>{listing.city}</Text>
                  </View>
                ) : null}
                <View style={[styles.pill, { backgroundColor: COLORS.border }]}>
                  <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={[styles.pillText, { color: COLORS.text }]}>
                    {timeAgo(listing.created_at, isRTL)}
                  </Text>
                </View>
              </View>

              {/* Description */}
              {listing.description ? (
                <View style={{ gap: 6, marginTop: 18 }}>
                  <Text style={styles.sectionTitle}>{isRTL ? 'الوصف' : 'Description'}</Text>
                  <Text style={styles.desc}>{listing.description}</Text>
                </View>
              ) : null}

              {/* Seller contact CTAs — only the methods the seller picked. */}
              {listing.seller_id !== user?.id && (
                <View style={{ gap: 8, marginTop: 22 }}>
                  <Text style={styles.sectionTitle}>
                    {isRTL ? 'التواصل مع البائع' : 'Contact the seller'}
                  </Text>
                  <View style={styles.contactRow}>
                    {showPhone && (
                      <TouchableOpacity
                        onPress={handleCallSeller}
                        style={[styles.contactBtn, { backgroundColor: '#10B981' }]}
                        accessibilityRole="button"
                      >
                        <Ionicons name="call" size={18} color="#fff" />
                        <Text style={styles.contactBtnText}>{isRTL ? 'اتصال' : 'Call'}</Text>
                      </TouchableOpacity>
                    )}
                    {showWhats && (
                      <TouchableOpacity
                        onPress={handleWhatsAppSeller}
                        style={[styles.contactBtn, { backgroundColor: '#25D366' }]}
                        accessibilityRole="button"
                      >
                        <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                        <Text style={styles.contactBtnText}>{isRTL ? 'واتساب' : 'WhatsApp'}</Text>
                      </TouchableOpacity>
                    )}
                    {showInApp && (
                      <TouchableOpacity
                        onPress={() => {
                          if (!user) {
                            Alert.alert(isRTL ? 'تسجيل الدخول مطلوب' : 'Login required');
                            return;
                          }
                          // Drop the user into the comments composer as the
                          // in-app contact channel for now.
                          setReplyTo(null);
                          setCommentText('');
                        }}
                        style={[styles.contactBtn, { backgroundColor: '#3b82f6' }]}
                        accessibilityRole="button"
                      >
                        <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                        <Text style={styles.contactBtnText}>{isRTL ? 'مراسلة' : 'Message'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Comments */}
              <View style={{ marginTop: 22 }}>
                <Text style={styles.sectionTitle}>
                  {isRTL ? `التعليقات (${comments.length})` : `Comments (${comments.length})`}
                </Text>
                {comments.length === 0 ? (
                  <Text style={styles.noComments}>
                    {isRTL ? 'لا توجد تعليقات بعد. كن أول من يعلّق.' : 'No comments yet. Be the first to comment.'}
                  </Text>
                ) : (
                  comments
                    .filter((c) => !c.parent_id)
                    .map((c) => {
                      const replies = comments.filter((x) => x.parent_id === c.id);
                      const isMine = c.user_id === user?.id;
                      return (
                        <View key={c.id}>
                          <View style={styles.commentRow}>
                            <View style={[styles.avatar, { backgroundColor: COLORS.primary }]}>
                              <Text style={styles.avatarText}>
                                {(c.author_name || '?').slice(0, 1).toUpperCase()}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={styles.commentTopRow}>
                                <Text style={styles.commentAuthor}>
                                  {c.author_name || (isRTL ? 'مستخدم' : 'User')}
                                </Text>
                                <Text style={styles.commentAgo}>{timeAgo(c.created_at, isRTL)}</Text>
                              </View>
                              <Text style={styles.commentText}>{c.content}</Text>
                              <View style={styles.commentActions}>
                                <TouchableOpacity onPress={() => setReplyTo(c)}>
                                  <Text style={[styles.commentAction, { color: COLORS.primary }]}>
                                    {isRTL ? 'رد' : 'Reply'}
                                  </Text>
                                </TouchableOpacity>
                                {isMine && (
                                  <TouchableOpacity onPress={() => handleDeleteComment(c)}>
                                    <Text style={[styles.commentAction, { color: '#EF4444' }]}>
                                      {isRTL ? 'حذف' : 'Delete'}
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          </View>
                          {replies.map((r) => (
                            <View key={r.id} style={[styles.commentRow, styles.replyRow]}>
                              <View style={[styles.avatar, { backgroundColor: COLORS.primary + '40' }]}>
                                <Text style={styles.avatarText}>
                                  {(r.author_name || '?').slice(0, 1).toUpperCase()}
                                </Text>
                              </View>
                              <View style={{ flex: 1 }}>
                                <View style={styles.commentTopRow}>
                                  <Text style={styles.commentAuthor}>
                                    {r.author_name || (isRTL ? 'مستخدم' : 'User')}
                                  </Text>
                                  <Text style={styles.commentAgo}>{timeAgo(r.created_at, isRTL)}</Text>
                                </View>
                                <Text style={styles.commentText}>{r.content}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      );
                    })
                )}
              </View>
            </View>
          </ScrollView>

          {/* Composer (sticky bottom) */}
          <View style={[styles.composer, { backgroundColor: COLORS.card, borderTopColor: COLORS.border }]}>
            {replyTo && (
              <View style={styles.replyBanner}>
                <Text style={[styles.replyBannerText, { color: COLORS.textSecondary }]} numberOfLines={1}>
                  {isRTL ? 'رد على' : 'Replying to'} {replyTo.author_name ?? ''}
                </Text>
                <TouchableOpacity onPress={() => setReplyTo(null)}>
                  <Ionicons name="close" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8 }}>
              <TextInput
                style={[styles.composerInput, { color: COLORS.text, backgroundColor: COLORS.background, borderColor: COLORS.border, textAlign: isRTL ? 'right' : 'left' }]}
                value={commentText}
                onChangeText={setCommentText}
                placeholder={isRTL ? 'اكتب تعليقاً…' : 'Write a comment…'}
                placeholderTextColor={COLORS.textSecondary}
                multiline
              />
              <TouchableOpacity
                onPress={submitComment}
                disabled={posting || !commentText.trim()}
                style={[styles.sendBtn, { backgroundColor: COLORS.primary, opacity: posting || !commentText.trim() ? 0.5 : 1 }]}
              >
                {posting ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    title: { fontSize: 17, fontWeight: '800', color: C.text },
    headerIconBtn: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
    emptyText: { color: C.text, fontWeight: '700', marginTop: 6 },

    heroWrap: { width: SCREEN_W, height: HERO_H, position: 'relative', backgroundColor: C.card },
    heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    heroCounter: {
      position: 'absolute',
      top: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    heroCounterText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    dotsRow: {
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 5,
    },
    dot: {
      width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)',
    },

    body: { padding: SPACING.lg, gap: 4 },
    listingTitle: { color: C.text, fontSize: 22, fontWeight: '800', lineHeight: 28, textAlign: isRTL ? 'right' : 'left' },
    price: { color: C.primary, fontSize: 26, fontWeight: '900', marginTop: 4, textAlign: isRTL ? 'right' : 'left' },

    pillsRow: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
    pill: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    pillText: { fontSize: 12, fontWeight: '700' },

    sectionTitle: { color: C.text, fontWeight: '800', fontSize: 14, textAlign: isRTL ? 'right' : 'left' },
    desc: { color: C.text, fontSize: 14, lineHeight: 22, textAlign: isRTL ? 'right' : 'left' },

    contactRow: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 },
    contactBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: BORDER_RADIUS.md,
      flex: 1,
      minWidth: 96,
      justifyContent: 'center',
    },
    contactBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

    noComments: { color: C.textSecondary, fontStyle: 'italic', marginTop: 8, textAlign: isRTL ? 'right' : 'left' },
    commentRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    replyRow: { paddingLeft: isRTL ? 0 : 28, paddingRight: isRTL ? 28 : 0, borderBottomWidth: 0, paddingVertical: 8 },
    avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    commentTopRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 6,
    },
    commentAuthor: { color: C.text, fontWeight: '700', fontSize: 13 },
    commentAgo: { color: C.textSecondary, fontSize: 11 },
    commentText: { color: C.text, fontSize: 13, lineHeight: 19, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
    commentActions: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 14,
      marginTop: 4,
    },
    commentAction: { fontSize: 12, fontWeight: '700' },

    composer: {
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: Platform.OS === 'ios' ? 18 : 10,
      borderTopWidth: 1,
    },
    replyBanner: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      paddingHorizontal: 4,
      paddingBottom: 4,
    },
    replyBannerText: { fontSize: 11, fontStyle: 'italic', flex: 1 },
    composerInput: {
      flex: 1,
      maxHeight: 120,
      minHeight: 44,
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 10,
      fontSize: 14,
    },
    sendBtn: {
      width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    },
  });
