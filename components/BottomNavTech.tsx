import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform, Dimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';

const { width } = Dimensions.get('window');

const NAV_ITEMS = [
  { path: '/(technician)', icon: 'grid-outline', activeIcon: 'grid', labelAr: 'الرئيسية', labelEn: 'Home' },
  { path: '/(technician)/available-orders', icon: 'search-outline', activeIcon: 'search', labelAr: 'طلبات', labelEn: 'Orders' },
  { path: '/(technician)/earnings', icon: 'wallet-outline', activeIcon: 'wallet', labelAr: 'الأرباح', labelEn: 'Earnings' },
  { path: '/(technician)/profile', icon: 'person-outline', activeIcon: 'person', labelAr: 'حسابي', labelEn: 'Profile' },
];

export default function BottomNavTech() {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useApp();
  const isRTL = language === 'ar';
  
  const COLORS = {
    primary: '#10b981',
    white: '#ffffff',
    gray: '#9ca3af',
  };

  const navItems = isRTL ? [...NAV_ITEMS].reverse() : NAV_ITEMS;

  return (
    <View style={styles.container}>
      <View style={styles.floatingBar}>
        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.path === '/(technician)' && pathname === '/(technician)/index');
          
          return (
            <TouchableOpacity 
              key={item.path}
              style={styles.navItem}
              onPress={() => router.push(item.path as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, isActive && styles.activeIconWrapper]}>
                <Ionicons 
                  name={(isActive ? item.activeIcon : item.icon) as any} 
                  size={24} 
                  color={isActive ? COLORS.primary : COLORS.gray} 
                />
                {isActive && <View style={styles.activeDot} />}
              </View>
              <Text style={[styles.label, isActive && styles.activeLabel]}>
                {isRTL ? item.labelAr : item.labelEn}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: Platform.OS === 'ios' ? 30 : 20, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  floatingBar: { flexDirection: 'row', backgroundColor: '#ffffff', width: '100%', height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  navItem: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  iconWrapper: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  activeIconWrapper: { backgroundColor: '#ecfdf5' },
  activeDot: { position: 'absolute', bottom: -2, width: 4, height: 4, borderRadius: 2, backgroundColor: '#10b981' },
  label: { fontSize: 10, color: '#9ca3af', marginTop: 2, fontWeight: '500' },
  activeLabel: { color: '#10b981', fontWeight: 'bold' },
});
