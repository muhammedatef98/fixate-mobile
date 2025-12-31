import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialIcons, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';

const { width } = Dimensions.get('window');

const NAV_ITEMS = [
  { path: '/(customer)', icon: 'home-outline', activeIcon: 'home', labelAr: 'الرئيسية', labelEn: 'Home' },
  { path: '/services', icon: 'construct-outline', activeIcon: 'construct', labelAr: 'الخدمات', labelEn: 'Services' },
  { path: '/calculator', icon: 'calculator-outline', activeIcon: 'calculator', labelAr: 'الحاسبة', labelEn: 'Calculator' },
  { path: '/profile', icon: 'person-outline', activeIcon: 'person', labelAr: 'حسابي', labelEn: 'Profile' },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { language } = useApp();
  const isRTL = language === 'ar';
  
  const COLORS = {
    primary: '#10b981',
    white: '#ffffff',
    text: '#1f2937',
    gray: '#9ca3af',
    background: '#f9fafb',
  };

  const navItems = isRTL ? [...NAV_ITEMS].reverse() : NAV_ITEMS;

  return (
    <View style={styles.container}>
      <View style={styles.floatingBar}>
        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.path === '/(customer)' && pathname === '/');
          
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
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  floatingBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    width: '100%',
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    // Shadow for Android
    elevation: 10,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  activeIconWrapper: {
    backgroundColor: '#ecfdf5',
  },
  activeDot: {
    position: 'absolute',
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#10b981',
  },
  label: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
    fontWeight: '500',
  },
  activeLabel: {
    color: '#10b981',
    fontWeight: 'bold',
  },
});
