import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Linking, Share } from 'react-native';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import {
  getListing,
  listComments,
  addComment,
  deleteComment,
  type MarketListing,
  type ListingComment,
} from '../services/marketService';

// Friendly "x ago" with Gregorian dates only.
function PhotoSwiper({ images, COLORS }: { images: string[]; COLORS: any }) {
  const [page, setPage] = useState(0);
  if (!images || images.length === 0) {
    return (
      <View style={{ width, height: width * 0.6, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card }}>
        <MaterialCommunityIcons name="image-off" size={48} color={COLORS.textSecondary} />
      </View>
    );
  }
  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const w = e.nativeEvent.layoutMeasurement.width || width;
          setPage(Math.round(e.nativeEvent.contentOffset.x / w));
        }}
      >
        {images.map((uri, i) => (
          <Image key={i} source={{ uri }} style={{ width, height: width * 0.85 }} resizeMode="cover" />
        ))}
      </ScrollView>
      {images.length > 1 && (
        <View style={{ position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 6 }}>
          {images.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === page ? 18 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === page ? '#fff' : 'rgba(255,255,255,0.55)',
              }}
            />
          ))}
        </View>
      )}
      {images.length > 1 && (
        <View style={{ position: 'absolute', top: 12, right: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="images" size={11} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
            {page + 1}/{images.length}
          </Text>
        </View>
      )}
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  COLORS,
  isRTL,
}: {
  icon: string;
  label: string;
  value: string;
  COLORS: any;
  isRTL: boolean;
}) {
  return (
    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
        <MaterialCommunityIcons name={icon as any} size={16} color={COLORS.textSecondary} />
        <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      </View>
      <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: '700' }}>{value}</Text>
    </View>
  );
}

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

const { width } = Dimensions.get('window');

