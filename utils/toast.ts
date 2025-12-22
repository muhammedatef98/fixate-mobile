import Toast from 'react-native-toast-message';

export const showToast = {
  success: (message: string, description?: string) => {
    Toast.show({
      type: 'success',
      text1: message,
      text2: description,
      position: 'top',
      visibilityTime: 3000,
      autoHide: true,
      topOffset: 50,
    });
  },

  error: (message: string, description?: string) => {
    Toast.show({
      type: 'error',
      text1: message,
      text2: description,
      position: 'top',
      visibilityTime: 4000,
      autoHide: true,
      topOffset: 50,
    });
  },

  info: (message: string, description?: string) => {
    Toast.show({
      type: 'info',
      text1: message,
      text2: description,
      position: 'top',
      visibilityTime: 3000,
      autoHide: true,
      topOffset: 50,
    });
  },

  warning: (message: string, description?: string) => {
    Toast.show({
      type: 'warning',
      text1: message,
      text2: description,
      position: 'top',
      visibilityTime: 3000,
      autoHide: true,
      topOffset: 50,
    });
  },
};

export const toastConfig = {
  success: ({ text1, text2 }: any) => (
    <View style={styles.toastContainer}>
      <View style={[styles.toast, styles.successToast]}>
        <MaterialCommunityIcons name="check-circle" size={24} color="#10B981" />
        <View style={styles.toastContent}>
          <Text style={styles.toastTitle}>{text1}</Text>
          {text2 && <Text style={styles.toastDescription}>{text2}</Text>}
        </View>
      </View>
    </View>
  ),
  error: ({ text1, text2 }: any) => (
    <View style={styles.toastContainer}>
      <View style={[styles.toast, styles.errorToast]}>
        <MaterialCommunityIcons name="close-circle" size={24} color="#EF4444" />
        <View style={styles.toastContent}>
          <Text style={styles.toastTitle}>{text1}</Text>
          {text2 && <Text style={styles.toastDescription}>{text2}</Text>}
        </View>
      </View>
    </View>
  ),
  info: ({ text1, text2 }: any) => (
    <View style={styles.toastContainer}>
      <View style={[styles.toast, styles.infoToast]}>
        <MaterialCommunityIcons name="information" size={24} color="#3B82F6" />
        <View style={styles.toastContent}>
          <Text style={styles.toastTitle}>{text1}</Text>
          {text2 && <Text style={styles.toastDescription}>{text2}</Text>}
        </View>
      </View>
    </View>
  ),
  warning: ({ text1, text2 }: any) => (
    <View style={styles.toastContainer}>
      <View style={[styles.toast, styles.warningToast]}>
        <MaterialCommunityIcons name="alert" size={24} color="#F59E0B" />
        <View style={styles.toastContent}>
          <Text style={styles.toastTitle}>{text1}</Text>
          {text2 && <Text style={styles.toastDescription}>{text2}</Text>}
        </View>
      </View>
    </View>
  ),
};

import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const styles = StyleSheet.create({
  toastContainer: {
    width: '90%',
    alignSelf: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  successToast: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  errorToast: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  infoToast: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  warningToast: {
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  toastContent: {
    flex: 1,
    marginLeft: 12,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  toastDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
});
