// Comprehensive repair service data with real brand logos and all common issues

export interface Brand {
  id: string;
  name: string;
  logo: any;
  models: string[];
  deviceType?: string; // 'phone', 'tablet', 'laptop', 'printer', 'watch'
}

export interface Issue {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  estimatedPrice: number;
}

// All major phone brands with logos
export const BRANDS: Brand[] = [
  {
    id: 'apple',
    name: 'Apple',
    deviceType: 'phone',
    logo: require('../assets/brands/apple.png'),
    deviceType: 'phone',
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
    logo: require('../assets/brands/samsung.png'),
    deviceType: 'phone',
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
    logo: require('../assets/brands/huawei.png'),
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
    logo: require('../assets/brands/xiaomi.png'),
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
    logo: require('../assets/brands/oppo.png'),
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
    logo: require('../assets/brands/vivo.png'),
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
    logo: require('../assets/brands/oneplus.png'),
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
    logo: require('../assets/brands/realme.png'),
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
    logo: require('../assets/brands/nokia.png'),
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
    logo: require('../assets/brands/sony.png'),
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
    logo: require('../assets/brands/motorola.png'),
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
    logo: require('../assets/brands/lenovo.png'),
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
    logo: require('../assets/brands/lg.png'),
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
    logo: require('../assets/brands/apple.png'),
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
    logo: require('../assets/brands/samsung.png'),
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
    logo: require('../assets/brands/huawei.png'),
    models: [
      'MatePad Pro 13.2', 'MatePad Pro 12.6', 'MatePad Pro 11',
      'MatePad 11.5', 'MatePad 11', 'MatePad SE', 'MatePad T10'
    ]
  },
  {
    id: 'lenovo-tablet',
    name: 'Lenovo Tab',
    deviceType: 'tablet',
    logo: require('../assets/brands/lenovo.png'),
    models: [
      'Tab P12 Pro', 'Tab P11 Pro', 'Tab P11 Plus', 'Tab P11',
      'Tab M10 Plus', 'Tab M10', 'Tab M9', 'Tab M8'
    ]
  },
  {
    id: 'xiaomi-tablet',
    name: 'Xiaomi Pad',
    deviceType: 'tablet',
    logo: require('../assets/brands/xiaomi.png'),
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
    logo: require('../assets/brands/apple.png'),
    models: [
      'MacBook Pro 16" M3', 'MacBook Pro 14" M3', 'MacBook Air 15" M3', 'MacBook Air 13" M3',
      'MacBook Pro 16" M2', 'MacBook Pro 14" M2', 'MacBook Air 15" M2', 'MacBook Air 13" M2'
    ]
  },
  {
    id: 'hp',
    name: 'HP',
    deviceType: 'laptop',
    logo: require('../assets/brands/apple.png'), // Placeholder - actual logo rendered by BrandLogo component
    models: [
      'HP Spectre x360', 'HP Envy', 'HP Pavilion', 'HP EliteBook', 'HP ProBook',
      'HP Omen', 'HP Victus', 'HP 15s', 'HP 14s'
    ]
  },
  {
    id: 'dell',
    name: 'Dell',
    deviceType: 'laptop',
    logo: require('../assets/brands/apple.png'), // Placeholder - actual logo rendered by BrandLogo component
    models: [
      'Dell XPS 15', 'Dell XPS 13', 'Dell Inspiron 15', 'Dell Inspiron 14',
      'Dell Latitude', 'Dell Precision', 'Dell G15', 'Dell Alienware'
    ]
  },
  {
    id: 'lenovo-laptop',
    name: 'Lenovo',
    deviceType: 'laptop',
    logo: require('../assets/brands/lenovo.png'),
    models: [
      'ThinkPad X1 Carbon', 'ThinkPad T14', 'ThinkPad E15', 'ThinkBook 15',
      'IdeaPad Slim 5', 'IdeaPad Gaming 3', 'Legion 5 Pro', 'Yoga 9i'
    ]
  },
  {
    id: 'asus',
    name: 'Asus',
    deviceType: 'laptop',
    logo: require('../assets/brands/apple.png'), // Placeholder - actual logo rendered by BrandLogo component
    models: [
      'ZenBook 14', 'ZenBook Pro', 'VivoBook 15', 'VivoBook S15',
      'ROG Zephyrus', 'ROG Strix', 'TUF Gaming', 'ExpertBook'
    ]
  },
  
  // Printer Brands
  {
    id: 'hp-printer',
    name: 'HP',
    deviceType: 'printer',
    logo: require('../assets/brands/apple.png'), // Placeholder - actual logo rendered by BrandLogo component
    models: [
      'HP LaserJet Pro', 'HP OfficeJet Pro', 'HP DeskJet', 'HP Envy',
      'HP Smart Tank', 'HP PageWide', 'HP Color LaserJet'
    ]
  },
  {
    id: 'canon',
    name: 'Canon',
    deviceType: 'printer',
    logo: require('../assets/brands/apple.png'), // Placeholder - actual logo rendered by BrandLogo component
    models: [
      'Canon PIXMA', 'Canon imageCLASS', 'Canon imageRUNNER',
      'Canon MAXIFY', 'Canon G Series', 'Canon TR Series'
    ]
  },
  {
    id: 'epson',
    name: 'Epson',
    deviceType: 'printer',
    logo: require('../assets/brands/apple.png'), // Placeholder - actual logo rendered by BrandLogo component
    models: [
      'Epson EcoTank', 'Epson WorkForce', 'Epson Expression',
      'Epson SureColor', 'Epson L Series', 'Epson M Series'
    ]
  },
  {
    id: 'brother',
    name: 'Brother',
    deviceType: 'printer',
    logo: require('../assets/brands/apple.png'), // Placeholder - actual logo rendered by BrandLogo component
    models: [
      'Brother HL-L2350DW', 'Brother MFC-L2750DW', 'Brother DCP-L2550DW',
      'Brother HL-L3230CDW', 'Brother MFC-J995DW', 'Brother DCP-T710W'
    ]
  },
  {
    id: 'samsung-printer',
    name: 'Samsung',
    deviceType: 'printer',
    logo: require('../assets/brands/samsung.png'),
    models: [
      'Samsung Xpress', 'Samsung ProXpress', 'Samsung MultiXpress',
      'Samsung M Series', 'Samsung C Series'
    ]
  },

  // Smartwatch Brands
  {
    id: 'apple-watch',
    name: 'Apple Watch',
    deviceType: 'watch',
    logo: require('../assets/brands/apple.png'),
    models: [
      'Apple Watch Ultra 2', 'Apple Watch Ultra',
      'Apple Watch Series 9', 'Apple Watch Series 8', 'Apple Watch Series 7',
      'Apple Watch Series 6', 'Apple Watch Series 5', 'Apple Watch Series 4',
      'Apple Watch SE (2023)', 'Apple Watch SE (2022)', 'Apple Watch SE'
    ]
  },
  {
    id: 'samsung-watch',
    name: 'Samsung Galaxy Watch',
    deviceType: 'watch',
    logo: require('../assets/brands/samsung.png'),
    models: [
      'Galaxy Watch 6 Classic', 'Galaxy Watch 6',
      'Galaxy Watch 5 Pro', 'Galaxy Watch 5',
      'Galaxy Watch 4 Classic', 'Galaxy Watch 4',
      'Galaxy Watch 3', 'Galaxy Watch Active 2', 'Galaxy Watch Active',
      'Galaxy Fit 3', 'Galaxy Fit 2', 'Galaxy Fit'
    ]
  },
  {
    id: 'huawei-watch',
    name: 'Huawei Watch',
    deviceType: 'watch',
    logo: require('../assets/brands/huawei.png'),
    models: [
      'Watch GT 4', 'Watch GT 3 Pro', 'Watch GT 3',
      'Watch GT 2 Pro', 'Watch GT 2e', 'Watch GT 2',
      'Watch Fit 3', 'Watch Fit 2', 'Watch Fit',
      'Band 8', 'Band 7', 'Band 6'
    ]
  },
  {
    id: 'xiaomi-watch',
    name: 'Xiaomi Watch',
    deviceType: 'watch',
    logo: require('../assets/brands/xiaomi.png'),
    models: [
      'Watch S3', 'Watch S2', 'Watch S1 Pro', 'Watch S1',
      'Watch 2 Pro', 'Watch 2', 'Watch Color 2',
      'Mi Band 8 Pro', 'Mi Band 8', 'Mi Band 7', 'Mi Band 6',
      'Redmi Watch 3 Active', 'Redmi Watch 3', 'Redmi Watch 2'
    ]
  },
  {
    id: 'garmin',
    name: 'Garmin',
    deviceType: 'watch',
    logo: require('../assets/brands/apple.png'), // Placeholder
    models: [
      'Fenix 7X', 'Fenix 7', 'Fenix 6X Pro', 'Fenix 6 Pro',
      'Forerunner 965', 'Forerunner 955', 'Forerunner 265', 'Forerunner 255',
      'Venu 3', 'Venu 2 Plus', 'Venu 2', 'Vivoactive 5', 'Vivoactive 4'
    ]
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    deviceType: 'watch',
    logo: require('../assets/brands/apple.png'), // Placeholder
    models: [
      'Sense 2', 'Sense', 'Versa 4', 'Versa 3', 'Versa 2',
      'Charge 6', 'Charge 5', 'Charge 4',
      'Inspire 3', 'Inspire 2', 'Luxe'
    ]
  },
  {
    id: 'amazfit',
    name: 'Amazfit',
    deviceType: 'watch',
    logo: require('../assets/brands/apple.png'), // Placeholder
    models: [
      'GTR 4', 'GTR 3 Pro', 'GTR 3', 'GTR 2e', 'GTR 2',
      'GTS 4', 'GTS 3', 'GTS 2e', 'GTS 2',
      'T-Rex Ultra', 'T-Rex 2', 'Bip 5', 'Bip 3 Pro', 'Bip 3'
    ]
  }
];

