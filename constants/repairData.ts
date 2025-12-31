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

// All major brands with SVG logos where possible
export const BRANDS: Brand[] = [
  // Phones
  {
    id: 'apple',
    name: 'Apple',
    deviceType: 'phone',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
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
    logo: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg',
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
    logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Huawei_Logo.svg',
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
    logo: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Xiaomi_logo_%282021-%29.svg',
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
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/OPPO_Logo.svg',
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
    logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Vivo_mobile_logo.png',
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
    logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2b/OnePlus_Logo.svg',
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
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/13/Realme_logo.svg',
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
    id: 'nokia',
    name: 'Nokia',
    deviceType: 'phone',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/0/02/Nokia_wordmark.svg',
    models: [
      'Nokia G60', 'Nokia G50', 'Nokia G42', 'Nokia G22', 'Nokia G21', 'Nokia G20',
      'Nokia X30', 'Nokia X20', 'Nokia X10',
      'Nokia C32', 'Nokia C31', 'Nokia C30', 'Nokia C21', 'Nokia C20',
      'Nokia 8.3', 'Nokia 7.2', 'Nokia 6.2', 'Nokia 5.4', 'Nokia 5.3',
      'Nokia 3.4', 'Nokia 2.4', 'Nokia 1.4'
    ]
  },
  {
    id: 'sony',
    name: 'Sony Xperia',
    deviceType: 'phone',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Sony_logo.svg',
    models: [
      'Xperia 1 V', 'Xperia 1 IV', 'Xperia 1 III', 'Xperia 1 II',
      'Xperia 5 V', 'Xperia 5 IV', 'Xperia 5 III', 'Xperia 5 II',
      'Xperia 10 V', 'Xperia 10 IV', 'Xperia 10 III', 'Xperia 10 II',
      'Xperia Pro-I', 'Xperia Pro'
    ]
  },
  {
    id: 'motorola',
    name: 'Motorola',
    deviceType: 'phone',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/4/46/Motorola_new_logo.svg',
    models: [
      'Edge 40 Pro', 'Edge 40', 'Edge 30 Ultra', 'Edge 30 Pro', 'Edge 30',
      'Edge 20 Pro', 'Edge 20', 'Edge+', 'Edge',
      'Moto G84', 'Moto G73', 'Moto G72', 'Moto G62', 'Moto G52',
      'Moto G42', 'Moto G32', 'Moto G31', 'Moto G22', 'Moto G13',
      'Moto E40', 'Moto E32', 'Moto E22', 'Moto E13',
      'Razr 40 Ultra', 'Razr 40', 'Razr+'
    ]
  },
  {
    id: 'lenovo',
    name: 'Lenovo',
    deviceType: 'phone',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Lenovo_logo_2015.svg',
    models: [
      'Legion Y90', 'Legion Y70', 'Legion Duel 2', 'Legion Pro',
      'K15 Pro', 'K15', 'K14 Plus', 'K14', 'K13 Pro', 'K13',
      'Z6 Pro', 'Z6', 'Z5 Pro', 'Z5'
    ]
  },
  {
    id: 'lg',
    name: 'LG',
    deviceType: 'phone',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/LG_logo_%282015%29.svg',
    models: [
      'Wing', 'Velvet', 'V60 ThinQ', 'V50 ThinQ', 'V40 ThinQ',
      'G8X ThinQ', 'G8 ThinQ', 'G7 ThinQ',
      'Q92', 'Q70', 'Q60', 'Q52', 'Q51',
      'K92', 'K71', 'K62', 'K52', 'K42', 'K41'
    ]
  },
  
  // Tablet Brands
  {
    id: 'apple-tablet',
    name: 'Apple iPad',
    deviceType: 'tablet',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
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
    logo: 'https://upload.wikimedia.org/wikipedia/commons/2/24/Samsung_Logo.svg',
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
    logo: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Huawei_Logo.svg',
    models: [
      'MatePad Pro 13.2', 'MatePad Pro 12.6', 'MatePad Pro 11',
      'MatePad 11.5', 'MatePad 11', 'MatePad SE', 'MatePad T10'
    ]
  },
  {
    id: 'lenovo-tablet',
    name: 'Lenovo Tab',
    deviceType: 'tablet',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Lenovo_logo_2015.svg',
    models: [
      'Tab P12 Pro', 'Tab P11 Pro', 'Tab P11 Plus', 'Tab P11',
      'Tab M10 Plus', 'Tab M10', 'Tab M9', 'Tab M8'
    ]
  },
  {
    id: 'xiaomi-tablet',
    name: 'Xiaomi Pad',
    deviceType: 'tablet',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Xiaomi_logo_%282021-%29.svg',
    models: [
      'Xiaomi Pad 6 Pro', 'Xiaomi Pad 6', 'Xiaomi Pad 5 Pro', 'Xiaomi Pad 5',
      'Redmi Pad Pro', 'Redmi Pad SE', 'Redmi Pad'
    ]
  },
  
  // Laptop Brands
  {
    id: 'apple-laptop',
    name: 'Apple MacBook',
    deviceType: 'laptop',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg',
    models: [
      'MacBook Pro 16" (M3)', 'MacBook Pro 14" (M3)', 'MacBook Pro 13" (M2)',
      'MacBook Air 15" (M3)', 'MacBook Air 13" (M3)', 'MacBook Air 13" (M2)', 'MacBook Air (M1)'
    ]
  },
  {
    id: 'dell-laptop',
    name: 'Dell',
    deviceType: 'laptop',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/1/18/Dell_logo_2016.svg',
    models: [
      'XPS 15', 'XPS 13', 'XPS 17',
      'Inspiron 16', 'Inspiron 15', 'Inspiron 14',
      'Latitude 7440', 'Latitude 5440', 'Latitude 3540',
      'Alienware m18', 'Alienware x16', 'Alienware m16'
    ]
  },
  {
    id: 'hp-laptop',
    name: 'HP',
    deviceType: 'laptop',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/a/ad/HP_logo_2012.svg',
    models: [
      'Spectre x360', 'Envy x360', 'Pavilion 15',
      'EliteBook 840', 'ProBook 450',
      'OMEN 16', 'Victus 15'
    ]
  },
  {
    id: 'lenovo-laptop',
    name: 'Lenovo',
    deviceType: 'laptop',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Lenovo_logo_2015.svg',
    models: [
      'ThinkPad X1 Carbon', 'ThinkPad T14', 'ThinkPad E14',
      'Yoga 9i', 'Yoga 7i', 'IdeaPad 5', 'IdeaPad 3',
      'Legion Pro 7i', 'Legion 5i', 'Legion Slim 7'
    ]
  },
  {
    id: 'asus-laptop',
    name: 'ASUS',
    deviceType: 'laptop',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/ASUS_Logo.svg',
    models: [
      'Zenbook 14', 'Zenbook Pro 16', 'Vivobook 15', 'Vivobook S 14',
      'ROG Zephyrus G14', 'ROG Strix G16', 'TUF Gaming F15'
    ]
  },
  {
    id: 'acer-laptop',
    name: 'Acer',
    deviceType: 'laptop',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Acer_Logo.svg',
    models: [
      'Swift Go', 'Swift Edge', 'Aspire 5', 'Aspire 3',
      'Predator Helios 16', 'Nitro 5'
    ]
  }
];

