// Comprehensive repair service data with real brand logos and all common issues

export interface Brand {
  id: string;
  name: string;
  logo: any; // Can be string (URL) or require
  models: string[];
  deviceType?: string; // 'phone', 'tablet', 'laptop', 'printer', 'watch'
}

export interface Issue {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  estimatedPrice: number; // Kept for backward compatibility
  priceRange?: {
    min: number;
    max: number;
  };
  deviceType?: string; // To filter issues by device type
}

// All major brands with local assets for instant loading
export const BRANDS: Brand[] = [
  // Phones
  {
    id: 'apple',
    name: 'Apple',
    deviceType: 'phone',
    logo: require('../assets/apple-logo.png'),
    models: [
      'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
      'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
      'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 Mini',
      'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 Mini',
      'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
      'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone X',
      'iPhone 8 Plus', 'iPhone 8', 'iPhone 7 Plus', 'iPhone 7',
      'iPhone SE (2022)', 'iPhone SE (2020)'
    ]
  },
  {
    id: 'samsung',
    name: 'Samsung',
    deviceType: 'phone',
    logo: require('../assets/samsung-logo.png'),
    models: [
      'Galaxy S24 Ultra', 'Galaxy S24+', 'Galaxy S24',
      'Galaxy S23 Ultra', 'Galaxy S23+', 'Galaxy S23',
      'Galaxy S22 Ultra', 'Galaxy S22+', 'Galaxy S22',
      'Galaxy S21 Ultra', 'Galaxy S21+', 'Galaxy S21',
      'Galaxy Z Fold 5', 'Galaxy Z Fold 4', 'Galaxy Z Fold 3',
      'Galaxy Z Flip 5', 'Galaxy Z Flip 4', 'Galaxy Z Flip 3',
      'Galaxy A54', 'Galaxy A53', 'Galaxy A52', 'Galaxy A51',
      'Galaxy A34', 'Galaxy A33', 'Galaxy A32', 'Galaxy A31',
      'Galaxy A24', 'Galaxy A23', 'Galaxy A22', 'Galaxy A21',
      'Galaxy A14', 'Galaxy A13', 'Galaxy A12', 'Galaxy A11',
      'Galaxy M54', 'Galaxy M53', 'Galaxy M52', 'Galaxy M51',
      'Galaxy Note 20 Ultra', 'Galaxy Note 20', 'Galaxy Note 10+'
    ]
  },
  {
    id: 'huawei',
    name: 'Huawei',
    deviceType: 'phone',
    logo: require('../assets/huawei-logo.png'),
    models: [
      'Mate 60 Pro', 'Mate 60', 'Mate 50 Pro', 'Mate 50',
      'Mate 40 Pro', 'Mate 40', 'Mate 30 Pro', 'Mate 30',
      'P60 Pro', 'P60', 'P50 Pro', 'P50', 'P40 Pro', 'P40',
      'P30 Pro', 'P30', 'P20 Pro', 'P20',
      'Nova 12 Pro', 'Nova 12', 'Nova 11 Pro', 'Nova 11',
      'Nova 10 Pro', 'Nova 10', 'Nova 9 Pro', 'Nova 9',
      'Y9s', 'Y9 Prime', 'Y9', 'Y7 Pro', 'Y7', 'Y6 Pro', 'Y6'
    ]
  },
  {
    id: 'xiaomi',
    name: 'Xiaomi',
    deviceType: 'phone',
    logo: require('../assets/xiaomi-logo.png'),
    models: [
      'Xiaomi 14 Pro', 'Xiaomi 14', 'Xiaomi 13 Ultra', 'Xiaomi 13 Pro', 'Xiaomi 13',
      'Xiaomi 12 Pro', 'Xiaomi 12', 'Xiaomi 11 Ultra', 'Xiaomi 11 Pro', 'Xiaomi 11',
      'Redmi Note 13 Pro+', 'Redmi Note 13 Pro', 'Redmi Note 13',
      'Redmi Note 12 Pro+', 'Redmi Note 12 Pro', 'Redmi Note 12',
      'Redmi Note 11 Pro+', 'Redmi Note 11 Pro', 'Redmi Note 11',
      'Redmi Note 10 Pro', 'Redmi Note 10', 'Redmi Note 9 Pro', 'Redmi Note 9',
      'Redmi 13C', 'Redmi 12C', 'Redmi 11C', 'Redmi 10C',
      'Poco X6 Pro', 'Poco X6', 'Poco X5 Pro', 'Poco X5',
      'Poco F5 Pro', 'Poco F5', 'Poco F4', 'Poco F3',
      'Poco M6 Pro', 'Poco M6', 'Poco M5', 'Poco M4'
    ]
  },
  {
    id: 'oppo',
    name: 'Oppo',
    deviceType: 'phone',
    logo: require('../assets/oppo-logo.png'),
    models: [
      'Find X7 Ultra', 'Find X7', 'Find X6 Pro', 'Find X6',
      'Find X5 Pro', 'Find X5', 'Find X3 Pro', 'Find X3',
      'Reno 11 Pro', 'Reno 11', 'Reno 10 Pro+', 'Reno 10 Pro', 'Reno 10',
      'Reno 9 Pro+', 'Reno 9 Pro', 'Reno 9', 'Reno 8 Pro', 'Reno 8',
      'Reno 7 Pro', 'Reno 7', 'Reno 6 Pro', 'Reno 6',
      'A98', 'A78', 'A58', 'A38', 'A18', 'A17',
      'F23', 'F21 Pro', 'F21', 'F19 Pro', 'F19'
    ]
  },
  {
    id: 'vivo',
    name: 'Vivo',
    deviceType: 'phone',
    logo: require('../assets/vivo-logo.png'),
    models: [
      'X100 Pro', 'X100', 'X90 Pro', 'X90', 'X80 Pro', 'X80',
      'X70 Pro+', 'X70 Pro', 'X70', 'X60 Pro', 'X60',
      'V30 Pro', 'V30', 'V29 Pro', 'V29', 'V27 Pro', 'V27',
      'V25 Pro', 'V25', 'V23 Pro', 'V23', 'V21', 'V20',
      'Y100', 'Y78', 'Y56', 'Y36', 'Y28', 'Y22',
      'Y17', 'Y16', 'Y15', 'Y12', 'Y11',
      'iQOO 12 Pro', 'iQOO 12', 'iQOO 11 Pro', 'iQOO 11',
      'iQOO Neo 9 Pro', 'iQOO Neo 9', 'iQOO Neo 8', 'iQOO Neo 7'
    ]
  },
  {
    id: 'oneplus',
    name: 'OnePlus',
    deviceType: 'phone',
    logo: require('../assets/oneplus-logo.png'),
    models: [
      'OnePlus 12', 'OnePlus 11', 'OnePlus 10 Pro', 'OnePlus 10T',
      'OnePlus 9 Pro', 'OnePlus 9', 'OnePlus 8 Pro', 'OnePlus 8T', 'OnePlus 8',
      'OnePlus 7 Pro', 'OnePlus 7T', 'OnePlus 7',
      'OnePlus Nord 3', 'OnePlus Nord 2T', 'OnePlus Nord 2', 'OnePlus Nord',
      'OnePlus Nord CE 3', 'OnePlus Nord CE 2', 'OnePlus Nord CE',
      'OnePlus Nord N30', 'OnePlus Nord N20', 'OnePlus Nord N10'
    ]
  },
  {
    id: 'realme',
    name: 'Realme',
    deviceType: 'phone',
    logo: require('../assets/realme-logo.png'),
    models: [
      'Realme GT 5 Pro', 'Realme GT 5', 'Realme GT 3', 'Realme GT 2 Pro', 'Realme GT 2',
      'Realme 12 Pro+', 'Realme 12 Pro', 'Realme 12', 'Realme 11 Pro+', 'Realme 11 Pro', 'Realme 11',
      'Realme 10 Pro+', 'Realme 10 Pro', 'Realme 10', 'Realme 9 Pro+', 'Realme 9 Pro', 'Realme 9',
      'Realme C67', 'Realme C65', 'Realme C55', 'Realme C53', 'Realme C51',
      'Realme C35', 'Realme C33', 'Realme C31', 'Realme C30', 'Realme C25',
      'Realme Narzo 60 Pro', 'Realme Narzo 60', 'Realme Narzo 50 Pro', 'Realme Narzo 50'
    ]
  },
  {
    id: 'google',
    name: 'Google Pixel',
    deviceType: 'phone',
    logo: require('../assets/google-logo.png'),
    models: [
      'Pixel 8 Pro', 'Pixel 8', 'Pixel 7 Pro', 'Pixel 7', 'Pixel 7a',
      'Pixel 6 Pro', 'Pixel 6', 'Pixel 6a', 'Pixel 5', 'Pixel 4a'
    ]
  },
  {
    id: 'honor',
    name: 'Honor',
    deviceType: 'phone',
    logo: require('../assets/honor-logo.png'),
    models: [
      'Honor Magic 6 Pro', 'Honor Magic 5 Pro', 'Honor 90', 'Honor 70',
      'Honor X9b', 'Honor X8b', 'Honor X7b'
    ]
  },
  
  // Tablet Brands
  {
    id: 'apple-tablet',
    name: 'Apple iPad',
    deviceType: 'tablet',
    logo: require('../assets/apple-logo.png'),
    models: [
      'iPad Pro 12.9" (2024)', 'iPad Pro 11" (2024)', 'iPad Pro 12.9" (2022)', 'iPad Pro 11" (2022)',
      'iPad Air (2024)', 'iPad Air (2022)', 'iPad (10th gen)', 'iPad (9th gen)',
      'iPad mini (6th gen)', 'iPad mini (5th gen)'
    ]
  },
  {
    id: 'samsung-tablet',
    name: 'Samsung Galaxy Tab',
    deviceType: 'tablet',
    logo: require('../assets/samsung-logo.png'),
    models: [
      'Galaxy Tab S9 Ultra', 'Galaxy Tab S9+', 'Galaxy Tab S9',
      'Galaxy Tab S8 Ultra', 'Galaxy Tab S8+', 'Galaxy Tab S8',
      'Galaxy Tab A9+', 'Galaxy Tab A9', 'Galaxy Tab A8', 'Galaxy Tab A7'
    ]
  },
  {
    id: 'huawei-tablet',
    name: 'Huawei MatePad',
    deviceType: 'tablet',
    logo: require('../assets/huawei-logo.png'),
    models: [
      'MatePad Pro 13.2', 'MatePad Pro 12.6', 'MatePad Pro 11',
      'MatePad 11.5', 'MatePad 11', 'MatePad SE', 'MatePad T10'
    ]
  },

  // Laptop Brands
  {
    id: 'apple-laptop',
    name: 'Apple MacBook',
    deviceType: 'laptop',
    logo: require('../assets/apple-logo.png'),
    models: [
      'MacBook Pro 16" (M3)', 'MacBook Pro 14" (M3)', 'MacBook Pro 16" (M2)', 'MacBook Pro 14" (M2)',
      'MacBook Air 15" (M3)', 'MacBook Air 13" (M3)', 'MacBook Air 15" (M2)', 'MacBook Air 13" (M2)',
      'MacBook Air (M1)', 'MacBook Pro 13" (M1)'
    ]
  },
  {
    id: 'hp-laptop',
    name: 'HP',
    deviceType: 'laptop',
    logo: require('../assets/hp-logo.png'),
    models: [
      'Spectre x360', 'Envy x360', 'Pavilion', 'Omen', 'Victus',
      'EliteBook', 'ProBook', 'ZBook', 'HP Essentials'
    ]
  },
  {
    id: 'dell-laptop',
    name: 'Dell',
    deviceType: 'laptop',
    logo: require('../assets/dell-logo.png'),
    models: [
      'XPS 15', 'XPS 13', 'Inspiron', 'Vostro', 'Latitude',
      'Precision', 'Alienware', 'G-Series'
    ]
  },
  {
    id: 'asus-laptop',
    name: 'ASUS',
    deviceType: 'laptop',
    logo: require('../assets/asus-logo.png'),
    models: [
      'Zenbook Pro', 'Zenbook S', 'Zenbook', 'Vivobook Pro', 'Vivobook S',
      'Vivobook', 'ROG Zephyrus', 'ROG Strix', 'TUF Gaming'
    ]
  },
  {
    id: 'huawei-laptop',
    name: 'Huawei MateBook',
    deviceType: 'laptop',
    logo: require('../assets/huawei-logo.png'),
    models: [
      'MateBook X Pro', 'MateBook X', 'MateBook 16s', 'MateBook 14s',
      'MateBook D 16', 'MateBook D 15', 'MateBook D 14'
    ]
  },
  {
    id: 'samsung-laptop',
    name: 'Samsung Galaxy Book',
    deviceType: 'laptop',
    logo: require('../assets/samsung-logo.png'),
    models: [
      'Galaxy Book 4 Ultra', 'Galaxy Book 4 Pro', 'Galaxy Book 4',
      'Galaxy Book 3 Ultra', 'Galaxy Book 3 Pro', 'Galaxy Book 3',
      'Galaxy Book 2 Pro', 'Galaxy Book 2'
    ]
  },

  // Watch Brands
  {
    id: 'apple-watch',
    name: 'Apple Watch',
    deviceType: 'watch',
    logo: require('../assets/apple-logo.png'),
    models: [
      'Apple Watch Ultra 2', 'Apple Watch Ultra',
      'Apple Watch Series 9', 'Apple Watch Series 8', 'Apple Watch Series 7',
      'Apple Watch SE (2022)', 'Apple Watch SE'
    ]
  },
  {
    id: 'samsung-watch',
    name: 'Samsung Galaxy Watch',
    deviceType: 'watch',
    logo: require('../assets/samsung-logo.png'),
    models: [
      'Galaxy Watch 6 Classic', 'Galaxy Watch 6',
      'Galaxy Watch 5 Pro', 'Galaxy Watch 5',
      'Galaxy Watch 4 Classic', 'Galaxy Watch 4'
    ]
  },
  {
    id: 'huawei-watch',
    name: 'Huawei Watch',
    deviceType: 'watch',
    logo: require('../assets/huawei-logo.png'),
    models: [
      'Watch Ultimate', 'Watch 4 Pro', 'Watch 4',
      'Watch GT 4', 'Watch GT 3 Pro', 'Watch GT 3',
      'Watch Fit 3', 'Watch Fit 2'
    ]
  }
];

