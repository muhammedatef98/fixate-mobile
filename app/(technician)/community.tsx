import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { RTLIonicon } from '../../components/RTLIcon';
import { logger } from '../../utils/logger';
import { buildCommentTree, type CommentSort } from '../../utils/buildCommentTree';
import { getUnreadCount } from '../../utils/notifications';
import { TECH_NAV_HEIGHT } from '../../components/BottomNavTech';

// Feed ordering for the post list.
type FeedSort = 'latest' | 'top';
import {
  listPosts,
  createPost,
  updatePost,
  toggleLike,
  listComments,
  addComment,
  toggleCommentLike,
  reportPost,
  deletePost,
  COMMUNITY_TAGS,
  type CommunityTag,
  type CommunityPost,
  type CommunityComment,
  type CommunityCommentNode,
} from '../../services/communityService';

// Tag filter chips shown above the feed ("الكل" + the four post tags).
const TAG_FILTERS: (CommunityTag | 'all')[] = ['all', ...COMMUNITY_TAGS];

const MAX_POST_LEN = 1000;
const MAX_INDENT_DEPTH = 4; // visual indent cap; nesting continues logically

const timeAgo = (iso: string, isRTL: boolean): string => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return isRTL ? 'الآن' : 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return isRTL ? `منذ ${m} د` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return isRTL ? `منذ ${h} ساعات` : `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return isRTL ? `منذ ${d} يوم` : `${d}d`;
  const w = Math.floor(d / 7);
  return isRTL ? `منذ ${w} أسبوع` : `${w}w`;
};

export default function CommunityScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const styles = makeStyles(COLORS, isRTL);
  const meId = user?.id ?? '';

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<CommunityTag | 'all'>('all');
  const [feedSort, setFeedSort] = useState<FeedSort>('latest');
  const [unreadCount, setUnreadCount] = useState(0);
  // RTL-correct opening position for the horizontal tag-filter row.
  const tagScrollRef = useRef<ScrollView>(null);

  // Inline post editing (author only)
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Create-post modal (opened by the FAB)
  const [composerOpen, setComposerOpen] = useState(false);
  const [content, setContent] = useState('');
  const [postTag, setPostTag] = useState<CommunityTag>('عام');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // Comments modal
  const [activePost, setActivePost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [sort, setSort] = useState<CommentSort>('newest');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    if (!meId) return;
    try {
      const [fresh, unread] = await Promise.all([listPosts(meId), getUnreadCount(meId)]);
      setPosts(fresh);
      setUnreadCount(unread);
    } catch (e) {
      logger.warn('community load failed', e);
    } finally {
      setLoading(false);
    }
  }, [meId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = posts.filter((p) => {
      if (tagFilter !== 'all' && p.tag !== tagFilter) return false;
      if (!q) return true;
      return p.content.toLowerCase().includes(q) || p.author_name.toLowerCase().includes(q);
    });
    // 'top' = most engaged (likes + comments); 'latest' = newest first.
    return [...list].sort((a, b) => {
      if (feedSort === 'top') {
        const ea = a.likes_count + a.comments_count;
        const eb = b.likes_count + b.comments_count;
        if (eb !== ea) return eb - ea;
      }
      return +new Date(b.created_at) - +new Date(a.created_at);
    });
  }, [posts, search, tagFilter, feedSort]);

  const commentTree = useMemo(() => buildCommentTree(comments, sort), [comments, sort]);

  // ── Create post ────────────────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(isRTL ? 'الإذن مطلوب' : 'Permission needed');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]?.uri) setImageUri(result.assets[0].uri);
  };

  const submitPost = async () => {
    if (!content.trim() || posting) return;
    setPosting(true);
    try {
      await createPost(meId, content, imageUri, postTag);
      setContent('');
      setPostTag('عام');
      setImageUri(null);
      setComposerOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert(isRTL ? 'تعذّر النشر' : 'Could not post', e?.message ?? String(e));
    } finally {
      setPosting(false);
    }
  };

  // ── Edit own post ────────────────────────────────────────────────────────
  const startEdit = (post: CommunityPost) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
  };

  const cancelEdit = () => {
    setEditingPostId(null);
    setEditContent('');
  };

  const saveEdit = async (post: CommunityPost) => {
    const trimmed = editContent.trim();
    if (!trimmed || savingEdit) return;
    setSavingEdit(true);
    try {
      await updatePost(post.id, { content: trimmed });
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, content: trimmed } : p)));
      cancelEdit();
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setSavingEdit(false);
    }
  };

  // Own-post overflow menu: edit / delete / cancel.
  const openOwnPostMenu = (post: CommunityPost) => {
    Alert.alert(
      isRTL ? 'خيارات المنشور' : 'Post options',
      undefined,
      [
        { text: isRTL ? 'تعديل المنشور' : 'Edit post', onPress: () => startEdit(post) },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: () => onDeletePost(post),
        },
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
      ]
    );
  };

  // ── Post like (optimistic) ──────────────────────────────────────────────
  const onTogglePostLike = async (post: CommunityPost) => {
    const liked = post.liked_by_me;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id ? { ...p, liked_by_me: !liked, likes_count: p.likes_count + (liked ? -1 : 1) } : p
      )
    );
    try {
      await toggleLike(meId, post.id, liked);
    } catch (e) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, liked_by_me: liked, likes_count: p.likes_count + (liked ? 1 : -1) } : p
        )
      );
      logger.warn('toggle post like failed', e);
    }
  };

  // ── Comments ────────────────────────────────────────────────────────────
  const openComments = async (post: CommunityPost) => {
    setActivePost(post);
    setComments([]);
    setReplyTo(null);
    setCollapsed(new Set());
    setCommentsLoading(true);
    try {
      setComments(await listComments(post.id, meId));
    } catch (e) {
      logger.warn('listComments failed', e);
    } finally {
      setCommentsLoading(false);
    }
  };

  const refreshComments = async (postId: string) => {
    const fresh = await listComments(postId, meId);
    setComments(fresh);
    const total = fresh.length;
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments_count: total } : p)));
    setActivePost((p) => (p ? { ...p, comments_count: total } : p));
  };

  const submitComment = async () => {
    if (!commentText.trim() || !activePost || sendingComment) return;
    setSendingComment(true);
    try {
      await addComment(meId, activePost.id, commentText, replyTo?.id ?? null);
      setCommentText('');
      setReplyTo(null);
      await refreshComments(activePost.id);
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
    } finally {
      setSendingComment(false);
    }
  };

  const onToggleCommentLike = async (c: CommunityComment) => {
    const liked = c.liked_by_me;
    setComments((prev) =>
      prev.map((x) =>
        x.id === c.id ? { ...x, liked_by_me: !liked, likes_count: x.likes_count + (liked ? -1 : 1) } : x
      )
    );
    try {
      await toggleCommentLike(meId, c.id, liked);
    } catch (e) {
      setComments((prev) =>
        prev.map((x) =>
          x.id === c.id ? { ...x, liked_by_me: liked, likes_count: x.likes_count + (liked ? 1 : -1) } : x
        )
      );
      logger.warn('toggle comment like failed', e);
    }
  };

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Post moderation ───────────────────────────────────────────────────--
  const onReport = (post: CommunityPost) => {
    Alert.alert(
      isRTL ? 'الإبلاغ عن منشور' : 'Report post',
      isRTL ? 'سيراجع فريق الإدارة هذا المنشور. هل تريد الإبلاغ عنه؟' : 'The admin team will review this post. Report it?',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'إبلاغ' : 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await reportPost(meId, post.id);
              Alert.alert(isRTL ? 'تم الإبلاغ' : 'Reported', isRTL ? 'شكراً لك.' : 'Thank you.');
            } catch (e: any) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
            }
          },
        },
      ]
    );
  };

  const onDeletePost = (post: CommunityPost) => {
    Alert.alert(
      isRTL ? 'حذف المنشور' : 'Delete post',
      isRTL ? 'سيتم حذف منشورك نهائياً.' : 'Your post will be permanently deleted.',
      [
        { text: isRTL ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isRTL ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePost(post.id);
              setPosts((prev) => prev.filter((p) => p.id !== post.id));
            } catch (e: any) {
              Alert.alert(isRTL ? 'خطأ' : 'Error', e?.message ?? String(e));
            }
          },
        },
      ]
    );
  };

  // ── Renderers ────────────────────────────────────────────────────────────
  const renderPost = ({ item }: { item: CommunityPost }) => {
    const mine = item.technician_id === meId;
    const editing = editingPostId === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.author_name || '؟').charAt(0)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.authorRow}>
              <Text style={styles.authorName} numberOfLines={1}>{item.author_name}</Text>
              {item.tag ? (
                <View style={styles.postTagPill}>
                  <Text style={styles.postTagPillText}>{item.tag}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.authorMeta} numberOfLines={1}>
              {[item.author_specialty, timeAgo(item.created_at, isRTL)].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => (mine ? openOwnPostMenu(item) : onReport(item))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={mine ? (isRTL ? 'خيارات' : 'Options') : (isRTL ? 'إبلاغ' : 'Report')}
          >
            <MaterialCommunityIcons
              name={mine ? 'dots-vertical' : 'flag-outline'}
              size={20}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {editing ? (
          <View style={styles.editWrap}>
            <TextInput
              style={styles.editInput}
              value={editContent}
              onChangeText={setEditContent}
              multiline
              maxLength={MAX_POST_LEN}
              autoFocus
            />
            <View style={styles.editActions}>
              <TouchableOpacity style={styles.editCancelBtn} onPress={cancelEdit} disabled={savingEdit}>
                <Text style={styles.editCancelText}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editSaveBtn, (!editContent.trim() || savingEdit) && { opacity: 0.5 }]}
                onPress={() => saveEdit(item)}
                disabled={!editContent.trim() || savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.editSaveText}>{isRTL ? 'حفظ' : 'Save'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={styles.postContent}>{item.content}</Text>
        )}
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.postImage} contentFit="cover" />
        ) : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onTogglePostLike(item)}>
            <Ionicons
              name={item.liked_by_me ? 'heart' : 'heart-outline'}
              size={20}
              color={item.liked_by_me ? '#EF4444' : COLORS.textSecondary}
            />
            <Text style={[styles.actionText, item.liked_by_me && { color: '#EF4444' }]}>{item.likes_count}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openComments(item)}>
            <Ionicons name="chatbubble-outline" size={19} color={COLORS.textSecondary} />
            <Text style={styles.actionText}>{item.comments_count}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Recursive threaded comment.
  const renderComment = (node: CommunityCommentNode, depth: number): React.ReactNode => {
    const indent = Math.min(depth, MAX_INDENT_DEPTH) * 14;
    const isCollapsed = collapsed.has(node.id);
    const hasReplies = node.replies.length > 0;
    return (
      <View key={node.id} style={{ [isRTL ? 'paddingRight' : 'paddingLeft']: indent }}>
        <View style={[styles.commentRow, depth > 0 && styles.commentThreadBorder]}>
          <View style={styles.commentAvatar}>
            <Text style={styles.avatarText}>{(node.author_name || '؟').charAt(0)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {/* Tap the header to collapse/expand this branch. */}
            <TouchableOpacity onPress={() => hasReplies && toggleCollapse(node.id)} activeOpacity={hasReplies ? 0.6 : 1}>
              <Text style={styles.commentAuthor}>
                {node.author_name}
                <Text style={styles.commentTime}>{`  ·  ${timeAgo(node.created_at, isRTL)}`}</Text>
                {hasReplies ? (
                  <Text style={styles.collapseHint}>
                    {`   ${isCollapsed ? '▸' : '▾'} ${node.replies.length}`}
                  </Text>
                ) : null}
              </Text>
            </TouchableOpacity>
            <Text style={styles.commentText}>{node.content}</Text>
            <View style={styles.commentActions}>
              <TouchableOpacity style={styles.commentActionBtn} onPress={() => onToggleCommentLike(node)}>
                <Ionicons
                  name={node.liked_by_me ? 'heart' : 'heart-outline'}
                  size={15}
                  color={node.liked_by_me ? '#EF4444' : COLORS.textSecondary}
                />
                <Text style={[styles.commentActionText, node.liked_by_me && { color: '#EF4444' }]}>
                  {node.likes_count > 0 ? node.likes_count : ''}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.commentActionBtn}
                onPress={() => setReplyTo({ id: node.id, name: node.author_name })}
              >
                <Ionicons name="return-down-back-outline" size={15} color={COLORS.textSecondary} />
                <Text style={styles.commentActionText}>{isRTL ? 'رد' : 'Reply'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {!isCollapsed && hasReplies && node.replies.map((child) => renderComment(child, depth + 1))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* Header */}
      <View style={styles.header}>
        <View style={{ width: 40 }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{isRTL ? 'مجتمع الفنيين' : 'Technician Community'}</Text>
          {!loading && (
            <Text style={styles.headerSubtitle}>
              {isRTL
                ? `${posts.length.toLocaleString('ar-SA')} منشور`
                : `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`}
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => router.push('/(technician)/notifications')}
          accessibilityRole="button"
          accessibilityLabel={isRTL ? 'الإشعارات' : 'Notifications'}
        >
          <Ionicons name="notifications-outline" size={22} color="#fff" />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={isRTL ? 'ابحث في المنشورات…' : 'Search posts…'}
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {/* Tag filter chips + feed sort */}
      <View style={styles.filterBarRow}>
        <ScrollView
          ref={tagScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          // RTL-correct: with row-reverse the first chip ("الكل") sits at the
          // right edge, but a horizontal ScrollView opens at offset 0 (left).
          // Jump to the content end on layout so the row opens on الكل/الأحدث.
          onContentSizeChange={() => {
            if (isRTL) tagScrollRef.current?.scrollToEnd({ animated: false });
          }}
          style={styles.tagFilterScroll}
          contentContainerStyle={[
            styles.tagFilterRow,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          {TAG_FILTERS.map((t) => {
            const active = tagFilter === t;
            return (
              <TouchableOpacity
                key={t}
                style={[styles.tagChip, active && styles.tagChipActive]}
                onPress={() => setTagFilter(t)}
                activeOpacity={0.85}
              >
                <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>
                  {t === 'all' ? (isRTL ? 'الكل' : 'All') : t}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Feed sort toggle */}
      <View style={styles.feedSortRow}>
        {(['latest', 'top'] as const).map((s) => {
          const active = feedSort === s;
          return (
            <TouchableOpacity
              key={s}
              style={[styles.feedSortChip, active && styles.feedSortChipActive]}
              onPress={() => setFeedSort(s)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={s === 'latest' ? 'time-outline' : 'flame-outline'}
                size={14}
                color={active ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={[styles.feedSortText, active && styles.feedSortTextActive]}>
                {s === 'latest' ? (isRTL ? 'الأحدث' : 'Latest') : (isRTL ? 'الأكثر تفاعلاً' : 'Top')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={filteredPosts}
          keyExtractor={(p) => p.id}
          renderItem={renderPost}
          contentContainerStyle={{ padding: SPACING.md, paddingBottom: TECH_NAV_HEIGHT + 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="forum-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {search.trim()
                  ? (isRTL ? 'لا نتائج للبحث' : 'No results')
                  : (isRTL ? 'لا توجد منشورات بعد. كن أول من يشارك!' : 'No posts yet. Be the first to share!')}
              </Text>
            </View>
          }
        />
      )}

      {/* FAB — create post (raised above the floating nav bar, labeled pill
          like the marketplace "Sell" button) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setComposerOpen(true)}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={isRTL ? 'إنشاء منشور' : 'Create post'}
      >
        <View style={styles.fabIconWrap}>
          <Ionicons name="add" size={18} color="#fff" />
        </View>
        <Text style={styles.fabText}>{isRTL ? 'منشور جديد' : 'New post'}</Text>
      </TouchableOpacity>

      {/* Create-post modal */}
      <Modal visible={composerOpen} animationType="slide" transparent onRequestClose={() => setComposerOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{isRTL ? 'إنشاء منشور' : 'Create post'}</Text>
              <TouchableOpacity onPress={() => setComposerOpen(false)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.composerInput}
              placeholder={isRTL ? 'شارك خبرة أو اطرح سؤالاً…' : 'Share a tip or ask a question…'}
              placeholderTextColor={COLORS.textSecondary}
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={MAX_POST_LEN}
              autoFocus
            />
            {imageUri ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: imageUri }} style={styles.preview} contentFit="cover" />
                <TouchableOpacity style={styles.previewRemove} onPress={() => setImageUri(null)}>
                  <Ionicons name="close" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Tag picker — choose one category for the post. */}
            <Text style={styles.composerTagLabel}>{isRTL ? 'التصنيف' : 'Category'}</Text>
            <View style={styles.composerTagRow}>
              {COMMUNITY_TAGS.map((t) => {
                const active = postTag === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tagChip, active && styles.tagChipActive]}
                    onPress={() => setPostTag(t)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.composerActions}>
              <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                <Ionicons name="image-outline" size={20} color={COLORS.primary} />
                <Text style={styles.imageBtnText}>{isRTL ? 'صورة' : 'Photo'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.postBtn, (!content.trim() || posting) && { opacity: 0.5 }]}
                onPress={submitPost}
                disabled={!content.trim() || posting}
              >
                {posting ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={styles.postBtnText}>{isRTL ? 'نشر' : 'Post'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Comments modal */}
      <Modal visible={!!activePost} animationType="slide" transparent onRequestClose={() => setActivePost(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isRTL ? `التعليقات (${activePost?.comments_count ?? 0})` : `Comments (${activePost?.comments_count ?? 0})`}
              </Text>
              <TouchableOpacity onPress={() => setActivePost(null)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {/* Sort toggle */}
            <View style={styles.sortRow}>
              {(['newest', 'most_liked'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sortChip, sort === s && { backgroundColor: COLORS.primary + '18', borderColor: COLORS.primary }]}
                  onPress={() => setSort(s)}
                >
                  <Text style={[styles.sortChipText, sort === s && { color: COLORS.primary, fontWeight: '800' }]}>
                    {s === 'newest' ? (isRTL ? 'الأحدث' : 'Newest') : (isRTL ? 'الأكثر تفاعلاً' : 'Most liked')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {commentsLoading ? (
              <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
            ) : (
              <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
                {commentTree.length === 0 ? (
                  <Text style={styles.noComments}>{isRTL ? 'لا توجد تعليقات بعد.' : 'No comments yet.'}</Text>
                ) : (
                  commentTree.map((node) => renderComment(node, 0))
                )}
              </ScrollView>
            )}

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              {replyTo && (
                <View style={styles.replyingBar}>
                  <Text style={styles.replyingText} numberOfLines={1}>
                    {isRTL ? `رد على @${replyTo.name}` : `Replying to @${replyTo.name}`}
                  </Text>
                  <TouchableOpacity onPress={() => setReplyTo(null)}>
                    <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.commentInputBar}>
                <TextInput
                  style={styles.commentInput}
                  placeholder={replyTo ? (isRTL ? 'اكتب ردك…' : 'Write a reply…') : (isRTL ? 'اكتب تعليقاً…' : 'Write a comment…')}
                  placeholderTextColor={COLORS.textSecondary}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.commentSend, (!commentText.trim() || sendingComment) && { opacity: 0.5 }]}
                  onPress={submitComment}
                  disabled={!commentText.trim() || sendingComment}
                >
                  <RTLIonicon name="send" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
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
    header: {
      backgroundColor: C.primary,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: 14,
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center' },
    headerSubtitle: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    bellBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    bellBadge: {
      position: 'absolute',
      top: 4,
      [isRTL ? 'left' : 'right']: 2,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: '#EF4444',
      borderWidth: 1.5,
      borderColor: C.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

    filterBarRow: { marginTop: SPACING.sm },
    tagFilterScroll: { maxHeight: 56 },
    // flexGrow lets the row fill the scroll width so the row-reverse chips pack
    // to the RIGHT edge (RTL) instead of bunching on the left when they fit.
    tagFilterRow: { flexGrow: 1, paddingHorizontal: SPACING.md, gap: 8, alignItems: 'center' },

    feedSortRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      gap: 8,
      paddingHorizontal: SPACING.md,
      marginTop: 4,
      marginBottom: 2,
    },
    feedSortChip: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      height: 32,
      borderRadius: 999,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
    },
    feedSortChipActive: { borderColor: C.primary, backgroundColor: C.primary + '12' },
    feedSortText: { color: C.textSecondary, fontWeight: '700', fontSize: 12.5 },
    feedSortTextActive: { color: C.primary, fontWeight: '800' },
    tagChip: {
      paddingHorizontal: 14,
      height: 34,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
      backgroundColor: C.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tagChipActive: { borderColor: C.primary, backgroundColor: C.primary + '15' },
    tagChipText: { color: C.textSecondary, fontWeight: '700', fontSize: 13 },
    tagChipTextActive: { color: C.primary, fontWeight: '800' },

    authorRow: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 },
    postTagPill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: C.primary + '15',
    },
    postTagPillText: { color: C.primary, fontSize: 10, fontWeight: '800' },

    editWrap: { marginTop: 12, gap: 10 },
    editInput: {
      minHeight: 80,
      maxHeight: 180,
      fontSize: 15,
      color: C.text,
      textAlign: isRTL ? 'right' : 'left',
      textAlignVertical: 'top',
      backgroundColor: C.background,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: C.border,
      padding: 12,
    },
    editActions: { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'flex-end', gap: 10 },
    editCancelBtn: {
      paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999,
      borderWidth: 1, borderColor: C.border,
    },
    editCancelText: { color: C.text, fontWeight: '700', fontSize: 13 },
    editSaveBtn: {
      paddingHorizontal: 22, paddingVertical: 9, borderRadius: 999,
      backgroundColor: C.primary, minWidth: 70, alignItems: 'center',
    },
    editSaveText: { color: '#fff', fontWeight: '800', fontSize: 13 },

    composerTagLabel: {
      color: C.textSecondary, fontWeight: '700', fontSize: 12,
      marginTop: 14, marginBottom: 8, textAlign: isRTL ? 'right' : 'left',
    },
    composerTagRow: { flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8 },

    searchBar: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: BORDER_RADIUS.md,
      marginHorizontal: SPACING.md,
      marginTop: SPACING.md,
      paddingHorizontal: 12,
      height: 44,
    },
    searchInput: { flex: 1, fontSize: 14, color: C.text, textAlign: isRTL ? 'right' : 'left' },

    card: {
      backgroundColor: C.card, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: C.border,
      padding: SPACING.md, marginBottom: SPACING.md,
    },
    cardHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 },
    avatar: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: C.primary + '22', alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: C.primary, fontWeight: '800', fontSize: 16 },
    authorName: { color: C.text, fontWeight: '800', fontSize: 14, textAlign: isRTL ? 'right' : 'left' },
    authorMeta: { color: C.textSecondary, fontSize: 12, marginTop: 1, textAlign: isRTL ? 'right' : 'left' },
    postContent: { color: C.text, fontSize: 15, lineHeight: 22, marginTop: 12, textAlign: isRTL ? 'right' : 'left' },
    postImage: { width: '100%', height: 200, borderRadius: BORDER_RADIUS.md, marginTop: 12 },
    actionsRow: {
      flexDirection: isRTL ? 'row-reverse' : 'row', gap: 22, marginTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingTop: 12,
    },
    actionBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 },
    actionText: { color: C.textSecondary, fontWeight: '700', fontSize: 13 },

    empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
    emptyText: { color: C.textSecondary, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },

    fab: {
      position: 'absolute',
      // Sit clear above the floating technician nav bar (was hidden behind it).
      bottom: TECH_NAV_HEIGHT + 14,
      [isRTL ? 'left' : 'right']: 18,
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 16,
      paddingVertical: 11,
      borderRadius: 999,
      backgroundColor: C.primary,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.35)',
      shadowColor: C.primary,
      shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16,
      elevation: 10,
    },
    fabIconWrap: {
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center', justifyContent: 'center',
    },
    fabText: { color: '#fff', fontWeight: '900', fontSize: 13.5, letterSpacing: 0.3 },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: C.background, borderTopLeftRadius: 22, borderTopRightRadius: 22,
      paddingHorizontal: SPACING.md, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 10 },
    modalHeader: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    modalTitle: { color: C.text, fontWeight: '800', fontSize: 16 },

    composerInput: {
      minHeight: 90, maxHeight: 180, fontSize: 15, color: C.text,
      textAlign: isRTL ? 'right' : 'left', textAlignVertical: 'top',
      backgroundColor: C.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: C.border,
      padding: 12, marginTop: 4,
    },
    previewWrap: { marginTop: 10, alignSelf: isRTL ? 'flex-end' : 'flex-start' },
    preview: { width: 110, height: 110, borderRadius: BORDER_RADIUS.md },
    previewRemove: {
      position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
    },
    composerActions: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
    imageBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 },
    imageBtnText: { color: C.primary, fontWeight: '700', fontSize: 13 },
    postBtn: { backgroundColor: C.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 999, minWidth: 76, alignItems: 'center' },
    postBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

    sortRow: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, marginBottom: 10 },
    sortChip: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
      borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    },
    sortChipText: { color: C.textSecondary, fontWeight: '700', fontSize: 12 },

    noComments: { color: C.textSecondary, textAlign: 'center', paddingVertical: 24 },
    commentRow: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 10, paddingVertical: 8 },
    commentThreadBorder: {
      [isRTL ? 'borderRightWidth' : 'borderLeftWidth']: 1.5,
      borderColor: C.border,
      [isRTL ? 'paddingRight' : 'paddingLeft']: 8,
    },
    commentAvatar: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: C.primary + '22', alignItems: 'center', justifyContent: 'center',
    },
    commentAuthor: { color: C.text, fontWeight: '700', fontSize: 13, textAlign: isRTL ? 'right' : 'left' },
    commentTime: { color: C.textSecondary, fontWeight: '500', fontSize: 11 },
    collapseHint: { color: C.primary, fontWeight: '700', fontSize: 11 },
    commentText: { color: C.text, fontSize: 14, lineHeight: 20, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    commentActions: { flexDirection: isRTL ? 'row-reverse' : 'row', gap: 18, marginTop: 6 },
    commentActionBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 },
    commentActionText: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },

    replyingBar: {
      flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.primary + '12', borderRadius: BORDER_RADIUS.sm, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 6,
    },
    replyingText: { color: C.primary, fontWeight: '700', fontSize: 12, flex: 1, textAlign: isRTL ? 'right' : 'left' },
    commentInputBar: {
      flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, marginTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border, paddingTop: 10,
    },
    commentInput: {
      flex: 1, maxHeight: 100, minHeight: 42,
      backgroundColor: C.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: C.border,
      paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, fontSize: 14, color: C.text, textAlign: isRTL ? 'right' : 'left',
    },
    commentSend: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  });
