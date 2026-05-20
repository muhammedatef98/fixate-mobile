import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  I18nManager,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { getColors, SPACING, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import * as messagingService from '../services/messagingService';
import type { Message } from '../services/messagingService';
import { logger } from '../utils/logger';
import { useScrollToEndOnKeyboard } from '../hooks/useScrollToEndOnKeyboard';

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.id || params.orderId;
  const { otherUserName } = params;
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const isRTL = language === 'ar';

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { user } = useAuth();
  
  const flatListRef = useRef<FlatList>(null);
  useScrollToEndOnKeyboard(flatListRef);

  useEffect(() => {
    if (!orderId || !user) return;
    
    loadMessages();

    // Subscribe to new messages
    const channel = messagingService.subscribeToMessages(orderId as string, (message) => {
      setMessages((prev) => [...prev, message]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => {
      messagingService.unsubscribeFromMessages(channel);
    };
  }, [orderId, user]);

  const loadMessages = async () => {
    try {
      const data = await messagingService.getMessages(orderId as string);
      setMessages(data);
      setLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    } catch (error) {
      logger.error('Error loading messages:', error);
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending || !user) return;

    setSending(true);
    try {
      await messagingService.sendMessage(orderId as string, user.id, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      logger.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(language === 'ar' ? 'ar' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_id === user?.id;

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMyMessage 
              ? { backgroundColor: COLORS.primary } 
              : { backgroundColor: isDark ? '#374151' : '#E5E7EB' },
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMyMessage
                ? { color: '#FFFFFF' }
                : { color: COLORS.text },
              { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' },
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isMyMessage 
                ? { color: 'rgba(255, 255, 255, 0.7)' } 
                : { color: COLORS.textSecondary },
            ]}
          >
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.background }]}>
      {/* Header removed to use Stack Header */}

      {/* KeyboardAvoidingView wraps BOTH the list and the input so the list
          gets compressed when the keyboard appears (instead of staying at
          full height and hiding the latest messages behind the keyboard). */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={[styles.inputContainer, { backgroundColor: COLORS.surface, borderTopColor: COLORS.border }]}>
          <TextInput
            style={[
              styles.input, 
              { 
                backgroundColor: isDark ? '#374151' : '#F3F4F6',
                color: COLORS.text,
                textAlign: isRTL ? 'right' : 'left'
              }
            ]}
            placeholder={isRTL ? 'اكتب رسالتك...' : 'Type a message...'}
            placeholderTextColor={COLORS.textSecondary}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: newMessage.trim() ? COLORS.primary : COLORS.disabled }
            ]}
            onPress={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons 
                name="send-sharp" 
                size={20} 
                color="#FFFFFF" 
                style={{ transform: [{ scaleX: isRTL ? -1 : 1 }] }}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.m,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: SPACING.s,
  },
  headerInfo: {
    marginLeft: SPACING.m,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 12,
    color: '#10B981',
  },
  messagesList: {
    padding: SPACING.m,
    paddingBottom: SPACING.xl,
  },
  messageContainer: {
    marginBottom: SPACING.m,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: SPACING.m,
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.m,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.s,
    maxHeight: 100,
    marginRight: SPACING.m,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
