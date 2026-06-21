import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useIsAdmin } from '../hooks/useAdminGuard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { AnimatedBackButton } from '../components/AnimatedBackButton';
import { formatAppDateOnly } from '../lib/formatDate';
import { logger } from '../utils/logger';
import {
  adminListPosts,
  listComments,
  deletePost,
  deleteComment,
  type CommunityPost,
  type CommunityComment,
} from '../services/communityService';

export default function AdminCommunityScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const { isAdmin } = useIsAdmin();
  const styles = makeStyles(COLORS, isRTL);

  const [tab, setTab] = useState<'all' | 'reported'>('all');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activePost, setActivePost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    try {
      setPosts(await adminListPosts(tab === 'reported'));
    } catch (e) {
      logger.warn('admin community load failed', e);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, tab]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onDeletePost = (post: CommunityPost) => {
    Alert.alert(
      isRTL ? 'حذف المنشور' : 'Delete post',
      isRTL ? 'سيتم حذف المنشور وكل تعليقاته نهائياً.' : 'The post and all its comments will be permanently deleted.',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePost(post.id);
              setPosts((prev) => prev.filter((p) => p.id !== post.id));
              if (activePost?.id === post.id) setActivePost(null);
            } catch (e: any) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
            }
          },
        },
      ]
    );
  };

  const openComments = async (post: CommunityPost) => {
    setActivePost(post);
    setComments([]);
    setCommentsLoading(true);
    try {
      // No viewer id needed for the admin moderation view (no per-user likes).
      setComments(await listComments(post.id, ''));
    } catch (e) {
      logger.warn('admin listComments failed', e);
    } finally {
      setCommentsLoading(false);
    }
  };

  const onDeleteComment = (c: CommunityComment) => {
    Alert.alert(
      isRTL ? 'حذف التعليق' : 'Delete comment',
      isRTL ? 'سيتم حذف هذا التعليق نهائياً.' : 'This comment will be permanently deleted.',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteComment(c.id);
              setComments((prev) => prev.filter((x) => x.id !== c.id));
              setPosts((prev) =>
                prev.map((p) =>
                  p.id === c.post_id ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p
                )
              );
            } catch (e: any) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
            }
          },
        },
      ]
    );
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <MaterialCommunityIcons name="lock-outline" size={48} color={COLORS.textSecondary} />
          <Text style={[styles.muted, { marginTop: 8 }]}>
            {isRTL ? 'هذه الصفحة للمشرفين فقط' : 'Admins only'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderPost = ({ item }: { item: CommunityPost }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.author} numberOfLines={1}>{item.author_name}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[item.author_specialty, formatAppDateOnly(item.created_at, isRTL)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {item.report_count > 0 && (
          <View style={styles.reportBadge}>
            <Ionicons name="flag" size={12} color="#fff" />
            <Text style={styles.reportBadgeText}>{item.report_count}</Text>
          </View>
        )}
        <TouchableOpacity onPress={() => onDeletePost(item)} style={styles.deleteBtn}>
          <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <Text style={styles.content}>{item.content}</Text>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.image} contentFit="cover" />
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Ionicons name="heart-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.statText}>{item.likes_count}</Text>
        </View>
        <TouchableOpacity style={styles.stat} onPress={() => openComments(item)}>
          <Ionicons name="chatbubble-outline" size={15} color={COLORS.primary} />
          <Text style={[styles.statText, { color: COLORS.primary }]}>
            {isRTL ? `التعليقات (${item.comments_count})` : `Comments (${item.comments_count})`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <AnimatedBackButton
          onPress={() => router.back()}
          color={COLORS.text}
          backgroundColor={COLORS.surface ?? COLORS.background}
          size={42}
          iconSize={22}
          rtl
        />
        <Text style={styles.headerTitle}>{isRTL ? 'مجتمع الفنيين' : 'Community'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.tabs}>
        {(['all', 'reported'] as const).map((k) => {
          const active = tab === k;
          const label =
            k === 'all' ? (isRTL ? 'كل المنشورات' : 'All posts') : (isRTL ? 'المُبلَّغ عنها' : 'Reported');
          return (
            <TouchableOpacity
              key={k}
              style={[styles.tab, active && { backgroundColor: COLORS.primary }]}
              onPress={() => setTab(k)}
            >
              <Text style={[styles.tabText, { color: active ? '#fff' : COLORS.textSecondary }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={renderPost}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <MaterialCommunityIcons name="forum-outline" size={44} color={COLORS.textSecondary} />
              <Text style={[styles.muted, { marginTop: 8 }]}>
                {tab === 'reported'
                  ? (isRTL ? 'لا توجد منشورات مُبلَّغ عنها' : 'No reported posts')
                  : (isRTL ? 'لا توجد منشورات' : 'No posts')}
              </Text>
            </View>
          }
        />
      )}

      {/* Comments moderation modal */}
      <Modal visible={!!activePost} animationType="slide" transparent onRequestClose={() => setActivePost(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isRTL ? 'التعليقات' : 'Comments'}</Text>
              <TouchableOpacity onPress={() => setActivePost(null)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {commentsLoading ? (
              <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                {comments.length === 0 ? (
                  <Text style={[styles.muted, { textAlign: 'center', paddingVertical: 24 }]}>
                    {isRTL ? 'لا توجد تعليقات.' : 'No comments.'}
                  </Text>
                ) : (
                  comments.map((c) => (
                    <View key={c.id} style={styles.commentRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.commentAuthor} numberOfLines={1}>{c.author_name}</Text>
                        <Text style={styles.commentText}>{c.content}</Text>
                      </View>
                      <TouchableOpacity onPress={() => onDeleteComment(c)} style={styles.deleteBtn}>
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    muted: { color: C.textSecondary, fontSize: 14, textAlign: 'center' },
    header: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: 12,
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: C.text },
    tabs: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      paddingHorizontal: SPACING.md,
      paddingBottom: 10,
    },
    tab: {
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    tabText: { fontWeight: '700', fontSize: 13 },

    card: {
      backgroundColor: C.card, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: C.border,
      padding: SPACING.md, marginBottom: SPACING.md,
    },
    cardHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 },
    author: { color: C.text, fontWeight: '800', fontSize: 14, textAlign: isRTL ? 'right' : 'left' },
    meta: { color: C.textSecondary, fontSize: 12, marginTop: 1, textAlign: isRTL ? 'right' : 'left' },
    reportBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    },
    reportBadgeText: { color: '#fff', fontWeight: '800', fontSize: 11 },
    deleteBtn: { padding: 4 },
    content: { color: C.text, fontSize: 15, lineHeight: 22, marginTop: 10, textAlign: isRTL ? 'right' : 'left' },
    image: { width: '100%', height: 180, borderRadius: BORDER_RADIUS.md, marginTop: 10 },
    statsRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row', gap: 20, marginTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingTop: 10,
    },
    stat: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 5 },
    statText: { color: C.textSecondary, fontWeight: '700', fontSize: 13 },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: C.background, borderTopLeftRadius: 22, borderTopRightRadius: 22,
      paddingHorizontal: SPACING.md, paddingTop: 10, paddingBottom: 24,
    },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 10 },
    modalHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    modalTitle: { color: C.text, fontWeight: '800', fontSize: 16 },
    commentRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border,
    },
    commentAuthor: { color: C.text, fontWeight: '700', fontSize: 13, textAlign: isRTL ? 'right' : 'left' },
    commentText: { color: C.text, fontSize: 14, lineHeight: 20, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
  });