// Comprehensive list of all common device issues
export const ISSUES: Issue[] = [
  // Screen Issues
  {
    id: 'screen_broken',
    name: 'Broken Screen',
    nameAr: 'شاشة مكسورة',
    icon: 'tablet-cellphone',
    estimatedPrice: 600 // Market: 450-500 SAR + 20-25% profit
  },
  {
    id: 'screen_crack',
    name: 'Screen Crack',
    nameAr: 'شرخ في الشاشة',
    icon: 'cellphone-remove',
    estimatedPrice: 500 // Market: 400 SAR + 25% profit
  },
  {
    id: 'screen_black',
    name: 'Black Screen',
    nameAr: 'شاشة سوداء',
    icon: 'cellphone-off',
    estimatedPrice: 650 // Market: 500-550 SAR + 20% profit
  },
  {
    id: 'screen_lines',
    name: 'Lines on Screen',
    nameAr: 'خطوط على الشاشة',
    icon: 'cellphone-wireless',
    estimatedPrice: 550 // Market: 450 SAR + 22% profit
  },
  {
    id: 'touch_not_working',
    name: 'Touch Not Working',
    nameAr: 'اللمس لا يعمل',
    icon: 'gesture-tap',
    estimatedPrice: 600 // Market: 480-500 SAR + 20% profit
  },
  {
    id: 'screen_flickering',
    name: 'Screen Flickering',
    nameAr: 'وميض الشاشة',
    icon: 'flash',
    estimatedPrice: 520 // Market: 420 SAR + 24% profit
  },
  
  // Battery Issues
  {
    id: 'battery_drain',
    name: 'Battery Draining Fast',
    nameAr: 'البطارية تنفذ بسرعة',
    icon: 'battery-alert',
    estimatedPrice: 250 // Market: 200 SAR + 25% profit
  },
  {
    id: 'battery_not_charging',
    name: 'Not Charging',
    nameAr: 'لا يشحن',
    icon: 'battery-charging-outline',
    estimatedPrice: 280 // Market: 220-230 SAR + 22% profit
  },
  {
    id: 'battery_swollen',
    name: 'Swollen Battery',
    nameAr: 'بطارية منتفخة',
    icon: 'battery-alert-variant',
    estimatedPrice: 320 // Market: 250-260 SAR + 23% profit (urgent)
  },
  {
    id: 'battery_replacement',
    name: 'Battery Replacement',
    nameAr: 'استبدال البطارية',
    icon: 'battery',
    estimatedPrice: 280 // Market: 220-230 SAR + 22% profit
  },
  {
    id: 'charging_slow',
    name: 'Slow Charging',
    nameAr: 'شحن بطيء',
    icon: 'battery-charging-low',
    estimatedPrice: 200 // Market: 160 SAR + 25% profit
  },
  
  // Charging Port Issues
  {
    id: 'charging_port',
    name: 'Charging Port Issue',
    nameAr: 'مشكلة منفذ الشحن',
    icon: 'usb-port',
    estimatedPrice: 220 // Market: 180 SAR + 22% profit
  },
  {
    id: 'charging_port_loose',
    name: 'Loose Charging Port',
    nameAr: 'منفذ شحن مفكوك',
    icon: 'connection',
    estimatedPrice: 130
  },
  {
    id: 'charging_port_damaged',
    name: 'Damaged Charging Port',
    nameAr: 'منفذ شحن تالف',
    icon: 'alert-circle',
    estimatedPrice: 170
  },
  
  // Camera Issues
  {
    id: 'camera_not_working',
    name: 'Camera Not Working',
    nameAr: 'الكاميرا لا تعمل',
    icon: 'camera-off',
    estimatedPrice: 550
  },
  {
    id: 'camera_blurry',
    name: 'Blurry Camera',
    nameAr: 'كاميرا ضبابية',
    icon: 'camera',
    estimatedPrice: 220
  },
  {
    id: 'camera_lens_broken',
    name: 'Broken Camera Lens',
    nameAr: 'عدسة كاميرا مكسورة',
    icon: 'camera-enhance',
    estimatedPrice: 600
  },
  {
    id: 'front_camera_issue',
    name: 'Front Camera Issue',
    nameAr: 'مشكلة الكاميرا الأمامية',
    icon: 'camera-front',
    estimatedPrice: 230
  },
  {
    id: 'back_camera_issue',
    name: 'Back Camera Issue',
    nameAr: 'مشكلة الكاميرا الخلفية',
    icon: 'camera-rear',
    estimatedPrice: 260
  },
  
  // Audio Issues
  {
    id: 'speaker_not_working',
    name: 'Speaker Not Working',
    nameAr: 'السماعة لا تعمل',
    icon: 'volume-off',
    estimatedPrice: 220
  },
  {
    id: 'microphone_issue',
    name: 'Microphone Issue',
    nameAr: 'مشكلة الميكروفون',
    icon: 'microphone-off',
    estimatedPrice: 140
  },
  {
    id: 'earpiece_issue',
    name: 'Earpiece Issue',
    nameAr: 'مشكلة سماعة الأذن',
    icon: 'phone-hangup',
    estimatedPrice: 130
  },
  {
    id: 'no_sound',
    name: 'No Sound',
    nameAr: 'لا يوجد صوت',
    icon: 'volume-mute',
    estimatedPrice: 160
  },
  {
    id: 'headphone_jack',
    name: 'Headphone Jack Issue',
    nameAr: 'مشكلة منفذ السماعة',
    icon: 'headphones',
    estimatedPrice: 600
  },
  
  // Button Issues
  {
    id: 'power_button',
    name: 'Power Button Issue',
    nameAr: 'مشكلة زر الطاقة',
    icon: 'power',
    estimatedPrice: 180
  },
  {
    id: 'volume_button',
    name: 'Volume Button Issue',
    nameAr: 'مشكلة زر الصوت',
    icon: 'volume-high',
    estimatedPrice: 90
  },
  {
    id: 'home_button',
    name: 'Home Button Issue',
    nameAr: 'مشكلة زر الهوم',
    icon: 'home',
    estimatedPrice: 110
  },
  
  // Software Issues
  {
    id: 'software_crash',
    name: 'Software Crash',
    nameAr: 'تعطل النظام',
    icon: 'alert',
    estimatedPrice: 150
  },
  {
    id: 'slow_performance',
    name: 'Slow Performance',
    nameAr: 'أداء بطيء',
    icon: 'speedometer-slow',
    estimatedPrice: 70
  },
  {
    id: 'wont_turn_on',
    name: 'Won\'t Turn On',
    nameAr: 'لا يعمل',
    icon: 'power-off',
    estimatedPrice: 220
  },
  {
    id: 'freezing',
    name: 'Freezing/Hanging',
    nameAr: 'تجميد/تعليق',
    icon: 'snowflake',
    estimatedPrice: 90
  },
  {
    id: 'boot_loop',
    name: 'Boot Loop',
    nameAr: 'حلقة إعادة التشغيل',
    icon: 'restart',
    estimatedPrice: 600
  },
  {
    id: 'virus_malware',
    name: 'Virus/Malware',
    nameAr: 'فيروس/برمجيات خبيثة',
    icon: 'bug',
    estimatedPrice: 180
  },
  {
    id: 'system_update',
    name: 'System Update Issue',
    nameAr: 'مشكلة تحديث النظام',
    icon: 'update',
    estimatedPrice: 150
  },
  
  // Connectivity Issues
  {
    id: 'wifi_not_working',
    name: 'WiFi Not Working',
    nameAr: 'الواي فاي لا يعمل',
    icon: 'wifi-off',
    estimatedPrice: 130
  },
  {
    id: 'bluetooth_issue',
    name: 'Bluetooth Issue',
    nameAr: 'مشكلة البلوتوث',
    icon: 'bluetooth-off',
    estimatedPrice: 600
  },
  {
    id: 'no_signal',
    name: 'No Signal',
    nameAr: 'لا توجد إشارة',
    icon: 'signal-off',
    estimatedPrice: 180
  },
  {
    id: 'sim_not_detected',
    name: 'SIM Not Detected',
    nameAr: 'الشريحة غير مكتشفة',
    icon: 'sim-alert',
    estimatedPrice: 140
  },
  {
    id: 'gps_not_working',
    name: 'GPS Not Working',
    nameAr: 'GPS لا يعمل',
    icon: 'map-marker-off',
    estimatedPrice: 220
  },
  
  // Physical Damage
  {
    id: 'water_damage',
    name: 'Water Damage',
    nameAr: 'ضرر مائي',
    icon: 'water',
    estimatedPrice: 600
  },
  {
    id: 'back_glass_broken',
    name: 'Broken Back Glass',
    nameAr: 'زجاج خلفي مكسور',
    icon: 'cellphone-screenshot',
    estimatedPrice: 180
  },
  {
    id: 'frame_bent',
    name: 'Bent Frame',
    nameAr: 'إطار منحني',
    icon: 'cellphone-settings',
    estimatedPrice: 550
  },
  {
    id: 'overheating',
    name: 'Overheating',
    nameAr: 'سخونة زائدة',
    icon: 'thermometer',
    estimatedPrice: 160
  },
  
  // Storage Issues
  {
    id: 'storage_full',
    name: 'Storage Full',
    nameAr: 'الذاكرة ممتلئة',
    icon: 'harddisk',
    estimatedPrice: 60
  },
  {
    id: 'sd_card_issue',
    name: 'SD Card Issue',
    nameAr: 'مشكلة بطاقة الذاكرة',
    icon: 'sd',
    estimatedPrice: 150
  },
  
  // Other Issues
  {
    id: 'face_id_issue',
    name: 'Face ID Not Working',
    nameAr: 'Face ID لا يعمل',
    icon: 'face-recognition',
    estimatedPrice: 600
  },
  {
    id: 'fingerprint_issue',
    name: 'Fingerprint Scanner Issue',
    nameAr: 'مشكلة بصمة الإصبع',
    icon: 'fingerprint',
    estimatedPrice: 180
  },
  {
    id: 'vibration_issue',
    name: 'Vibration Not Working',
    nameAr: 'الاهتزاز لا يعمل',
    icon: 'vibrate',
    estimatedPrice: 180
  },
  {
    id: 'proximity_sensor',
    name: 'Proximity Sensor Issue',
    nameAr: 'مشكلة مستشعر القرب',
    icon: 'radar',
    estimatedPrice: 600
  },
  {
    id: 'data_recovery',
    name: 'Data Recovery',
    nameAr: 'استعادة البيانات',
    icon: 'database',
    estimatedPrice: 220
  },
  {
    id: 'factory_reset',
    name: 'Factory Reset Needed',
    nameAr: 'يحتاج إعادة ضبط المصنع',
    icon: 'restore',
    estimatedPrice: 50
  },
  {
    id: 'other',
    name: 'Other Issue',
    nameAr: 'مشكلة أخرى',
    icon: 'help-circle',
    estimatedPrice: 180
  }
];

// Helper function to search brands
export const searchBrands = (query: string): Brand[] => {
  if (!query.trim()) return BRANDS;
  
  const lowerQuery = query.toLowerCase();
  return BRANDS.filter(brand => 
    brand.name.toLowerCase().includes(lowerQuery)
  );
};

// Helper function to search models within a brand
export const searchModels = (brandId: string, query: string): string[] => {
  const brand = BRANDS.find(b => b.id === brandId);
  if (!brand) return [];
  
  if (!query.trim()) return brand.models;
  
  const lowerQuery = query.toLowerCase();
  return brand.models.filter(model => 
    model.toLowerCase().includes(lowerQuery)
  );
};

// Helper function to search issues
export const searchIssues = (query: string, language: 'en' | 'ar' = 'en'): Issue[] => {
  if (!query.trim()) return ISSUES;
  
  const lowerQuery = query.toLowerCase();
  return ISSUES.filter(issue => {
    if (language === 'ar') {
      return issue.nameAr.includes(query) || issue.name.toLowerCase().includes(lowerQuery);
    }
    return issue.name.toLowerCase().includes(lowerQuery) || issue.nameAr.includes(query);
  });
};
