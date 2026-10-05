import React from 'react';
import {
  Modal,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/**
 * Lightweight, dependency-free in-app image viewer.
 * - Black backdrop with a top-right close button.
 * - Pinch-to-zoom via the native ScrollView's maximumZoomScale (iOS) and
 *   minimumZoomScale=1 (Android falls back to single-finger pan; we don't
 *   ship a separate gesture library to keep the bundle slim).
 * - Optional horizontal swipe between multiple images.
 */
interface Props {
  visible: boolean;
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}

export default function ImageViewer({ visible, images, initialIndex = 0, onClose }: Props) {
  const scrollRef = React.useRef<ScrollView>(null);
  const [active, setActive] = React.useState(initialIndex);

  React.useEffect(() => {
    if (visible) {
      setActive(initialIndex);
      // Wait for layout, then scroll to the right page
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: initialIndex * SCREEN_W, animated: false });
      }, 30);
    }
  }, [visible, initialIndex]);

  if (!images.length) return null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.backdrop}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
            setActive(i);
          }}
        >
          {images.map((uri, i) => (
            <ScrollView
              key={i}
              maximumZoomScale={4}
              minimumZoomScale={1}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              centerContent
              contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
              style={{ width: SCREEN_W, height: SCREEN_H, flex: 1 }}
            >
              <TouchableWithoutFeedback onPress={onClose}>
                <View style={{ width: SCREEN_W, height: SCREEN_H }}>
                  <Image
                    source={{ uri: typeof uri === 'string' ? uri : (uri as any)?.url ?? (uri as any)?.uri }}
                    style={{ width: SCREEN_W, height: SCREEN_H, resizeMode: 'contain' }}
                  />
                </View>
              </TouchableWithoutFeedback>
            </ScrollView>
          ))}
        </ScrollView>

        {/* Close button */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {images.length > 1 && (
            <View style={styles.counter}>
              <Ionicons name="image-outline" size={14} color="#fff" />
              <View style={{ width: 6 }} />
            </View>
          )}
        </View>

        {/* Page indicator */}
        {images.length > 1 && (
          <View style={styles.dots}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: i === active ? '#fff' : '#ffffff55' }]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00000088',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00000088',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dots: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
