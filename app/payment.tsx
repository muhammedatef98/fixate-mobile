import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';

export default function PaymentScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const isRTL = language === 'ar';

  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [saveCard, setSaveCard] = useState(false);

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g);
    return chunks ? chunks.join(' ') : cleaned;
  };

  const formatExpiryDate = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const handlePayment = () => {
    if (!cardNumber || !cardName || !expiryDate || !cvv) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'الرجاء ملء جميع الحقول' : 'Please fill all fields'
      );
      return;
    }

    // Payment functionality is disabled for now
    Alert.alert(
      language === 'ar' ? 'قريباً' : 'Coming Soon',
      language === 'ar' 
        ? 'نظام الدفع قيد التطوير. سيتم تفعيله قريباً!' 
        : 'Payment system is under development. It will be activated soon!',
      [
        {
          text: language === 'ar' ? 'حسناً' : 'OK',
          onPress: () => router.back(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: COLORS.card }, SHADOWS.small]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons 
            name={isRTL ? 'arrow-forward' : 'arrow-back'} 
            size={24} 
            color={COLORS.text} 
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: COLORS.text }]}>
          {language === 'ar' ? 'الدفع' : 'Payment'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Notice Banner */}
        <View style={[styles.noticeBanner, { backgroundColor: '#FEF3C7' }]}>
          <MaterialIcons name="info" size={24} color="#F59E0B" />
          <Text style={[styles.noticeText, { color: '#92400E' }]}>
            {language === 'ar'
              ? 'نظام الدفع قيد التطوير. يمكنك إدخال البيانات للمعاينة فقط.'
              : 'Payment system is under development. You can enter data for preview only.'}
          </Text>
        </View>

        {/* Card Preview */}
        <View style={[styles.cardPreview, SHADOWS.medium]}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="credit-card" size={32} color="#fff" />
            <MaterialIcons name="contactless" size={32} color="#fff" />
          </View>
          <Text style={styles.cardNumber}>
            {cardNumber || '•••• •••• •••• ••••'}
          </Text>
          <View style={styles.cardFooter}>
            <View>
              <Text style={styles.cardLabel}>
                {language === 'ar' ? 'اسم حامل البطاقة' : 'CARD HOLDER'}
              </Text>
              <Text style={styles.cardName}>
                {cardName || (language === 'ar' ? 'الاسم الكامل' : 'FULL NAME')}
              </Text>
            </View>
            <View>
              <Text style={styles.cardLabel}>
                {language === 'ar' ? 'تاريخ الانتهاء' : 'EXPIRES'}
              </Text>
              <Text style={styles.cardExpiry}>{expiryDate || 'MM/YY'}</Text>
            </View>
          </View>
        </View>

        {/* Payment Form */}
        <View style={styles.form}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
            {language === 'ar' ? 'معلومات البطاقة' : 'Card Information'}
          </Text>

          {/* Card Number */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: COLORS.textSecondary }]}>
              {language === 'ar' ? 'رقم البطاقة' : 'Card Number'}
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: COLORS.card }]}>
              <MaterialIcons name="credit-card" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={[styles.input, { color: COLORS.text }]}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={COLORS.textSecondary}
                value={cardNumber}
                onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                keyboardType="numeric"
                maxLength={19}
              />
            </View>
          </View>

          {/* Card Holder Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: COLORS.textSecondary }]}>
              {language === 'ar' ? 'اسم حامل البطاقة' : 'Card Holder Name'}
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: COLORS.card }]}>
              <MaterialIcons name="person" size={20} color={COLORS.textSecondary} />
              <TextInput
                style={[styles.input, { color: COLORS.text }]}
                placeholder={language === 'ar' ? 'الاسم كما في البطاقة' : 'Name as on card'}
                placeholderTextColor={COLORS.textSecondary}
                value={cardName}
                onChangeText={setCardName}
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* Expiry Date & CVV */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: COLORS.textSecondary }]}>
                {language === 'ar' ? 'تاريخ الانتهاء' : 'Expiry Date'}
              </Text>
              <View style={[styles.inputContainer, { backgroundColor: COLORS.card }]}>
                <MaterialIcons name="calendar-today" size={20} color={COLORS.textSecondary} />
                <TextInput
                  style={[styles.input, { color: COLORS.text }]}
                  placeholder="MM/YY"
                  placeholderTextColor={COLORS.textSecondary}
                  value={expiryDate}
                  onChangeText={(text) => setExpiryDate(formatExpiryDate(text))}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: COLORS.textSecondary }]}>CVV</Text>
              <View style={[styles.inputContainer, { backgroundColor: COLORS.card }]}>
                <MaterialIcons name="lock" size={20} color={COLORS.textSecondary} />
                <TextInput
                  style={[styles.input, { color: COLORS.text }]}
                  placeholder="123"
                  placeholderTextColor={COLORS.textSecondary}
                  value={cvv}
                  onChangeText={setCvv}
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
            </View>
          </View>

          {/* Save Card */}
          <TouchableOpacity
            style={styles.checkboxContainer}
            onPress={() => setSaveCard(!saveCard)}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: COLORS.border },
                saveCard && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
              ]}
            >
              {saveCard && <MaterialIcons name="check" size={16} color="#fff" />}
            </View>
            <Text style={[styles.checkboxLabel, { color: COLORS.text }]}>
              {language === 'ar' ? 'حفظ البطاقة للمرات القادمة' : 'Save card for future use'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Payment Methods */}
        <View style={styles.paymentMethods}>
          <Text style={[styles.sectionTitle, { color: COLORS.text }]}>
            {language === 'ar' ? 'طرق الدفع المقبولة' : 'Accepted Payment Methods'}
          </Text>
          <View style={styles.methodsGrid}>
            {['Visa', 'Mastercard', 'Mada', 'Apple Pay'].map((method) => (
              <View
                key={method}
                style={[styles.methodCard, { backgroundColor: COLORS.card }, SHADOWS.small]}
              >
                <Text style={[styles.methodText, { color: COLORS.text }]}>{method}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          style={[styles.payButton, { backgroundColor: COLORS.primary }, SHADOWS.medium]}
          onPress={handlePayment}
        >
          <MaterialIcons name="lock" size={20} color="#fff" />
          <Text style={styles.payButtonText}>
            {language === 'ar' ? 'الدفع الآمن' : 'Secure Payment'}
          </Text>
        </TouchableOpacity>

        {/* Security Notice */}
        <View style={styles.securityNotice}>
          <MaterialIcons name="verified-user" size={16} color={COLORS.textSecondary} />
          <Text style={[styles.securityText, { color: COLORS.textSecondary }]}>
            {language === 'ar'
              ? 'جميع المعاملات محمية بتشفير SSL 256-bit'
              : 'All transactions are secured with 256-bit SSL encryption'}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    padding: SPACING.lg,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  cardPreview: {
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundColor: '#667eea',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  cardNumber: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 2,
    marginBottom: SPACING.lg,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: 10,
    color: '#E0E7FF',
    marginBottom: 4,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  cardExpiry: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  form: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  inputGroup: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  checkboxLabel: {
    fontSize: 14,
  },
  paymentMethods: {
    marginBottom: SPACING.xl,
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  methodCard: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    minWidth: 80,
    alignItems: 'center',
  },
  methodText: {
    fontSize: 12,
    fontWeight: '600',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  securityText: {
    fontSize: 12,
  },
});