export default function MarketDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language, isDark } = useApp();
  const { user, userProfile } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = createStyles(COLORS, isRTL);

  const [listing, setListing] = useState<MarketListing | null>(null);
  const [comments, setComments] = useState<ListingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  // Reply-to-comment target. When null we're posting a top-level comment.
  const [replyTo, setReplyTo] = useState<ListingComment | null>(null);

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
    // Saudi numbers without leading +; WhatsApp expects digits only.
    const digits = listing.contact_phone.replace(/[^\d]/g, '');
    const text = encodeURIComponent(
      (isRTL ? 'مرحباً، رأيت إعلانك في Fixate: ' : 'Hi, I saw your Fixate listing: ') +
      (listing?.title ?? '')
    );
    Linking.openURL(`https://wa.me/${digits}?text=${text}`);
  };

  // New contact_methods (preferred) → fall back to legacy contact_preference.
  const allowedMethods = (() => {
    const m = listing?.contact_methods;
    if (Array.isArray(m) && m.length > 0) return new Set(m);
    const pref = listing?.contact_preference ?? 'both';
    if (pref === 'phone') return new Set(['phone', 'whatsapp']);
    if (pref === 'dm')    return new Set(['in_app']);
    return new Set(['phone', 'whatsapp', 'in_app']);
  })();
  const showPhone   = allowedMethods.has('phone')    && !!listing?.contact_phone;
  const showWhats   = allowedMethods.has('whatsapp') && !!listing?.contact_phone;
  const showInApp   = allowedMethods.has('in_app');

  const conditionLabel = (() => {
    if (!listing?.condition) return null;
    const map: Record<string, { ar: string; en: string }> = {
      new:         { ar: 'جديد',     en: 'New' },
      like_new:    { ar: 'شبه جديد', en: 'Like new' },
      refurbished: { ar: 'مجدّد',    en: 'Refurbished' },
      used:        { ar: 'مستعمل',   en: 'Used' },
      for_parts:   { ar: 'قطع غيار', en: 'For parts' },
    };
    return map[listing.condition]?.[isRTL ? 'ar' : 'en'] ?? null;
  })();

  const deviceLabel = (() => {
    if (!listing?.device_type) return null;
    const map: Record<string, { ar: string; en: string }> = {
      phone:     { ar: 'جوال',     en: 'Phone' },
      laptop:    { ar: 'لابتوب',   en: 'Laptop' },
      tablet:    { ar: 'تابلت',    en: 'Tablet' },
      watch:     { ar: 'ساعة',     en: 'Watch' },
      accessory: { ar: 'إكسسوار',  en: 'Accessory' },
      other:     { ar: 'أخرى',     en: 'Other' },
    };
    return map[listing.device_type]?.[isRTL ? 'ar' : 'en'] ?? null;
  })();
  const handleShare = async () => {
    if (!listing) return;
    try {
      await Share.share({
        title: listing.title,
        message: `${listing.title} — ${listing.price} ${listing.currency}\n${listing.description ?? ''}`,
      });
    } catch {
      // user cancelled
    }
  };

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
        <View style={{ width: 26 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : !listing ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="alert-circle-outline" size={56} color={COLORS.textSecondary} />
          <Text style={styles.emptyText}>
            {isRTL ? 'الإعلان غير متاح' : 'Listing not available'}
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Photo swiper with paging + page-dot indicator */}
            <PhotoSwiper images={listing.images ?? []} COLORS={COLORS} />

            <View style={{ padding: SPACING.lg, gap: 10 }}>
              <Text style={styles.listingTitle}>{listing.title}</Text>
              <Text style={styles.price}>{listing.price} {listing.currency}</Text>

              {/* Structured details — device, condition, city, posted */}
              <View style={styles.detailsCard}>
                {deviceLabel && (
                  <DetailRow
                    icon="cellphone"
                    label={isRTL ? 'نوع الجهاز' : 'Device'}
                    value={deviceLabel}
                    COLORS={COLORS}
                    isRTL={isRTL}
                  />
                )}
                {conditionLabel && (
                  <DetailRow
                    icon="star-circle-outline"
                    label={isRTL ? 'الحالة' : 'Condition'}
                    value={conditionLabel}
                    COLORS={COLORS}
                    isRTL={isRTL}
                  />
                )}
                {listing.city ? (
                  <DetailRow
                    icon="map-marker-outline"
                    label={isRTL ? 'المدينة' : 'City'}
                    value={listing.city}
                    COLORS={COLORS}
                    isRTL={isRTL}
                  />
                ) : null}
                <DetailRow
                  icon="clock-outline"
                  label={isRTL ? 'تاريخ النشر' : 'Posted'}
                  value={timeAgo(listing.created_at, isRTL)}
                  COLORS={COLORS}
                  isRTL={isRTL}
                />
              </View>

              {listing.description ? (
                <View style={{ gap: 6 }}>
                  <Text style={styles.sectionTitle}>
                    {isRTL ? 'الوصف' : 'Description'}
                  </Text>
                  <Text style={styles.desc}>{listing.description}</Text>
                </View>
              ) : null}

              {/* Seller contact CTAs — only the methods the seller picked. */}
              {listing.seller_id !== user?.id && (
                <View style={{ gap: 8, marginTop: 6 }}>
                  <Text style={styles.sectionTitle}>
                    {isRTL ? 'التواصل مع البائع' : 'Contact the seller'}
                  </Text>
                  <View style={styles.contactRow}>
                    {showPhone && (
                      <TouchableOpacity onPress={handleCallSeller} style={[styles.contactBtn, { backgroundColor: '#10B981' }]}>
                        <Ionicons name="call" size={18} color="#fff" />
                        <Text style={styles.contactBtnText}>{isRTL ? 'اتصال' : 'Call'}</Text>
                      </TouchableOpacity>
                    )}
                    {showWhats && (
                      <TouchableOpacity onPress={handleWhatsAppSeller} style={[styles.contactBtn, { backgroundColor: '#25D366' }]}>
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
                          router.push({
                            pathname: '/market-chat',
                            params: { listingId: listing.id, sellerId: listing.seller_id },
                          } as any);
                        }}
                        style={[styles.contactBtn, { backgroundColor: '#3b82f6' }]}
                      >
                        <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                        <Text style={styles.contactBtnText}>{isRTL ? 'مراسلة' : 'Message'}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleShare} style={[styles.contactBtn, { backgroundColor: COLORS.primary }]}>
                      <Ionicons name="share-social-outline" size={18} color="#fff" />
                      <Text style={styles.contactBtnText}>{isRTL ? 'مشاركة' : 'Share'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Posted-ago marker */}
              <Text style={styles.posted}>
                {isRTL ? 'نُشر ' : 'Posted '}{timeAgo(listing.created_at, isRTL)}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={{ paddingHorizontal: SPACING.lg }}>
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
                          <View style={styles.avatar}>
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
                                <Text style={styles.commentAction}>
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
                            <View style={[styles.avatar, { backgroundColor: COLORS.primary + '15' }]}>
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
                              {r.user_id === user?.id && (
                                <TouchableOpacity onPress={() => handleDeleteComment(r)}>
                                  <Text style={[styles.commentAction, { color: '#EF4444', marginTop: 4 }]}>
                                    {isRTL ? 'حذف' : 'Delete'}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                    );
                  })
              )}
            </View>
          </ScrollView>

          {replyTo && (
            <View style={styles.replyBanner}>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {isRTL ? 'الرد على ' : 'Replying to '}
                <Text style={{ fontWeight: '700' }}>{replyTo.author_name || (isRTL ? 'مستخدم' : 'User')}</Text>
              </Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Ionicons name="close" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.commentBar}>
            <TextInput
              style={styles.commentInput}
              placeholder={
                replyTo
                  ? (isRTL ? `الرد على ${replyTo.author_name || ''}` : `Reply to ${replyTo.author_name || ''}`)
                  : (isRTL ? 'اكتب تعليقاً...' : 'Write a comment...')
              }
              placeholderTextColor={COLORS.textSecondary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, { opacity: posting || !commentText.trim() ? 0.5 : 1 }]}
              onPress={submitComment}
              disabled={posting || !commentText.trim()}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'إرسال' : 'Send'}
            >
              {posting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={18} color="#fff" />
              )}
            </TouchableOpacity>
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
      padding: SPACING.lg,
    },
    title: { fontSize: 17, fontWeight: '700', color: C.text, flex: 1, textAlign: 'center' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    emptyText: { color: C.textSecondary, fontSize: 15 },
    noImg: { backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
    listingTitle: { fontSize: 20, fontWeight: '800', color: C.text, textAlign: isRTL ? 'right' : 'left' },
    price: { fontSize: 18, fontWeight: '800', color: C.primary, textAlign: isRTL ? 'right' : 'left' },
    metaRow: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 },
    metaPill: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    metaText: { color: C.textSecondary, fontSize: 12 },
    detailsCard: {
      backgroundColor: C.card,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 14,
      paddingVertical: 4,
      marginTop: 6,
    },
    desc: { color: C.text, fontSize: 14, lineHeight: 22, textAlign: isRTL ? 'right' : 'left' },
    divider: { height: 8, backgroundColor: C.card, marginVertical: 8 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' },
    noComments: { color: C.textSecondary, fontSize: 13, paddingBottom: 16, textAlign: isRTL ? 'right' : 'left' },
    commentRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: C.primary + '22',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: C.primary, fontWeight: '800' },
    commentAuthor: { color: C.text, fontWeight: '700', fontSize: 13, textAlign: isRTL ? 'right' : 'left' },
    commentText: { color: C.text, fontSize: 14, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    commentBar: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: 8,
      padding: SPACING.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
      backgroundColor: C.background,
    },
    commentInput: {
      flex: 1,
      maxHeight: 110,
      minHeight: 44,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: C.text,
      backgroundColor: C.card,
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
    contactRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      marginTop: 10,
      flexWrap: 'wrap',
    },
    contactBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
    },
    contactBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    posted: { color: C.textSecondary, fontSize: 11, marginTop: 4, textAlign: isRTL ? 'right' : 'left' },
    commentTopRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    commentAgo: { color: C.textSecondary, fontSize: 11 },
    commentActions: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 14,
      marginTop: 6,
    },
    commentAction: { color: C.primary, fontSize: 12, fontWeight: '700' },
    replyRow: {
      marginStart: 38,
      paddingStart: 12,
      borderStartWidth: 2,
      borderStartColor: C.primary + '33',
      borderBottomWidth: 0,
    },
    replyBanner: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: 6,
      backgroundColor: C.primary + '10',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: C.border,
    },
    replyBannerText: { color: C.text, fontSize: 12, flex: 1, textAlign: isRTL ? 'right' : 'left' },
  });
