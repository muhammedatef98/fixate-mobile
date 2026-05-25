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
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import ImageViewer from '../components/ImageViewer';
import Avatar from '../components/Avatar';
import {
  getListing,
  listComments,
  addComment,
  deleteComment,
  resolveContactMethods,
  getUserCard,
  updateListingStatus,
  removeListingByOwner,
  type MarketListing,
  type ListingComment,
  type UserCard,
} from '../services/marketService';

const { width: SCREEN_W } = Dimensions.get('window');
const HERO_H = Math.round(SCREEN_W * 0.78);

/**
 * Compact, username-style display for a commenter. Avoids showing a long
 * raw full name — uses the first name plus a last-name initial,
 * e.g. "Mohamed Atef Hassan" -> "Mohamed A.".
 */
function shortUserName(raw: string | null | undefined, isRTL: boolean): string {
  const name = (raw ?? '').trim();
  if (!name) return isRTL ? 'مستخدم' : 'User';
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (parts.length === 1) return first;
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return lastInitial ? `${first} ${lastInitial}.` : first;
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
  const [seller, setSeller] = useState<UserCard | null>(null);
  const [comments, setComments] = useState<ListingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<ListingComment | null>(null);
  const [marking, setMarking] = useState(false);

  const [photoIdx, setPhotoIdx] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const heroRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [l, c] = await Promise.all([getListing(id), listComments(id)]);
      setListing(l);
      setComments(c);
      if (l?.seller_id) {
        getUserCard(l.seller_id).then(setSeller).catch(() => undefined);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const styles = useMemo(() => createStyles(COLORS, isRTL), [COLORS, isRTL]);

  const isOwner = !!listing && listing.seller_id === user?.id;
  const isSold = listing?.status === 'sold';
  const isRemoved = listing?.status === 'archived';

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
        userProfile?.name ||
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
  const handleSendMessage = () => {
    if (!user) {
      Alert.alert(isRTL ? 'تسجيل الدخول مطلوب' : 'Login required');
      return;
    }
    if (!listing) return;
    router.push({
      pathname: '/market-chat',
      params: { listingId: listing.id, sellerId: listing.seller_id },
    });
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
  const handleMarkSold = () => {
    if (!listing) return;
    Alert.alert(
      isRTL ? 'تعليم كمباع' : 'Mark as sold',
      isRTL
        ? 'سيتم تعليم هذا الإعلان كمباع وإزالته من نتائج التصفّح.'
        : 'This listing will be marked as sold and removed from browse results.',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'تأكيد' : 'Confirm',
          onPress: async () => {
            setMarking(true);
            try {
              const updated = await updateListingStatus(listing.id, 'sold');
              setListing(updated);
            } catch (e: any) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
            } finally {
              setMarking(false);
            }
          },
        },
      ]
    );
  };

  const handleRemove = () => {
    if (!listing) return;
    Alert.alert(
      isRTL ? 'إزالة الإعلان' : 'Remove listing',
      isRTL
        ? 'سيتم إخفاء الإعلان من السوق فوراً. يمكنك إعادة نشره لاحقاً عبر الدعم إذا تغيّر رأيك.'
        : 'This listing will be hidden from the marketplace immediately. You can contact support to restore it later if you change your mind.',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'إزالة' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            setMarking(true);
            try {
              const updated = await removeListingByOwner(listing.id);
              setListing(updated);
              Alert.alert(
                isRTL ? 'تمت الإزالة' : 'Removed',
                isRTL ? 'تم إخفاء إعلانك من السوق.' : 'Your listing has been hidden from the marketplace.'
              );
              router.back();
            } catch (e: any) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
            } finally {
              setMarking(false);
            }
          },
        },
      ]
    );
  };

  const onHeroScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SCREEN_W);
    if (idx !== photoIdx) setPhotoIdx(idx);
  };

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const methods = listing ? resolveContactMethods(listing) : new Set<string>();
  const showPhone = methods.has('phone') && !!listing?.contact_phone;
  const showWhats = methods.has('whatsapp') && !!listing?.contact_phone;
  const showInApp = methods.has('in_app');

  const deviceLbl = listing?.device_type ? DEVICE_LABEL[listing.device_type]?.[isRTL ? 'ar' : 'en'] : null;
  const conditionLbl = listing?.condition ? CONDITION_LABEL[listing.condition]?.[isRTL ? 'ar' : 'en'] : null;
  const sellerName = seller?.name?.trim() || (isRTL ? 'بائع' : 'Seller');

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
            {/* Hero carousel — tap any image to open the full-screen viewer. */}
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
                    <TouchableOpacity
                      key={i}
                      activeOpacity={0.95}
                      onPress={() => openViewer(i)}
                    >
                      <Image
                        source={{ uri }}
                        style={{ width: SCREEN_W, height: HERO_H }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={250}
                        placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.heroCounter}>
                  <Ionicons name="images" size={11} color="#fff" />
                  <Text style={styles.heroCounterText}>
                    {photoIdx + 1} / {listing.images.length}
                  </Text>
                </View>
                <View style={styles.zoomHint} pointerEvents="none">
                  <Ionicons name="expand" size={12} color="#fff" />
                </View>
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
                {isSold && (
                  <View style={styles.soldOverlay}>
                    <View style={styles.soldBadge}>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.soldBadgeText}>تم البيع</Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={[styles.heroWrap, styles.heroPlaceholder, { backgroundColor: COLORS.card }]}>
                <MaterialCommunityIcons name="image-off" size={48} color={COLORS.textSecondary} />
              </View>
            )}

            <View style={styles.body}>
              <Text style={styles.listingTitle}>{listing.title}</Text>
              <Text style={styles.price}>
                {listing.price.toLocaleString(isRTL ? 'ar-SA' : 'en-US')} {isRTL ? 'ر.س' : listing.currency}
              </Text>

              {/* Chips: device / condition / city / posted */}
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
                  <View style={[styles.pill, { backgroundColor: COLORS.cardAlt }]}>
                    <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
                    <Text style={[styles.pillText, { color: COLORS.text }]}>{listing.city}</Text>
                  </View>
                ) : null}
                <View style={[styles.pill, { backgroundColor: COLORS.cardAlt }]}>
                  <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={[styles.pillText, { color: COLORS.text }]}>
                    {timeAgo(listing.created_at, isRTL)}
                  </Text>
                </View>
              </View>

              {/* Description — placed high so buyers read it before contact actions */}
              {listing.description ? (
                <>
                  <Text style={styles.blockLabel}>{isRTL ? 'الوصف' : 'Description'}</Text>
                  <View style={styles.infoCard}>
                    <Text style={styles.desc}>{listing.description}</Text>
                  </View>
                </>
              ) : null}

              {/* Seller card */}
              <Text style={styles.blockLabel}>{isRTL ? 'البائع' : 'Seller'}</Text>
              <View style={styles.sellerCard}>
                <View style={styles.sellerRow}>
                  <Avatar name={sellerName} uri={seller?.avatar_url} size={46} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sellerName} numberOfLines={1}>{sellerName}</Text>
                    <Text style={styles.sellerMeta}>
                      {isOwner
                        ? (isRTL ? 'هذا إعلانك' : 'This is your listing')
                        : (isRTL ? 'البائع' : 'Seller')}
                    </Text>
                  </View>
                  {!isOwner && showPhone && (
                    <Text style={styles.sellerPhone}>{listing.contact_phone}</Text>
                  )}
                </View>

                {isOwner ? (
                  isRemoved ? (
                    <View style={styles.soldInline}>
                      <Ionicons name="eye-off" size={16} color="#EF4444" />
                      <Text style={styles.soldInlineText}>
                        {isRTL ? 'تمت إزالة هذا الإعلان' : 'This listing was removed'}
                      </Text>
                    </View>
                  ) : isSold ? (
                    <View style={styles.soldInline}>
                      <Ionicons name="checkmark-circle" size={16} color="#EF4444" />
                      <Text style={styles.soldInlineText}>
                        {isRTL ? 'تم بيع هذا الإعلان' : 'This listing is sold'}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={[styles.markSoldBtn, { flex: 1, opacity: marking ? 0.6 : 1 }]}
                        onPress={handleMarkSold}
                        disabled={marking}
                      >
                        {marking ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-done" size={18} color="#fff" />
                            <Text style={styles.markSoldText}>
                              {isRTL ? 'تعليم كمباع' : 'Mark as Sold'}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.removeBtn, { opacity: marking ? 0.6 : 1 }]}
                        onPress={handleRemove}
                        disabled={marking}
                        accessibilityLabel={isRTL ? 'إزالة الإعلان' : 'Remove listing'}
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        <Text style={styles.removeBtnText}>
                          {isRTL ? 'إزالة' : 'Remove'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )
                ) : (
                  <View style={styles.contactRow}>
                    {showInApp && (
                      <TouchableOpacity
                        onPress={handleSendMessage}
                        style={[styles.contactBtn, { backgroundColor: COLORS.primary }]}
                      >
                        <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                        <Text style={styles.contactBtnText}>{isRTL ? 'إرسال رسالة' : 'Send Message'}</Text>
                      </TouchableOpacity>
                    )}
                    {showPhone && (
                      <TouchableOpacity
                        onPress={handleCallSeller}
                        style={[styles.contactBtn, { backgroundColor: '#10B981' }]}
                      >
                        <Ionicons name="call" size={18} color="#fff" />
                        <Text style={styles.contactBtnText}>{isRTL ? 'اتصال' : 'Call'}</Text>
                      </TouchableOpacity>
                    )}
                    {showWhats && (
                      <TouchableOpacity
                        onPress={handleWhatsAppSeller}
                        style={[styles.contactBtn, styles.contactBtnNarrow, { backgroundColor: '#25D366' }]}
                      >
                        <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              {/* Comments / Q&A */}
              <View style={[styles.section, styles.commentsSection]}>
                <Text style={styles.sectionTitle}>
                  {isRTL ? `الأسئلة والتعليقات (${comments.length})` : `Questions & Comments (${comments.length})`}
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
                            <Avatar name={c.author_name} size={32} />
                            <View style={{ flex: 1 }}>
                              <View style={styles.commentTopRow}>
                                <Text style={styles.commentAuthor}>
                                  {shortUserName(c.author_name, isRTL)}
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
                              <Avatar name={r.author_name} size={28} />
                              <View style={{ flex: 1 }}>
                                <View style={styles.commentTopRow}>
                                  <Text style={styles.commentAuthor}>
                                    {shortUserName(r.author_name, isRTL)}
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

          {/* Comment composer (sticky bottom) */}
          <View style={[styles.composer, { backgroundColor: COLORS.card, borderTopColor: COLORS.border }]}>
            {replyTo && (
              <View style={styles.replyBanner}>
                <Text style={[styles.replyBannerText, { color: COLORS.textSecondary }]} numberOfLines={1}>
                  {isRTL ? 'رد على' : 'Replying to'} {shortUserName(replyTo.author_name, isRTL)}
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
                placeholder={isRTL ? 'اكتب سؤالاً أو تعليقاً…' : 'Ask a question or comment…'}
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

      <ImageViewer
        visible={viewerOpen}
        images={listing?.images ?? []}
        initialIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
      />
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
    zoomHint: {
      position: 'absolute',
      top: 12,
      left: 12,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotsRow: {
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 5,
    },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
    soldOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(15,23,32,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    soldBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: '#DC2626',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 999,
    },
    soldBadgeText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

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

    blockLabel: {
      color: C.textSecondary,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginTop: 20,
      marginBottom: 8,
      textAlign: isRTL ? 'right' : 'left',
    },
    infoCard: {
      padding: 14,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
    },
    sellerCard: {
      padding: 14,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      gap: 12,
    },
    sellerRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 12,
    },
    sellerName: {
      color: C.text,
      fontWeight: '800',
      fontSize: 15,
      textAlign: isRTL ? 'right' : 'left',
    },
    sellerMeta: {
      color: C.textSecondary,
      fontSize: 12,
      marginTop: 2,
      textAlign: isRTL ? 'right' : 'left',
    },
    sellerPhone: { color: C.primary, fontWeight: '800', fontSize: 13 },

    contactRow: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 },
    contactBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: BORDER_RADIUS.md,
      flex: 1,
      justifyContent: 'center',
    },
    contactBtnNarrow: { flex: 0, paddingHorizontal: 16 },
    contactBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

    markSoldBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 13,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: '#EF4444',
    },
    markSoldText: { color: '#fff', fontWeight: '800', fontSize: 14 },
    removeBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: '#EF4444',
    },
    removeBtnText: { color: '#EF4444', fontWeight: '800', fontSize: 13 },
    soldInline: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: '#EF444415',
    },
    soldInlineText: { color: '#EF4444', fontWeight: '800', fontSize: 13 },

    section: { marginTop: 22, gap: 6 },
    commentsSection: {
      borderTopWidth: 1,
      borderTopColor: C.border,
      paddingTop: 18,
    },
    sectionTitle: { color: C.text, fontWeight: '800', fontSize: 15, textAlign: isRTL ? 'right' : 'left' },
    desc: { color: C.text, fontSize: 14, lineHeight: 22, textAlign: isRTL ? 'right' : 'left' },

    noComments: { color: C.textSecondary, fontStyle: 'italic', marginTop: 8, textAlign: isRTL ? 'right' : 'left' },
    commentRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    replyRow: { paddingLeft: isRTL ? 0 : 28, paddingRight: isRTL ? 28 : 0, borderBottomWidth: 0, paddingVertical: 8 },
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