export const ISSUES: Issue[] = [
  // Phone Issues
  {
    id: 'screen',
    name: 'Screen Replacement',
    nameAr: 'استبدال الشاشة',
    icon: 'phone-portrait-outline',
    estimatedPrice: 250,
    priceRange: { min: 150, max: 800 },
    deviceType: 'phone'
  },
  {
    id: 'battery',
    name: 'Battery Replacement',
    nameAr: 'استبدال البطارية',
    icon: 'battery-charging-outline',
    estimatedPrice: 150,
    priceRange: { min: 100, max: 300 },
    deviceType: 'phone'
  },
  {
    id: 'charging',
    name: 'Charging Port Repair',
    nameAr: 'إصلاح منفذ الشحن',
    icon: 'flash-outline',
    estimatedPrice: 100,
    priceRange: { min: 80, max: 200 },
    deviceType: 'phone'
  },
  {
    id: 'camera',
    name: 'Camera Repair',
    nameAr: 'إصلاح الكاميرا',
    icon: 'camera-outline',
    estimatedPrice: 200,
    priceRange: { min: 150, max: 500 },
    deviceType: 'phone'
  },
  {
    id: 'water',
    name: 'Water Damage',
    nameAr: 'تلف بسبب المياه',
    icon: 'water-outline',
    estimatedPrice: 300,
    priceRange: { min: 200, max: 1000 },
    deviceType: 'phone'
  },
  {
    id: 'software',
    name: 'Software Issue',
    nameAr: 'مشكلة برمجية',
    icon: 'code-slash-outline',
    estimatedPrice: 100,
    priceRange: { min: 50, max: 150 },
    deviceType: 'phone'
  },
  {
    id: 'speaker',
    name: 'Speaker/Mic Repair',
    nameAr: 'إصلاح السماعة/الميكروفون',
    icon: 'volume-high-outline',
    estimatedPrice: 120,
    priceRange: { min: 80, max: 250 },
    deviceType: 'phone'
  },
  {
    id: 'back-glass',
    name: 'Back Glass Replacement',
    nameAr: 'استبدال الزجاج الخلفي',
    icon: 'phone-portrait-outline',
    estimatedPrice: 180,
    priceRange: { min: 120, max: 400 },
    deviceType: 'phone'
  },
  {
    id: 'buttons',
    name: 'Buttons Repair',
    nameAr: 'إصلاح الأزرار',
    icon: 'radio-button-on-outline',
    estimatedPrice: 80,
    priceRange: { min: 50, max: 150 },
    deviceType: 'phone'
  },
  {
    id: 'other-phone',
    name: 'Other',
    nameAr: 'أخرى',
    icon: 'help-circle-outline',
    estimatedPrice: 0,
    priceRange: { min: 0, max: 0 },
    deviceType: 'phone'
  },

  // Tablet Issues
  {
    id: 'tablet-screen',
    name: 'Screen Replacement',
    nameAr: 'استبدال الشاشة',
    icon: 'tablet-portrait-outline',
    estimatedPrice: 350,
    priceRange: { min: 250, max: 1200 },
    deviceType: 'tablet'
  },
  {
    id: 'tablet-battery',
    name: 'Battery Replacement',
    nameAr: 'استبدال البطارية',
    icon: 'battery-charging-outline',
    estimatedPrice: 200,
    priceRange: { min: 150, max: 400 },
    deviceType: 'tablet'
  },
  {
    id: 'tablet-charging',
    name: 'Charging Port Repair',
    nameAr: 'إصلاح منفذ الشحن',
    icon: 'flash-outline',
    estimatedPrice: 120,
    priceRange: { min: 100, max: 250 },
    deviceType: 'tablet'
  },
  {
    id: 'tablet-software',
    name: 'Software Issue',
    nameAr: 'مشكلة برمجية',
    icon: 'code-slash-outline',
    estimatedPrice: 100,
    priceRange: { min: 80, max: 200 },
    deviceType: 'tablet'
  },
  {
    id: 'other-tablet',
    name: 'Other',
    nameAr: 'أخرى',
    icon: 'help-circle-outline',
    estimatedPrice: 0,
    priceRange: { min: 0, max: 0 },
    deviceType: 'tablet'
  },

  // Laptop Issues
  {
    id: 'laptop-screen',
    name: 'Screen Replacement',
    nameAr: 'استبدال الشاشة',
    icon: 'laptop-outline',
    estimatedPrice: 450,
    priceRange: { min: 300, max: 1500 },
    deviceType: 'laptop'
  },
  {
    id: 'laptop-keyboard',
    name: 'Keyboard Replacement',
    nameAr: 'استبدال لوحة المفاتيح',
    icon: 'keypad-outline',
    estimatedPrice: 200,
    priceRange: { min: 150, max: 500 },
    deviceType: 'laptop'
  },
  {
    id: 'laptop-battery',
    name: 'Battery Replacement',
    nameAr: 'استبدال البطارية',
    icon: 'battery-charging-outline',
    estimatedPrice: 250,
    priceRange: { min: 180, max: 600 },
    deviceType: 'laptop'
  },
  {
    id: 'laptop-charging',
    name: 'Charging Port Repair',
    nameAr: 'إصلاح منفذ الشحن',
    icon: 'flash-outline',
    estimatedPrice: 150,
    priceRange: { min: 100, max: 300 },
    deviceType: 'laptop'
  },
  {
    id: 'laptop-overheat',
    name: 'Overheating/Fan Cleaning',
    nameAr: 'ارتفاع الحرارة/تنظيف المروحة',
    icon: 'thermometer-outline',
    estimatedPrice: 100,
    priceRange: { min: 80, max: 200 },
    deviceType: 'laptop'
  },
  {
    id: 'laptop-software',
    name: 'Windows/Software Issue',
    nameAr: 'مشكلة ويندوز/برمجية',
    icon: 'logo-windows',
    estimatedPrice: 100,
    priceRange: { min: 50, max: 200 },
    deviceType: 'laptop'
  },
  {
    id: 'laptop-ssd',
    name: 'SSD/RAM Upgrade',
    nameAr: 'ترقية SSD/RAM',
    icon: 'hardware-chip-outline',
    estimatedPrice: 300,
    priceRange: { min: 200, max: 1000 },
    deviceType: 'laptop'
  },
  {
    id: 'other-laptop',
    name: 'Other',
    nameAr: 'أخرى',
    icon: 'help-circle-outline',
    estimatedPrice: 0,
    priceRange: { min: 0, max: 0 },
    deviceType: 'laptop'
  },

  // Watch Issues
  {
    id: 'watch-screen',
    name: 'Screen Replacement',
    nameAr: 'استبدال الشاشة',
    icon: 'watch-outline',
    estimatedPrice: 300,
    priceRange: { min: 200, max: 800 },
    deviceType: 'watch'
  },
  {
    id: 'watch-battery',
    name: 'Battery Replacement',
    nameAr: 'استبدال البطارية',
    icon: 'battery-charging-outline',
    estimatedPrice: 150,
    priceRange: { min: 100, max: 300 },
    deviceType: 'watch'
  },
  {
    id: 'other-watch',
    name: 'Other',
    nameAr: 'أخرى',
    icon: 'help-circle-outline',
    estimatedPrice: 0,
    priceRange: { min: 0, max: 0 },
    deviceType: 'watch'
  }
];

export const searchBrands = (query: string, deviceType: string): Brand[] => {
  const lowerQuery = query.toLowerCase();
  return BRANDS.filter(
    (brand) => 
      brand.deviceType === deviceType && 
      brand.name.toLowerCase().includes(lowerQuery)
  );
};

export const searchModels = (brandId: string, query: string): string[] => {
  const brand = BRANDS.find((b) => b.id === brandId);
  if (!brand) return [];
  const lowerQuery = query.toLowerCase();
  return brand.models.filter((model) => model.toLowerCase().includes(lowerQuery));
};

export const searchIssues = (deviceType: string, query: string): Issue[] => {
  const lowerQuery = query.toLowerCase();
  return ISSUES.filter(
    (issue) => 
      issue.deviceType === deviceType && 
      (issue.name.toLowerCase().includes(lowerQuery) || issue.nameAr.includes(lowerQuery))
  );
};
