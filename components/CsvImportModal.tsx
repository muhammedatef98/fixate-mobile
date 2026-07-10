import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { getColors, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { csvToObjects } from '../utils/csv';
import type { ImportResult } from '../services/pricingRegistryService';
import { logger } from '../utils/logger';

/**
 * Paste-CSV importer (§5). Excel/Sheets → export as CSV → paste (or tap "Paste
 * from clipboard"). Shows the expected header, a live parsed-row count, then
 * imports via the injected handler. CSV-first, no native file-picker dep; the
 * same parsed-object shape accepts an .xlsx→CSV export cleanly.
 */
interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  headerLine: string;
  sampleLine: string;
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>;
  onDone: () => void;
}

export default function CsvImportModal({
  visible,
  onClose,
  title,
  headerLine,
  sampleLine,
  onImport,
  onDone,
}: Props) {
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';
  const s = makeStyles(COLORS, isRTL);

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parsed = text.trim() ? csvToObjects(text) : [];

  const reset = () => {
    setText('');
    setResult(null);
  };

  const paste = async () => {
    try {
      const clip = await Clipboard.getStringAsync();
      if (clip) setText((prev) => (prev ? prev + '\n' + clip : clip));
    } catch (e) {
      logger.warn('clipboard paste failed', e);
    }
  };

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const res = await onImport(parsed);
      setResult(res);
      if (res.inserted > 0) onDone();
    } catch (e) {
      logger.warn('csv import failed', e);
      setResult({ inserted: 0, skipped: parsed.length, errors: [String((e as Error)?.message ?? e)] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.wrap}>
        <View style={s.card}>
          <View style={s.header}>
            <Text style={s.title}>{title}</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={s.hint}>
              {isRTL
                ? 'صدّر جدول Excel كـ CSV ثم الصقه هنا. الصف الأول يجب أن يكون العناوين:'
                : 'Export your Excel sheet as CSV and paste it here. The first row must be the headers:'}
            </Text>
            <View style={s.codeBox}>
              <Text style={s.code}>{headerLine}</Text>
              <Text style={[s.code, { color: COLORS.textSecondary }]}>{sampleLine}</Text>
            </View>

            <TouchableOpacity style={s.pasteBtn} onPress={paste} accessibilityRole="button">
              <MaterialCommunityIcons name="clipboard-arrow-down-outline" size={18} color={COLORS.primary} />
              <Text style={s.pasteText}>{isRTL ? 'لصق من الحافظة' : 'Paste from clipboard'}</Text>
            </TouchableOpacity>

            <TextInput
              style={s.input}
              value={text}
              onChangeText={setText}
              multiline
              placeholder={isRTL ? 'الصق بيانات CSV هنا…' : 'Paste CSV data here…'}
              placeholderTextColor="#9AA0A6"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={s.count}>
              {isRTL ? `عدد الصفوف الصالحة: ${parsed.length}` : `Parsed rows: ${parsed.length}`}
            </Text>

            {result && (
              <View style={[s.resultBox, { borderColor: result.inserted > 0 ? '#10B981' : '#EF4444' }]}>
                <Text style={{ color: COLORS.text, fontWeight: '700' }}>
                  {isRTL
                    ? `تم استيراد ${result.inserted} · تم تخطي ${result.skipped}`
                    : `Imported ${result.inserted} · Skipped ${result.skipped}`}
                </Text>
                {result.errors.slice(0, 6).map((e, i) => (
                  <Text key={i} style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>{e}</Text>
                ))}
                {result.errors.length > 6 && (
                  <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4 }}>
                    {isRTL ? `و${result.errors.length - 6} أخطاء أخرى` : `and ${result.errors.length - 6} more`}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>

          <View style={s.actions}>
            <TouchableOpacity style={[s.btn, { backgroundColor: COLORS.border }]} onPress={() => { reset(); onClose(); }}>
              <Text style={{ color: COLORS.text, fontWeight: '700' }}>{isRTL ? 'إغلاق' : 'Close'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, { backgroundColor: COLORS.primary, opacity: parsed.length === 0 || busy ? 0.5 : 1 }]}
              onPress={run}
              disabled={parsed.length === 0 || busy}
            >
              {busy ? <ActivityIndicator color="#fff" /> : (
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {isRTL ? `استيراد (${parsed.length})` : `Import (${parsed.length})`}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (COLORS: any, isRTL: boolean) =>
  StyleSheet.create({
    wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
    card: { backgroundColor: COLORS.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: SPACING.m, maxHeight: '90%' },
    header: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    title: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
    hint: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' },
    codeBox: { backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: 10, marginBottom: 12 },
    code: { color: COLORS.text, fontSize: 11.5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', writingDirection: 'ltr' },
    pasteBtn: { flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: 10 },
    pasteText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
    input: {
      minHeight: 140,
      backgroundColor: COLORS.card,
      borderColor: COLORS.border,
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.md,
      padding: 12,
      color: COLORS.text,
      textAlignVertical: 'top',
      writingDirection: 'ltr',
      fontSize: 12,
    },
    count: { color: COLORS.textSecondary, fontSize: 12, marginTop: 8, textAlign: isRTL ? 'right' : 'left' },
    resultBox: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, padding: 12, marginTop: 12 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    btn: { flex: 1, padding: 14, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  });
