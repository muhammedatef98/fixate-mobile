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
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { RTLIonicon } from '../components/RTLIcon';
import {
  getListing,
  listComments,
  addComment,
  type MarketListing,
  type ListingComment,
} from '../services/marketService';

const { width } = Dimensions.get('window');

export default function MarketDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = createStyles(COLORS, isRTL);

  const [listing, setListing] = useState<MarketListing | null>(null);
  const [comments, setComments] = useState<ListingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

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
      await addComment(id, user.id, text);
      setCommentText('');
      setComments(await listComments(id));
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setPosting(false);
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
            {listing.images && listing.images.length > 0 ? (
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                {listing.images.map((uri, i) => (
                  <Image key={i} source={{ uri }} style={{ width, height: width * 0.75 }} resizeMode="cover" />
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.noImg, { width, height: width * 0.6 }]}>
                <MaterialCommunityIcons name="image-off" size={48} color={COLORS.textSecondary} />
              </View>
            )}

            <View style={{ padding: SPACING.lg, gap: 10 }}>
              <Text style={styles.listingTitle}>{listing.title}</Text>
              <Text style={styles.price}>{listing.price} {listing.currency}</Text>
              <View style={styles.metaRow}>
                {listing.city ? (
                  <View style={styles.metaPill}>
                    <Ionicons name="location-outline" size={13} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>{listing.city}</Text>
                  </View>
                ) : null}
                {listing.contact_phone ? (
                  <View style={styles.metaPill}>
                    <Ionicons name="call-outline" size={13} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>{listing.contact_phone}</Text>
                  </View>
                ) : null}
              </View>
              {listing.description ? (
                <Text style={styles.desc}>{listing.description}</Text>
              ) : null}
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
                comments.map((c) => (
                  <View key={c.id} style={styles.commentRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(c.author_name || '?').slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentAuthor}>
                        {c.author_name || (isRTL ? 'مستخدم' : 'User')}
                      </Text>
                      <Text style={styles.commentText}>{c.content}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          <View style={styles.commentBar}>
            <TextInput
              style={styles.commentInput}
              placeholder={isRTL ? 'اكتب تعليقاً...' : 'Write a comment...'}
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
  });
