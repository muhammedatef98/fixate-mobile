import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { SPACING, BORDER_RADIUS } from '../constants/theme';
import { listActiveSuppliers, type SpareSupplier } from '../services/spareSuppliersService';
import { toWhatsAppPhone } from '../utils/validation';
import GearLoader from './GearLoader';

interface Props {
  visible: boolean;
  onClose: () => void;
  isRTL: boolean;
  COLORS: any;
  deviceBrand?: string | null;
  deviceModel?: string | null;
  issueDescription?: string | null;
}

/**
 * Technician spare-part request sheet (§12). Lists active suppliers and opens
 * WhatsApp pre-filled with the device + issue, falling back to wa.me and then
 * the phone dialer when WhatsApp isn't installed.
 */
export default function SparePartRequestSheet({
  visible,
  onClose,
  isRTL,
  COLORS,
  deviceBrand,
  deviceModel,
  issueDescription,
}: Props) {
  const [suppliers, setSuppliers] = useState<SpareSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const styles = makeStyles(COLORS, isRTL);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    listActiveSuppliers()
      .then(setSuppliers)
      .finally(() => setLoading(false));
  }, [visible]);

  const buildMessage = (): string => {
    const device = [deviceBrand, deviceModel].filter(Boolean).join(' ').trim() || (isRTL ? 'جهاز' : 'device');
    const issue = (issueDescription ?? '').trim();
    const base = isRTL
      ? `مرحباً، أحتاج قطعة غيار لإصلاح: ${device}`
      : `Hello, I need a spare part to repair: ${device}`;
    return issue ? `${base} - ${issue}` : base;
  };

  const contactSupplier = async (s: SpareSupplier) => {
    const phone = toWhatsAppPhone(s.whatsapp_number);
    const text = encodeURIComponent(buildMessage());
    const waApp = `whatsapp://send?phone=${phone}&text=${text}`;
    const waWeb = `https://wa.me/${phone}?text=${text}`;
    try {
      const supported = await Linking.canOpenURL(waApp);
      if (supported) {
        await Linking.openURL(waApp);
        return;
      }
    } catch {
      // fall through
    }
    // wa.me opens WhatsApp on most devices and the web client otherwise.
    try {
      await Linking.openURL(waWeb);
      return;
    } catch {
      // last resort: dial the number
    }
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={styles.title}>{isRTL ? 'طلب قطعة غيار' : 'Request a spare part'}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={isRTL ? 'إغلاق' : 'Close'}>
              <Ionicons name="close" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            {isRTL ? 'اختر مورّداً للتواصل عبر واتساب' : 'Pick a supplier to message on WhatsApp'}
          </Text>

          {loading ? (
            <GearLoader size={48} style={{ marginVertical: 30 }} />
          ) : suppliers.length === 0 ? (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="truck-remove-outline" size={40} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {isRTL ? 'لا يوجد موردون متاحون حالياً' : 'No suppliers available right now'}
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {suppliers.map((s) => (
                <View key={s.id} style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                    {!!s.specialty && <Text style={styles.specialty} numberOfLines={1}>{s.specialty}</Text>}
                  </View>
                  <TouchableOpacity
                    style={styles.waBtn}
                    onPress={() => contactSupplier(s)}
                    accessibilityRole="button"
                    accessibilityLabel={isRTL ? 'تواصل عبر واتساب' : 'Contact on WhatsApp'}
                  >
                    <MaterialCommunityIcons name="whatsapp" size={18} color="#fff" />
                    <Text style={styles.waBtnText}>{isRTL ? 'واتساب' : 'WhatsApp'}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (C: any, isRTL: boolean) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: C.card,
      borderTopLeftRadius: BORDER_RADIUS.xl,
      borderTopRightRadius: BORDER_RADIUS.xl,
      padding: SPACING.lg,
      paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.lg,
    },
    header: { alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 18, fontWeight: '800', color: C.text, textAlign: isRTL ? 'right' : 'left' },
    subtitle: { fontSize: 12.5, color: C.textSecondary, marginTop: 4, marginBottom: 14, textAlign: isRTL ? 'right' : 'left' },
    empty: { alignItems: 'center', paddingVertical: 30, gap: 10 },
    emptyText: { color: C.textSecondary, fontSize: 13.5, textAlign: 'center' },
    row: {
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.border,
    },
    name: { fontSize: 15, fontWeight: '700', color: C.text, textAlign: isRTL ? 'right' : 'left' },
    specialty: { fontSize: 12, color: C.textSecondary, marginTop: 2, textAlign: isRTL ? 'right' : 'left' },
    waBtn: {
      flexDirection: isRTL ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#25D366',
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
    },
    waBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  });
