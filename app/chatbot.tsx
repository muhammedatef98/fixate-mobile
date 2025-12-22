import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
}

const BOT_RESPONSES: Record<string, string> = {
  hello: 'مرحباً! كيف يمكنني مساعدتك اليوم؟',
  hi: 'أهلاً! أنا هنا للمساعدة.',
  price: 'يمكنك استخدام حاسبة الأسعار للحصول على تقدير فوري. أسعارنا تبدأ من 100 ريال حسب نوع الصيانة.',
  السعر: 'يمكنك استخدام حاسبة الأسعار للحصول على تقدير فوري. أسعارنا تبدأ من 100 ريال حسب نوع الصيانة.',
  time: 'عادة ما تستغرق الصيانة من ساعة إلى 3 ساعات حسب نوع المشكلة.',
  الوقت: 'عادة ما تستغرق الصيانة من ساعة إلى 3 ساعات حسب نوع المشكلة.',
  location: 'نقدم خدماتنا في جميع أنحاء المملكة العربية السعودية.',
  الموقع: 'نقدم خدماتنا في جميع أنحاء المملكة العربية السعودية.',
  warranty: 'نقدم ضمان 3 أشهر على جميع أعمال الصيانة.',
  الضمان: 'نقدم ضمان 3 أشهر على جميع أعمال الصيانة.',
  payment: 'نقبل الدفع نقداً أو عن طريق البطاقات الائتمانية.',
  الدفع: 'نقبل الدفع نقداً أو عن طريق البطاقات الائتمانية.',
};

const QUICK_REPLIES = [
  { id: '1', text: 'كم السعر؟', key: 'السعر' },
  { id: '2', text: 'كم يستغرق الوقت؟', key: 'الوقت' },
  { id: '3', text: 'أين موقعكم؟', key: 'الموقع' },
  { id: '4', text: 'ما هو الضمان؟', key: 'الضمان' },
];

export default function ChatbotScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'مرحباً! أنا مساعد Fixate الذكي. كيف يمكنني مساعدتك اليوم؟',
      isBot: true,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const getBotResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase().trim();
    
    // Check for exact matches
    for (const [key, response] of Object.entries(BOT_RESPONSES)) {
      if (lowerMessage.includes(key)) {
        return response;
      }
    }

    // Default response
    return 'شكراً على رسالتك. للمساعدة الفورية، يمكنك التواصل معنا على 0548940042 أو fixate01@gmail.com';
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      isBot: false,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');

    // Simulate bot typing and response
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: getBotResponse(text),
        isBot: true,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botResponse]);
    }, 1000);
  };

  const handleQuickReply = (reply: typeof QUICK_REPLIES[0]) => {
    sendMessage(reply.text);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>مساعد Fixate</Text>
          <View style={styles.onlineIndicator}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>متصل</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.isBot ? styles.botBubble : styles.userBubble,
              { backgroundColor: message.isBot ? colors.surface : colors.primary },
            ]}
          >
            <Text
              style={[
                styles.messageText,
                { color: message.isBot ? colors.text : '#fff' },
              ]}
            >
              {message.text}
            </Text>
            <Text
              style={[
                styles.messageTime,
                { color: message.isBot ? colors.textSecondary : '#fff', opacity: 0.7 },
              ]}
            >
              {message.timestamp.toLocaleTimeString('ar-SA', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Quick Replies */}
      {messages.length === 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickRepliesContainer}
          contentContainerStyle={styles.quickRepliesContent}
        >
          {QUICK_REPLIES.map((reply) => (
            <TouchableOpacity
              key={reply.id}
              style={[styles.quickReply, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => handleQuickReply(reply)}
            >
              <Text style={[styles.quickReplyText, { color: colors.text }]}>
                {reply.text}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="اكتب رسالتك..."
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, { backgroundColor: colors.primary }]}
          onPress={() => sendMessage(inputText)}
          disabled={!inputText.trim()}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
    marginLeft: 6,
  },
  onlineText: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  botBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  quickRepliesContainer: {
    maxHeight: 60,
    marginBottom: 8,
  },
  quickRepliesContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickReply: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginLeft: 8,
  },
  quickReplyText: {
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    paddingBottom: 34,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    textAlign: 'right',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
});
