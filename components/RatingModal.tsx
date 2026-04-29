import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { submitReview } from '../services/reviewService';
import { getFriendlyError } from '../utils/errorMessages';
import { success, selection } from '../utils/haptics';

interface Props {
  visible: boolean;
  orderId: string;
  technicianId: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

const RATING_LABELS_AR = ['سيء جداً', 'سيء', 'مقبول', 'جيد', 'ممتاز'];
const RATING_LABELS_EN = ['Awful', 'Bad', 'Okay', 'Good', 'Excellent'];

export default function RatingModal({ visible, orderId, technicianId, onClose, onSubmitted }: Props) {
  const { language, isDark } = useApp();
  const { user } = useAuth();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleStar = (value: number) => {
    selection();
    setRating(value);
  };

  const handleSubmit = async () => {
    if (!user?.id || rating < 1) return;
    setSubmitting(true);
    try {
      await submitReview(orderId, user.id, technicianId, rating, comment);
      success();
      onSubmitted?.();
      onClose();
      setRating(0);
      setComment('');
    } catch (e: any) {
      Alert.alert(isRTL ? 'خطأ' : 'Error', getFriendlyError(e, language));
    } finally {
      setSubmitting(false);
    }
  };

  const labels = isRTL ? RATING_LABELS_AR : RATING_LABELS_EN;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={[styles.card, { backgroundColor: COLORS.card }]}>
          <View style={[styles.iconCircle, { backgroundColor: COLORS.primary + '20' }]}>
            <Ionicons name="checkmark-circle" size={36} color={COLORS.primary} />
          </View>
          <Text style={[styles.title, { color: COLORS.text }]}>
            {isRTL ? 'تم إكمال طلبك!' : 'Order completed!'}
          </Text>
          <Text style={[styles.subtitle, { color: COLORS.textSecondary }]}>
            {isRTL ? 'كيف كانت تجربتك مع الفني؟' : 'How was your experience?'}
          </Text>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((v) => (
              <TouchableOpacity
                key={v}
                onPress={() => handleStar(v)}
                accessibilityRole="button"
                accessibilityLabel={`${v} ${isRTL ? 'نجوم' : 'stars'}`}
                accessibilityState={{ selected: rating === v }}
              >
                <Ionicons
                  name={v <= rating ? 'star' : 'star-outline'}
                  size={40}
                  color={v <= rating ? '#F59E0B' : COLORS.border}
                />
              </TouchableOpacity>
            ))}
          </View>

          {rating > 0 && (
            <Text style={[styles.label, { color: COLORS.text }]}>{labels[rating - 1]}</Text>
          )}

          <TextInput
            value={comment}
            onChangeText={setComment}
            multiline
            placeholder={isRTL ? 'تعليقك (اختياري)' : 'Comment (optional)'}
            placeholderTextColor={COLORS.textSecondary}
            style={[styles.input, { color: COLORS.text, borderColor: COLORS.border }]}
            textAlign={isRTL ? 'right' : 'left'}
          />

          <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.btn, { backgroundColor: COLORS.border }]}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'لاحقاً' : 'Later'}
            >
              <Text style={{ color: COLORS.text, fontWeight: '600' }}>{isRTL ? 'لاحقاً' : 'Later'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={rating < 1 || submitting}
              style={[styles.btn, { backgroundColor: COLORS.primary, opacity: rating < 1 || submitting ? 0.5 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel={isRTL ? 'إرسال التقييم' : 'Submit review'}
              accessibilityState={{ disabled: rating < 1 || submitting }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '600' }}>{isRTL ? 'إرسال' : 'Submit'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center' },
  stars: { flexDirection: 'row', gap: 6, marginVertical: 8 },
  label: { fontSize: 16, fontWeight: '600' },
  input: {
    width: '100%',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    minHeight: 80,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  actions: { width: '100%', gap: SPACING.md },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
});
