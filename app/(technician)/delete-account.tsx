import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../../contexts/AppContext';
import { auth, supabase } from '../../lib/supabase';

const COLORS = {
  primary: '#10b981',
  danger: '#EF4444',
  warning: '#F59E0B',
  background: '#F9FAFB',
  card: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
};

export default function TechnicianDeleteAccountScreen() {
  const router = useRouter();
  const { language } = useApp();
  const isRTL = language === 'ar';

  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDeleteAccount = async () => {
    // Validate confirmation text
    const expectedText = isRTL ? 'حذف حسابي' : 'DELETE MY ACCOUNT';
    if (confirmText !== expectedText) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL
          ? `الرجاء كتابة "${expectedText}" للتأكيد`
          : `Please type "${expectedText}" to confirm`
      );
      return;
    }

    // Show final confirmation
    Alert.alert(
      isRTL ? 'تأكيد نهائي' : 'Final Confirmation',
      isRTL
        ? 'هل أنت متأكد تماماً من حذف حسابك كفني؟ سيتم حذف جميع بياناتك وسجل أعمالك. هذا الإجراء لا يمكن التراجع عنه.'
        : 'Are you absolutely sure you want to delete your technician account? All your data and work history will be deleted. This action cannot be undone.',
      [
        {
          text: isRTL ? 'إلغاء' : 'Cancel',
          style: 'cancel',
        },
        {
          text: isRTL ? 'نعم، احذف حسابي' : 'Yes, Delete My Account',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // Get current user
              const user = await auth.getCurrentUser();
              if (!user) {
                throw new Error('No user found');
              }

              // Delete user data from database
              const { error: deleteError } = await supabase.rpc('delete_user_data', {
                user_id: user.id,
              });

              if (deleteError) {
                logger.error('Error deleting user data:', deleteError);
              }

              // Sign out
              await auth.signOut();

              Alert.alert(
                isRTL ? 'تم الإرسال' : 'Request Submitted',
                isRTL
                  ? 'تم إرسال طلب حذف حسابك. سيتم معالجته خلال 24-48 ساعة. يمكنك التواصل معنا على fixate01@gmail.com للاستفسار.'
                  : 'Your account deletion request has been submitted. It will be processed within 24-48 hours. You can contact us at fixate01@gmail.com for inquiries.',
                [
                  {
                    text: isRTL ? 'حسناً' : 'OK',
                    onPress: () => {
                      router.replace('/');
                    },
                  },
                ]
              );
            } catch (error) {
              logger.error('Error deleting account:', error);
              Alert.alert(
                isRTL ? 'خطأ' : 'Error',
                isRTL
                  ? 'حدث خطأ أثناء حذف الحساب. يرجى المحاولة مرة أخرى أو التواصل مع الدعم.'
                  : 'An error occurred while deleting your account. Please try again or contact support.'
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Warning Icon */}
        <View style={styles.iconContainer}>
          <MaterialIcons name="warning" size={80} color={COLORS.danger} />
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {isRTL ? 'حذف حساب الفني' : 'Delete Technician Account'}
        </Text>

        {/* Warning Message */}
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>
            {isRTL ? '⚠️ تحذير مهم للفنيين' : '⚠️ Important Warning for Technicians'}
          </Text>
          <Text style={styles.warningText}>
            {isRTL
              ? 'حذف حسابك كفني سيؤدي إلى:'
              : 'Deleting your technician account will result in:'}
          </Text>
          <View style={styles.warningList}>
            <Text style={styles.warningItem}>
              • {isRTL ? 'حذف جميع بياناتك الشخصية' : 'Deletion of all your personal data'}
            </Text>
            <Text style={styles.warningItem}>
              • {isRTL ? 'حذف سجل أعمالك وتقييماتك' : 'Deletion of your work history and ratings'}
            </Text>
            <Text style={styles.warningItem}>
              • {isRTL ? 'فقدان الوصول إلى الطلبات الحالية' : 'Loss of access to current orders'}
            </Text>
            <Text style={styles.warningItem}>
              • {isRTL ? 'حذف معلومات الأرباح' : 'Deletion of earnings information'}
            </Text>
            <Text style={styles.warningItem}>
              • {isRTL ? 'لا يمكن التراجع عن هذا الإجراء' : 'This action cannot be undone'}
            </Text>
          </View>
        </View>

        {/* Data Retention Notice */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>
            {isRTL ? 'ℹ️ سياسة الاحتفاظ بالبيانات' : 'ℹ️ Data Retention Policy'}
          </Text>
          <Text style={styles.infoText}>
            {isRTL
              ? 'قد نحتفظ ببعض البيانات لمدة تصل إلى 30 يوماً لأغراض قانونية ومحاسبية. بعد ذلك، سيتم حذف جميع بياناتك نهائياً.'
              : 'We may retain some data for up to 30 days for legal and accounting purposes. After that, all your data will be permanently deleted.'}
          </Text>
        </View>

        {/* Confirmation Input */}
        <View style={styles.confirmSection}>
          <Text style={styles.confirmLabel}>
            {isRTL
              ? 'للتأكيد، اكتب النص التالي:'
              : 'To confirm, type the following text:'}
          </Text>
          <Text style={styles.confirmTextExample}>
            {isRTL ? 'حذف حسابي' : 'DELETE MY ACCOUNT'}
          </Text>
          <TextInput
            style={styles.input}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={isRTL ? 'اكتب هنا...' : 'Type here...'}
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Delete Button */}
        <TouchableOpacity
          style={[
            styles.deleteButton,
            loading && styles.deleteButtonDisabled,
          ]}
          onPress={handleDeleteAccount}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="delete-forever" size={24} color="#FFFFFF" />
              <Text style={styles.deleteButtonText}>
                {isRTL ? 'حذف حسابي نهائياً' : 'Delete My Account Permanently'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Text>
        </TouchableOpacity>

        {/* Contact Support */}
        <View style={styles.supportSection}>
          <Text style={styles.supportText}>
            {isRTL
              ? 'هل تواجه مشكلة؟ تواصل معنا:'
              : 'Having issues? Contact us:'}
          </Text>
          <Text style={styles.supportEmail}>fixate01@gmail.com</Text>
          <Text style={styles.supportPhone}>+966548940042</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 20,
  },
  warningBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.danger,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 16,
    color: '#991B1B',
    marginBottom: 8,
    fontWeight: '600',
  },
  warningList: {
    marginTop: 8,
  },
  warningItem: {
    fontSize: 14,
    color: '#991B1B',
    marginBottom: 4,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: '#DBEAFE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  confirmSection: {
    marginBottom: 20,
  },
  confirmLabel: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 8,
    fontWeight: '600',
  },
  confirmTextExample: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  deleteButton: {
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  supportSection: {
    alignItems: 'center',
    marginTop: 20,
    padding: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
  },
  supportText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  supportEmail: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  supportPhone: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
});