export const ISSUES: Issue[] = [
  // Phone & Tablet Issues
  {
    id: 'screen',
    name: 'Screen Repair',
    nameAr: 'إصلاح الشاشة',
    icon: 'cellphone-screenshot',
    estimatedPrice: 250,
    priceRange: { min: 150, max: 800 },
    deviceType: 'phone'
  },
  {
    id: 'battery',
    name: 'Battery Replacement',
    nameAr: 'تبديل البطارية',
    icon: 'battery-charging',
    estimatedPrice: 120,
    priceRange: { min: 80, max: 250 },
    deviceType: 'phone'
  },
  {
    id: 'charging',
    name: 'Charging Port',
    nameAr: 'منفذ الشحن',
    icon: 'usb-port',
    estimatedPrice: 100,
    priceRange: { min: 70, max: 180 },
    deviceType: 'phone'
  },
  {
    id: 'camera',
    name: 'Camera Repair',
    nameAr: 'إصلاح الكاميرا',
    icon: 'camera',
    estimatedPrice: 180,
    priceRange: { min: 120, max: 450 },
    deviceType: 'phone'
  },
  {
    id: 'back-glass',
    name: 'Back Glass',
    nameAr: 'الزجاج الخلفي',
    icon: 'cellphone-back',
    estimatedPrice: 150,
    priceRange: { min: 100, max: 350 },
    deviceType: 'phone'
  },
  {
    id: 'water-damage',
    name: 'Water Damage',
    nameAr: 'ضرر السوائل',
    icon: 'water-alert',
    estimatedPrice: 300,
    priceRange: { min: 150, max: 1000 },
    deviceType: 'phone'
  },
  {
    id: 'software',
    name: 'Software Issue',
    nameAr: 'مشكلة برمجية',
    icon: 'cellphone-cog',
    estimatedPrice: 80,
    priceRange: { min: 50, max: 150 },
    deviceType: 'phone'
  },
  {
    id: 'other-phone',
    name: 'Other Issue',
    nameAr: 'أخرى',
    icon: 'dots-horizontal-circle-outline',
    estimatedPrice: 0,
    deviceType: 'phone'
  },

  // Laptop Issues
  {
    id: 'laptop-screen',
    name: 'Screen Repair',
    nameAr: 'إصلاح الشاشة',
    icon: 'laptop-off',
    estimatedPrice: 450,
    priceRange: { min: 300, max: 1200 },
    deviceType: 'laptop'
  },
  {
    id: 'keyboard',
    name: 'Keyboard Repair',
    nameAr: 'إصلاح لوحة المفاتيح',
    icon: 'keyboard-outline',
    estimatedPrice: 200,
    priceRange: { min: 150, max: 450 },
    deviceType: 'laptop'
  },
  {
    id: 'laptop-battery',
    name: 'Battery Replacement',
    nameAr: 'تبديل البطارية',
    icon: 'battery-charging',
    estimatedPrice: 250,
    priceRange: { min: 180, max: 450 },
    deviceType: 'laptop'
  },
  {
    id: 'laptop-upgrade',
    name: 'RAM/SSD Upgrade',
    nameAr: 'ترقية الرام/الهارد',
    icon: 'memory',
    estimatedPrice: 350,
    priceRange: { min: 200, max: 800 },
    deviceType: 'laptop'
  },
  {
    id: 'laptop-hinge',
    name: 'Hinge Repair',
    nameAr: 'إصلاح المفصلات',
    icon: 'laptop',
    estimatedPrice: 180,
    priceRange: { min: 120, max: 350 },
    deviceType: 'laptop'
  },
  {
    id: 'other-laptop',
    name: 'Other Issue',
    nameAr: 'أخرى',
    icon: 'dots-horizontal-circle-outline',
    estimatedPrice: 0,
    deviceType: 'laptop'
  },

  // Watch Issues
  {
    id: 'watch-screen',
    name: 'Screen Repair',
    nameAr: 'إصلاح الشاشة',
    icon: 'watch-variant',
    estimatedPrice: 350,
    priceRange: { min: 250, max: 700 },
    deviceType: 'watch'
  },
  {
    id: 'watch-battery',
    name: 'Battery Replacement',
    nameAr: 'تبديل البطارية',
    icon: 'battery-charging',
    estimatedPrice: 150,
    priceRange: { min: 100, max: 250 },
    deviceType: 'watch'
  },
  {
    id: 'other-watch',
    name: 'Other Issue',
    nameAr: 'أخرى',
    icon: 'dots-horizontal-circle-outline',
    estimatedPrice: 0,
    deviceType: 'watch'
  },
  
  // Printer Issues
  {
    id: 'printer-paper',
    name: 'Paper Jam',
    nameAr: 'انحشار الورق',
    icon: 'printer-alert',
    estimatedPrice: 100,
    deviceType: 'printer'
  },
  {
    id: 'printer-ink',
    name: 'Ink/Toner Issue',
    nameAr: 'مشكلة الحبر',
    icon: 'printer-3d-nozzle',
    estimatedPrice: 150,
    deviceType: 'printer'
  },
  {
    id: 'other-printer',
    name: 'Other Issue',
    nameAr: 'أخرى',
    icon: 'dots-horizontal-circle-outline',
    estimatedPrice: 0,
    deviceType: 'printer'
  },

  // Headphones Issues
  {
    id: 'audio-one-side',
    name: 'One Side Not Working',
    nameAr: 'جهة واحدة لا تعمل',
    icon: 'headphones-off',
    estimatedPrice: 120,
    deviceType: 'headphones'
  },
  {
    id: 'other-headphones',
    name: 'Other Issue',
    nameAr: 'أخرى',
    icon: 'dots-horizontal-circle-outline',
    estimatedPrice: 0,
    deviceType: 'headphones'
  },

  // TV Issues
  {
    id: 'tv-screen',
    name: 'Broken Screen',
    nameAr: 'كسر في الشاشة',
    icon: 'television-off',
    estimatedPrice: 800,
    deviceType: 'tv'
  },
  {
    id: 'other-tv',
    name: 'Other Issue',
    nameAr: 'أخرى',
    icon: 'dots-horizontal-circle-outline',
    estimatedPrice: 0,
    deviceType: 'tv'
  },

  // Appliance Issues
  {
    id: 'appliance-power',
    name: 'Not Powering On',
    nameAr: 'لا يعمل',
    icon: 'power-plug-off',
    estimatedPrice: 200,
    deviceType: 'appliance'
  },
  {
    id: 'other-appliance',
    name: 'Other Issue',
    nameAr: 'أخرى',
    icon: 'dots-horizontal-circle-outline',
    estimatedPrice: 0,
    deviceType: 'appliance'
  }
];

// Helper functions for searching and filtering
export const searchBrands = (query: string, deviceType?: string): Brand[] => {
  let filtered = BRANDS;
  if (deviceType) {
    filtered = filtered.filter(b => b.deviceType === deviceType);
  }
  if (!query) return filtered;
  
  const lowerQuery = query.toLowerCase();
  return filtered.filter(b => 
    b.name.toLowerCase().includes(lowerQuery)
  );
};

export const searchModels = (brandId: string, query: string): string[] => {
  const brand = BRANDS.find(b => b.id === brandId);
  if (!brand) return [];
  
  if (!query) return brand.models;
  
  const lowerQuery = query.toLowerCase();
  return brand.models.filter(m => m.toLowerCase().includes(lowerQuery));
};

export const searchIssues = (deviceType: string, query: string): Issue[] => {
  // Map tablet to phone issues as they are similar
  const effectiveType = deviceType === 'tablet' ? 'phone' : deviceType;
  
  const filtered = ISSUES.filter(i => i.deviceType === effectiveType);
  
  if (!query) return filtered;
  
  const lowerQuery = query.toLowerCase();
  return filtered.filter(i => 
    i.name.toLowerCase().includes(lowerQuery) || 
    i.nameAr.includes(query)
  );
};
