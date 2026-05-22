import React, { useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';

interface ImagePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (source: 'camera' | 'gallery') => void;
  isRTL?: boolean;
}

/**
 * Bottom-sheet that lets the user choose between the camera and the photo
 * library. The host screen does the actual `expo-image-picker` call in
 * `onPick` so permission handling stays close to where images are used.
 */
export default function ImagePickerSheet({
  visible,
  onClose,
  onPick,
  isRTL = false,
}: ImagePickerSheetProps) {
  const { isDark } = useApp();
  const COLORS = getColors(isDark);
  const styles = createStyles(COLORS, isRTL);

  // Holds the chosen source until the sheet has FULLY dismissed. Presenting
  // the native picker while this modal is still on screen makes it silently
  // fail on iOS, so we wait for a real dismissal signal instead of guessing
  // with a fixed timeout.
  const pendingRef = useRef<'camera' | 'gallery' | null>(null);

  const runPending = () => {
    const source = pendingRef.current;
    pendingRef.current = null;
    if (source) onPick(source);
  };

  const choose = (source: 'camera' | 'gallery') => {
    pendingRef.current = source;
    onClose();
    if (Platform.OS === 'android') {
      // Android has no `onDismiss` for Modal and no single-presentation
      // restriction — a short delay after closing is reliable here.
      setTimeout(runPending, 220);
    }
    // iOS: handled by the Modal `onDismiss` callback below, which fires
    // only once the sheet is genuinely off screen.
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      onDismiss={Platform.OS === 'ios' ? runPending : undefined}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>
            {isRTL ? 'إضافة صورة' : 'Add a photo'}
          </Text>

          <TouchableOpacity
            style={styles.option}
            onPress={() => choose('camera')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: COLORS.primary + '18' }]}>
              <Ionicons name="camera" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.optionText}>
              {isRTL ? 'التقاط صورة' : 'Take a photo'}
            </Text>
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={18}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.option}
            onPress={() => choose('gallery')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: '#3B82F6' + '18' }]}>
              <Ionicons name="images" size={22} color="#3B82F6" />
            </View>
            <Text style={styles.optionText}>
              {isRTL ? 'الاختيار من المعرض' : 'Choose from gallery'}
            </Text>
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={18}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>{isRTL ? 'إلغاء' : 'Cancel'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (C: ReturnType<typeof getColors>, isRTL: boolean) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: C.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: C.card,
      borderTopLeftRadius: BORDER_RADIUS.xxl,
      borderTopRightRadius: BORDER_RADIUS.xxl,
      paddingHorizontal: SPACING.lg,
      paddingTop: 8,
      paddingBottom: 28,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: C.borderStrong,
      alignSelf: 'center',
      marginBottom: 14,
    },
    title: {
      fontSize: 16,
      fontWeight: '800',
      color: C.text,
      marginBottom: 12,
      textAlign: isRTL ? 'right' : 'left',
    },
    option: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700',
      color: C.text,
      textAlign: isRTL ? 'right' : 'left',
    },
    cancel: {
      marginTop: 16,
      paddingVertical: 14,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: C.cardAlt,
      alignItems: 'center',
    },
    cancelText: { fontSize: 15, fontWeight: '700', color: C.text },
  });
