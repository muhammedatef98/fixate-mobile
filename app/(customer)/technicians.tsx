import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getColors, getShadows, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { translations } from '../../constants/translations';
import { technicians } from '../../lib/supabase-api';
import NeuCard from '../../components/NeuCard';
import BottomNav from '../../components/BottomNav';

export default function TechniciansScreen() {
  const router = useRouter();
  const { language, isDark } = useApp();
  const COLORS = getColors(isDark);
  const SHADOWS = getShadows(isDark);
  const t = translations[language];
  const isRTL = language === 'ar';

  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTechnicians();
  }, []);

  const loadTechnicians = async () => {
    try {
      setLoading(true);
      const data = await technicians.getAvailable();
      setTechnicians(data);
    } catch (error) {
      logger.debug('Error loading technicians:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTechnicians();
  };

  const styles = createStyles(COLORS, SHADOWS, isRTL);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={COLORS.text} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{language === 'ar' ? 'الفنيون المتاحون' : 'Available Technicians'}</Text>
        </View>
        
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
        >
          {technicians.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="engineering" size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>
                {language === 'ar' ? 'لا يوجد فنيون متاحون حالياً' : 'No technicians available'}
              </Text>
              <Text style={styles.emptySubtext}>
                {language === 'ar' ? 'يرجى المحاولة لاحقاً' : 'Please try again later'}
              </Text>
            </View>
          ) : (
            technicians.map((tech) => (
              <NeuCard key={tech.id} style={styles.techCard}>
                <View style={styles.techHeader}>
                  <View style={styles.avatarContainer}>
                    <Image 
                      source={{ 
                        uri: tech.users?.avatar_url || `https://ui-avatars.com/api/?name=${tech.users?.name || 'Tech'}&background=10B981&color=fff&size=128` 
                      }} 
                      style={styles.avatar} 
                    />
                    {tech.available && <View style={styles.availableBadge} />}
                  </View>
                  
                  <View style={styles.techInfo}>
                    <Text style={styles.techName}>{tech.users?.name || 'Technician'}</Text>
                    <View style={styles.ratingContainer}>
                      <MaterialIcons name="star" size={16} color="#F59E0B" />
                      <Text style={styles.rating}>{tech.rating?.toFixed(1) || '5.0'}</Text>
                      <Text style={styles.jobsCount}>
                        ({tech.total_jobs || 0} {language === 'ar' ? 'عمل' : 'jobs'})
                      </Text>
                    </View>
                    {tech.location && (
                      <View style={styles.locationRow}>
                        <MaterialIcons name="location-on" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.location}>{tech.location}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {tech.specialization && tech.specialization.length > 0 && (
                  <View style={styles.specializationContainer}>
                    <Text style={styles.specializationTitle}>
                      {language === 'ar' ? 'التخصصات:' : 'Specializations:'}
                    </Text>
                    <View style={styles.specializationTags}>
                      {tech.specialization.map((spec: string, index: number) => (
                        <View key={index} style={styles.tag}>
                          <Text style={styles.tagText}>{spec}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <TouchableOpacity 
                  style={styles.contactButton}
                  onPress={() => {
                    // Navigate to contact or booking
                  }}
                >
                  <MaterialIcons name="phone" size={20} color="#FFFFFF" />
                  <Text style={styles.contactButtonText}>
                    {language === 'ar' ? 'تواصل الآن' : 'Contact Now'}
                  </Text>
                </TouchableOpacity>
              </NeuCard>
            ))
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <BottomNav currentRoute="/(customer)/technicians" />
    </SafeAreaView>
  );
}

function createStyles(COLORS: any, SHADOWS: any, isRTL: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
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
      borderRadius: 20,
      backgroundColor: COLORS.background,
      ...SHADOWS.neu,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerContent: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: COLORS.text,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContent: {
      paddingHorizontal: SPACING.lg,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: SPACING.xxxl * 2,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: COLORS.text,
      marginTop: SPACING.lg,
    },
    emptySubtext: {
      fontSize: 14,
      color: COLORS.textSecondary,
      marginTop: SPACING.sm,
    },
    techCard: {
      marginBottom: SPACING.md,
      padding: SPACING.lg,
    },
    techHeader: {
      flexDirection: 'row',
      marginBottom: SPACING.md,
    },
    avatarContainer: {
      position: 'relative',
      marginRight: SPACING.md,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
    },
    availableBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: '#10B981',
      borderWidth: 2,
      borderColor: COLORS.background,
    },
    techInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    techName: {
      fontSize: 18,
      fontWeight: '700',
      color: COLORS.text,
      marginBottom: 4,
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    rating: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.text,
      marginLeft: 4,
    },
    jobsCount: {
      fontSize: 12,
      color: COLORS.textSecondary,
      marginLeft: 4,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    location: {
      fontSize: 12,
      color: COLORS.textSecondary,
      marginLeft: 2,
    },
    specializationContainer: {
      marginBottom: SPACING.md,
    },
    specializationTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.textSecondary,
      marginBottom: SPACING.sm,
    },
    specializationTags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    tag: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      backgroundColor: COLORS.primaryLight,
      borderRadius: BORDER_RADIUS.md,
    },
    tagText: {
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.primary,
    },
    contactButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.md,
      backgroundColor: COLORS.primary,
      borderRadius: BORDER_RADIUS.lg,
      ...SHADOWS.neuInset,
      gap: SPACING.sm,
    },
    contactButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
  });
}
