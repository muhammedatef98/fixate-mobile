import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Image,
  ImageBackground,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { chat, auth, requests } from '../../lib/supabase-api';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { language, isDark } = useApp();
  const isRTL = language === 'ar';
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [order, setOrder] = useState<any>(null);
  const [otherPartyName, setOtherPartyName] = useState('');
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadData();
    
    const subscription = chat.subscribeToMessages(id as string, (message) => {
      setMessages((prev) => [...prev, message]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [id]);

  const loadData = async () => {
    try {
      const [user, orderData, msgs] = await Promise.all([
        auth.getCurrentUser(),
        requests.getById(id as string),
        chat.getMessages(id as string)
      ]);
      
      setCurrentUser(user);
      setOrder(orderData);
      setMessages(msgs);
      
      // Determine other party name
      // In a real app, you'd fetch the profile of the other user
      // For now, we'll simulate it based on role
      if (user?.user_metadata?.role === 'technician') {
        setOtherPartyName(orderData?.customer_name || (language === 'ar' ? 'العميل' : 'Customer'));
      } else {
        setOtherPartyName(orderData?.technician_name || (language === 'ar' ? 'الفني' : 'Technician'));
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading chat data:', error);
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      await chat.sendMessage(id as string, newMessage.trim());
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: any, index: number }) => {
    const isMe = item.sender_id === currentUser?.id;
    const showAvatar = !isMe; // Always show avatar for other party
    const showName = !isMe; // Show name for other party

    return (
      <View style={[
        styles.messageRow,
        isMe ? styles.myMessageRow : styles.otherMessageRow
      ]}>
        {showAvatar && (
          <Image 
            source={{ 
              uri: `https://ui-avatars.com/api/?name=${otherPartyName}&background=random&color=fff&size=64` 
            }} 
            style={styles.avatar} 
          />
        )}
        
        <View style={[
          styles.bubbleContainer,
          isMe ? styles.myBubbleContainer : styles.otherBubbleContainer
        ]}>
          {showName && (
            <Text style={styles.senderName}>
              {otherPartyName}
            </Text>
          )}
          
          <View style={[
            styles.bubble,
            isMe ? styles.myBubble : styles.otherBubble,
            SHADOWS.small
          ]}>
            <Text style={[
              styles.messageText,
              isMe ? styles.myMessageText : styles.otherMessageText
            ]}>
              {item.content}
            </Text>
            <Text style={[
              styles.timestamp,
              isMe ? styles.myTimestamp : styles.otherTimestamp
            ]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={COLORS.text} />
        </TouchableOpacity>
        
        <View style={styles.headerAvatarContainer}>
           <Image 
            source={{ 
              uri: `https://ui-avatars.com/api/?name=${otherPartyName}&background=random&color=fff&size=64` 
            }} 
            style={styles.headerAvatar} 
          />
        </View>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {otherPartyName}
          </Text>
          <Text style={styles.headerSubtitle}>
            {order?.device_brand} {order?.device_model} • #{order?.id?.slice(0, 8)}
          </Text>
        </View>
      </View>

      {/* Messages List */}
      <ImageBackground 
        source={{ uri: 'https://i.pinimg.com/originals/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg' }} // WhatsApp-like background pattern
        style={styles.backgroundImage}
        imageStyle={{ opacity: 0.05 }}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
      </ImageBackground>

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton}>
             <MaterialIcons name="add" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          
          <TextInput
            style={styles.input}
            placeholder={language === 'ar' ? 'اكتب رسالتك...' : 'Type a message...'}
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={500}
          />
          
          <TouchableOpacity 
            style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <MaterialIcons name={isRTL ? 'send' : 'send'} size={20} color="#FFF" />
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
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
    elevation: 2,
    zIndex: 10,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerAvatarContainer: {
    marginHorizontal: SPACING.sm,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  messagesList: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    maxWidth: '85%',
  },
  myMessageRow: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  otherMessageRow: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginHorizontal: SPACING.xs,
    alignSelf: 'flex-end', // Bottom align avatar
    marginBottom: 4,
  },
  bubbleContainer: {
    flex: 1,
  },
  myBubbleContainer: {
    alignItems: 'flex-end',
  },
  otherBubbleContainer: {
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
    marginLeft: 4,
  },
  bubble: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 16,
    minWidth: 80,
  },
  myBubble: {
    backgroundColor: COLORS.primary,
    borderBottomRightRadius: 4, // Chat bubble tail effect
  },
  otherBubble: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 4, // Chat bubble tail effect
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  myMessageText: {
    color: '#FFF',
  },
  otherMessageText: {
    color: COLORS.text,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherTimestamp: {
    color: COLORS.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  attachButton: {
    padding: SPACING.sm,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    maxHeight: 100,
    minHeight: 40,
    marginHorizontal: SPACING.sm,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.textSecondary,
    opacity: 0.5,
  },
});
