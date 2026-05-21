// Comprehensive repair service data with real brand logos and all common issues

export interface Brand {
  id: string;
  name: string;
  logo?: any; // Optional raw asset/URL. UI renders a consistent brand chip
              // via <BrandLogo brandId={id} /> regardless, so new brands do
              // not need an image asset.
  models: string[];
  deviceType?: string; // 'phone', 'tablet', 'laptop', 'printer', 'watch', 'gaming'
  // Optional MaterialCommunityIcons name. When set (e.g. gaming brands with
  // no logo asset) the UI renders this icon instead of the logo image.
  icon?: string;
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
      'iPhone 16 Pro Max', 'iPhone 16 Pro', 'iPhone 16 Plus', 'iPhone 16',
      'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15 Plus', 'iPhone 15',
      'iPhone 14 Pro Max', 'iPhone 14 Pro', 'iPhone 14 Plus', 'iPhone 14',
      'iPhone 13 Pro Max', 'iPhone 13 Pro', 'iPhone 13', 'iPhone 13 Mini',
      'iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12', 'iPhone 12 Mini',
      'iPhone 11 Pro Max', 'iPhone 11 Pro', 'iPhone 11',
      'iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone X',
      'iPhone 8 Plus', 'iPhone 8', 'iPhone 7 Plus', 'iPhone 7',
      'iPhone 6s Plus', 'iPhone 6s', 'iPhone 6 Plus', 'iPhone 6',
      'iPhone SE (2022)', 'iPhone SE (2020)', 'iPhone SE (2016)',
      'iPhone 5s', 'iPhone 5c', 'iPhone 5', 'iPhone 4s'
    ]
  },
  {
    id: 'samsung',
    name: 'Samsung',
    deviceType: 'phone',
    logo: require('../assets/samsung-logo.png'),
    models: [
      'Galaxy S25 Ultra', 'Galaxy S25+', 'Galaxy S25',
      'Galaxy S24 Ultra', 'Galaxy S24+', 'Galaxy S24', 'Galaxy S24 FE',
      'Galaxy S23 Ultra', 'Galaxy S23+', 'Galaxy S23', 'Galaxy S23 FE',
      'Galaxy S22 Ultra', 'Galaxy S22+', 'Galaxy S22',
      'Galaxy S21 Ultra', 'Galaxy S21+', 'Galaxy S21',
      'Galaxy Z Fold 6', 'Galaxy Z Fold 5', 'Galaxy Z Fold 4', 'Galaxy Z Fold 3',
      'Galaxy Z Flip 6', 'Galaxy Z Flip 5', 'Galaxy Z Flip 4', 'Galaxy Z Flip 3',
      'Galaxy A54', 'Galaxy A53', 'Galaxy A52', 'Galaxy A51',
      'Galaxy A34', 'Galaxy A33', 'Galaxy A32', 'Galaxy A31',
      'Galaxy A24', 'Galaxy A23', 'Galaxy A22', 'Galaxy A21',
      'Galaxy A14', 'Galaxy A13', 'Galaxy A12', 'Galaxy A11',
      'Galaxy M54', 'Galaxy M53', 'Galaxy M52', 'Galaxy M51',
      'Galaxy Note 20 Ultra', 'Galaxy Note 20', 'Galaxy Note 10+', 'Galaxy Note 10',
      'Galaxy Note 9', 'Galaxy Note 8',
      'Galaxy S20 Ultra', 'Galaxy S20+', 'Galaxy S20', 'Galaxy S20 FE',
      'Galaxy S10+', 'Galaxy S10', 'Galaxy S10e', 'Galaxy S10 Lite',
      'Galaxy S9+', 'Galaxy S9', 'Galaxy S8+', 'Galaxy S8',
      'Galaxy A05s', 'Galaxy A05', 'Galaxy A04', 'Galaxy A03', 'Galaxy A03s',
      'Galaxy J7', 'Galaxy J6', 'Galaxy J5', 'Galaxy J2'
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
      'Y9s', 'Y9 Prime', 'Y9', 'Y7 Pro', 'Y7', 'Y6 Pro', 'Y6', 'Y5', 'Y3',
      'Mate 20 Pro', 'Mate 20', 'Mate 10 Pro', 'Mate 10',
      'P10 Plus', 'P10', 'P9', 'Nova 8', 'Nova 7', 'Nova 5T', 'Nova 3i'
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
      'Poco M6 Pro', 'Poco M6', 'Poco M5', 'Poco M4',
      'Redmi Note 8 Pro', 'Redmi Note 8', 'Redmi Note 7',
      'Redmi 12', 'Redmi 10', 'Redmi 9', 'Redmi 9A', 'Redmi 9C',
      'Xiaomi 10', 'Mi 9', 'Mi 8'
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
      'F23', 'F21 Pro', 'F21', 'F19 Pro', 'F19', 'F17', 'F11 Pro', 'F11',
      'A96', 'A76', 'A74', 'A57', 'A54', 'A53', 'A16', 'A15', 'A12', 'A9', 'A5'
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
      'Pixel 6 Pro', 'Pixel 6', 'Pixel 6a', 'Pixel 5', 'Pixel 4a',
      'Pixel 4 XL', 'Pixel 4', 'Pixel 3a', 'Pixel 3'
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
  {
    id: 'nokia',
    name: 'Nokia',
    deviceType: 'phone',
    models: [
      'Nokia G42', 'Nokia G22', 'Nokia X30', 'Nokia XR21', 'Nokia C32',
      'Nokia C22', 'Nokia 8.3', 'Nokia 5.4', 'Nokia 3.4', 'Nokia 105'
    ]
  },
  {
    id: 'motorola',
    name: 'Motorola',
    deviceType: 'phone',
    models: [
      'Edge 50 Ultra', 'Edge 40 Pro', 'Edge 40', 'Edge 30',
      'Moto G84', 'Moto G54', 'Moto G34', 'Moto G73', 'Moto G53',
      'Razr 40 Ultra', 'Razr 40', 'Moto E13'
    ]
  },
  {
    id: 'sony',
    name: 'Sony Xperia',
    deviceType: 'phone',
    models: [
      'Xperia 1 VI', 'Xperia 1 V', 'Xperia 5 V', 'Xperia 10 VI',
      'Xperia 10 V', 'Xperia 1 IV', 'Xperia 5 IV', 'Xperia Pro-I'
    ]
  },
  {
    id: 'nothing',
    name: 'Nothing',
    deviceType: 'phone',
    models: ['Phone (2a) Plus', 'Phone (2a)', 'Phone (2)', 'Phone (1)']
  },
  {
    id: 'infinix',
    name: 'Infinix',
    deviceType: 'phone',
    models: [
      'Note 40 Pro+', 'Note 40 Pro', 'Note 40', 'Note 30 Pro',
      'Zero 30', 'Hot 40 Pro', 'Hot 40', 'Smart 8', 'GT 10 Pro'
    ]
  },
  {
    id: 'tecno',
    name: 'Tecno',
    deviceType: 'phone',
    models: [
      'Phantom V Flip', 'Phantom V Fold', 'Camon 30 Pro', 'Camon 20 Pro',
      'Spark 20 Pro', 'Spark 20', 'Pova 6 Pro', 'Pova 5', 'Pop 8'
    ]
  },
  {
    id: 'lg',
    name: 'LG',
    deviceType: 'phone',
    models: [
      'LG Velvet', 'LG Wing', 'LG V60 ThinQ', 'LG G8 ThinQ',
      'LG K92', 'LG K62', 'LG K52', 'LG Q70'
    ]
  },
  {
    id: 'zte',
    name: 'ZTE',
    deviceType: 'phone',
    models: [
      'ZTE Axon 50 Ultra', 'ZTE Axon 40 Ultra', 'ZTE Blade V50',
      'ZTE Blade A73', 'ZTE Nubia Z60 Ultra', 'ZTE Nubia Flip'
    ]
  },
  {
    id: 'lenovo',
    name: 'Lenovo',
    deviceType: 'phone',
    models: [
      'Legion Y90', 'Legion Phone Duel 2', 'Lenovo K14 Plus', 'Lenovo K15'
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
      'iPad Pro 12.9" (2020)', 'iPad Pro 11" (2020)',
      'iPad Air (2024)', 'iPad Air (2022)', 'iPad Air (2019)',
      'iPad (10th gen)', 'iPad (9th gen)', 'iPad (8th gen)', 'iPad (7th gen)',
      'iPad mini (6th gen)', 'iPad mini (5th gen)', 'iPad mini (4th gen)'
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
      'Galaxy Tab S7+', 'Galaxy Tab S7', 'Galaxy Tab S6 Lite', 'Galaxy Tab S6',
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
  {
    id: 'xiaomi-tablet',
    name: 'Xiaomi Pad',
    deviceType: 'tablet',
    models: ['Pad 6S Pro', 'Pad 6 Pro', 'Pad 6', 'Pad 5 Pro', 'Pad 5', 'Redmi Pad SE', 'Redmi Pad']
  },
  {
    id: 'lenovo-tablet',
    name: 'Lenovo Tab',
    deviceType: 'tablet',
    models: ['Tab Extreme', 'Tab P12', 'Tab P11 Pro', 'Tab P11', 'Tab M11', 'Tab M10', 'Yoga Tab 13']
  },
  {
    id: 'microsoft-tablet',
    name: 'Microsoft Surface',
    deviceType: 'tablet',
    models: ['Surface Pro 10', 'Surface Pro 9', 'Surface Pro 8', 'Surface Go 4', 'Surface Go 3']
  },
  {
    id: 'honor-tablet',
    name: 'Honor Pad',
    deviceType: 'tablet',
    models: ['Pad 9', 'Pad X9', 'Pad X8 Pro', 'Pad X8', 'Pad 8']
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
      'MacBook Air (M1)', 'MacBook Pro 13" (M1)',
      'MacBook Pro 16" (Intel)', 'MacBook Pro 15" (Intel)', 'MacBook Pro 13" (Intel)',
      'MacBook Air (Intel, 2020)', 'MacBook Air (Intel, 2019)', 'MacBook 12" (Retina)'
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
  {
    id: 'lenovo-laptop',
    name: 'Lenovo',
    deviceType: 'laptop',
    models: [
      'ThinkPad X1 Carbon', 'ThinkPad T14', 'ThinkPad E14', 'Yoga Slim 7',
      'Yoga 9i', 'IdeaPad Pro 5', 'IdeaPad Slim 3', 'Legion Pro 7', 'Legion 5', 'LOQ 15'
    ]
  },
  {
    id: 'acer-laptop',
    name: 'Acer',
    deviceType: 'laptop',
    models: [
      'Swift Go', 'Swift X', 'Aspire 7', 'Aspire 5', 'Aspire 3',
      'Predator Helios', 'Nitro 5', 'TravelMate', 'Chromebook'
    ]
  },
  {
    id: 'msi-laptop',
    name: 'MSI',
    deviceType: 'laptop',
    models: [
      'Titan GT77', 'Raider GE78', 'Stealth 16', 'Vector GP68',
      'Katana 15', 'Cyborg 15', 'Modern 14', 'Prestige 13'
    ]
  },
  {
    id: 'microsoft-laptop',
    name: 'Microsoft Surface',
    deviceType: 'laptop',
    models: [
      'Surface Laptop 6', 'Surface Laptop 5', 'Surface Laptop Studio 2',
      'Surface Laptop Go 3', 'Surface Book 3'
    ]
  },
  {
    id: 'razer-laptop',
    name: 'Razer',
    deviceType: 'laptop',
    models: ['Blade 18', 'Blade 16', 'Blade 15', 'Blade 14', 'Book 13']
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
  },
  {
    id: 'garmin-watch',
    name: 'Garmin',
    deviceType: 'watch',
    models: [
      'Fenix 7 Pro', 'Fenix 7', 'Epix Pro', 'Forerunner 965', 'Forerunner 265',
      'Venu 3', 'Venu 2 Plus', 'Instinct 2', 'vívoactive 5'
    ]
  },
  {
    id: 'amazfit-watch',
    name: 'Amazfit',
    deviceType: 'watch',
    models: ['Balance', 'GTR 4', 'GTS 4', 'T-Rex 3', 'T-Rex Ultra', 'Bip 5', 'Active']
  },
  {
    id: 'xiaomi-watch',
    name: 'Xiaomi Watch',
    deviceType: 'watch',
    models: ['Watch S3', 'Watch 2 Pro', 'Watch S1 Pro', 'Smart Band 9', 'Smart Band 8', 'Redmi Watch 4']
  },
  {
    id: 'fitbit-watch',
    name: 'Fitbit',
    deviceType: 'watch',
    models: ['Sense 2', 'Versa 4', 'Charge 6', 'Charge 5', 'Inspire 3', 'Luxe']
  },
  {
    id: 'honor-watch',
    name: 'Honor Watch',
    deviceType: 'watch',
    models: ['Watch 4 Pro', 'Watch 4', 'Watch GS 3', 'Watch ES', 'Band 9']
  },

  // ── Gaming Devices ────────────────────────────────────────────────────
  {
    id: 'playstation',
    name: 'PlayStation',
    deviceType: 'gaming',
    logo: require('../assets/logo.png'),
    icon: 'sony-playstation',
    models: [
      'PlayStation 5 Pro', 'PlayStation 5 Slim', 'PlayStation 5',
      'PlayStation 4 Pro', 'PlayStation 4 Slim', 'PlayStation 4',
      'PS VR2', 'DualSense Controller', 'DualShock 4 Controller'
    ]
  },
  {
    id: 'xbox',
    name: 'Xbox',
    deviceType: 'gaming',
    logo: require('../assets/logo.png'),
    icon: 'microsoft-xbox',
    models: [
      'Xbox Series X', 'Xbox Series S', 'Xbox One X',
      'Xbox One S', 'Xbox One', 'Xbox Wireless Controller'
    ]
  },
  {
    id: 'nintendo',
    name: 'Nintendo',
    deviceType: 'gaming',
    logo: require('../assets/logo.png'),
    icon: 'nintendo-switch',
    models: [
      'Switch 2', 'Switch OLED', 'Switch', 'Switch Lite',
      'Joy-Con Controllers', 'Pro Controller'
    ]
  },
  {
    id: 'gaming-accessories',
    name: 'Gaming Accessories',
    deviceType: 'gaming',
    logo: require('../assets/logo.png'),
    icon: 'gamepad-variant',
    models: [
      'Controller', 'Headset', 'Charging Dock',
      'Cable', 'Cooling Stand', 'Other Accessory'
    ]
  },
  {
    id: 'steam',
    name: 'Steam Deck',
    deviceType: 'gaming',
    icon: 'steam',
    models: ['Steam Deck OLED', 'Steam Deck LCD (512GB)', 'Steam Deck LCD (256GB)', 'Steam Deck LCD (64GB)']
  },
  {
    id: 'asus-gaming',
    name: 'ASUS ROG',
    deviceType: 'gaming',
    models: ['ROG Ally X', 'ROG Ally', 'ROG Raikiri Controller']
  }
];

// Pricing notes (Saudi market, 2026 Q2):
// Each priceRange is benchmarked against the prevailing labour + parts cost
// for the typical mid-tier device in Riyadh/Jeddah/Dammam, with the upper
// bound covering flagships (iPhone Pro Max, Galaxy Ultra, MacBook Pro).
// `estimatedPrice` is the median we surface as the "from" line in the UI.

export const ISSUES: Issue[] = [
  // ── Phones ────────────────────────────────────────────────────────────
  {
    id: 'screen',
    name: 'Screen Repair',
    nameAr: 'إصلاح الشاشة',
    icon: 'cellphone-screenshot',
    estimatedPrice: 280,
    priceRange: { min: 200, max: 1100 },
    deviceType: 'phone',
  },
  {
    id: 'battery',
    name: 'Battery Replacement',
    nameAr: 'تبديل البطارية',
    icon: 'battery-charging',
    estimatedPrice: 160,
    priceRange: { min: 120, max: 380 },
    deviceType: 'phone',
  },
  {
    id: 'charging',
    name: 'Charging Port',
    nameAr: 'منفذ الشحن',
    icon: 'usb-port',
    estimatedPrice: 130,
    priceRange: { min: 100, max: 220 },
    deviceType: 'phone',
  },
  {
    id: 'camera',
    name: 'Camera Repair',
    nameAr: 'إصلاح الكاميرا',
    icon: 'camera',
    estimatedPrice: 220,
    priceRange: { min: 180, max: 500 },
    deviceType: 'phone',
  },
  {
    id: 'speaker',
    name: 'Speaker / Mic',
    nameAr: 'سماعة / مايك',
    icon: 'speaker',
    estimatedPrice: 130,
    priceRange: { min: 100, max: 220 },
    deviceType: 'phone',
  },
  {
    id: 'back-glass',
    name: 'Back Glass',
    nameAr: 'الزجاج الخلفي',
    icon: 'cellphone-back',
    estimatedPrice: 200,
    priceRange: { min: 150, max: 500 },
    deviceType: 'phone',
  },
  {
    id: 'water-damage',
    name: 'Water Damage',
    nameAr: 'ضرر السوائل',
    icon: 'water-alert',
    estimatedPrice: 350,
    priceRange: { min: 250, max: 1000 },
    deviceType: 'phone',
  },
  {
    id: 'software',
    name: 'Software Issue',
    nameAr: 'مشكلة برمجية',
    icon: 'cellphone-cog',
    estimatedPrice: 120,
    priceRange: { min: 80, max: 200 },
    deviceType: 'phone',
  },
  {
    id: 'other-phone',
    name: 'Other Issue',
    nameAr: 'أخرى',
    icon: 'dots-horizontal-circle-outline',
    estimatedPrice: 0,
    deviceType: 'phone',
  },

  // ── Laptops ───────────────────────────────────────────────────────────
  {
    id: 'laptop-screen',
    name: 'Screen Repair',
    nameAr: 'إصلاح الشاشة',
    icon: 'laptop-off',
    estimatedPrice: 550,
    priceRange: { min: 450, max: 1300 },
    deviceType: 'laptop',
  },
  {
    id: 'keyboard',
    name: 'Keyboard Repair',
    nameAr: 'إصلاح لوحة المفاتيح',
    icon: 'keyboard-outline',
    estimatedPrice: 250,
    priceRange: { min: 200, max: 500 },
    deviceType: 'laptop',
  },
  {
    id: 'laptop-battery',
    name: 'Battery Replacement',
    nameAr: 'تبديل البطارية',
    icon: 'battery-charging',
    estimatedPrice: 320,
    priceRange: { min: 250, max: 550 },
    deviceType: 'laptop',
  },
  {
    id: 'laptop-upgrade',
    name: 'RAM / SSD Upgrade',
    nameAr: 'ترقية الرام / الهارد',
    icon: 'memory',
    estimatedPrice: 350,
    priceRange: { min: 250, max: 850 },
    deviceType: 'laptop',
  },
  {
    id: 'laptop-os',
    name: 'OS Reinstall',
    nameAr: 'إعادة تنصيب النظام',
    icon: 'desktop-tower-monitor',
    estimatedPrice: 150,
    priceRange: { min: 100, max: 220 },
    deviceType: 'laptop',
  },
  {
    id: 'laptop-hinge',
    name: 'Hinge Repair',
    nameAr: 'إصلاح المفصلات',
    icon: 'laptop',
    estimatedPrice: 250,
    priceRange: { min: 200, max: 400 },
    deviceType: 'laptop',
  },
  {
    id: 'laptop-liquid',
    name: 'Liquid Damage',
    nameAr: 'ضرر السوائل',
    icon: 'water-alert',
    estimatedPrice: 500,
    priceRange: { min: 350, max: 900 },
    deviceType: 'laptop',
  },
  {
    id: 'other-laptop',
    name: 'Other Issue',
    nameAr: 'أخرى',
    icon: 'dots-horizontal-circle-outline',
    estimatedPrice: 0,
    deviceType: 'laptop',
  },

  // ── Tablets ───────────────────────────────────────────────────────────
  {
    id: 'tablet-screen',
    name: 'Screen Repair',
    nameAr: 'إصلاح الشاشة',
    icon: 'tablet',
    estimatedPrice: 500,
    priceRange: { min: 400, max: 950 },
    deviceType: 'tablet',
  },
  {
    id: 'tablet-battery',
    name: 'Battery Replacement',
    nameAr: 'تبديل البطارية',
    icon: 'battery-charging',
    estimatedPrice: 320,
    priceRange: { min: 250, max: 480 },
    deviceType: 'tablet',
  },
  {
    id: 'tablet-charging',
    name: 'Charging Port',
    nameAr: 'منفذ الشحن',
    icon: 'usb-port',
    estimatedPrice: 200,
    priceRange: { min: 150, max: 320 },
    deviceType: 'tablet',
  },
  {
    id: 'tablet-software',
    name: 'Software Issue',
    nameAr: 'مشكلة برمجية',
    icon: 'tablet-cellphone',
    estimatedPrice: 150,
    priceRange: { min: 100, max: 220 },
    deviceType: 'tablet',
  },
  {
    id: 'other-tablet',
    name: 'Other Issue',
    nameAr: 'أخرى',
    icon: 'dots-horizontal-circle-outline',
    estimatedPrice: 0,
    deviceType: 'tablet',
  },

  // ── Watches ───────────────────────────────────────────────────────────
  {
    id: 'watch-screen',
    name: 'Screen Repair',
    nameAr: 'إصلاح الشاشة',
    icon: 'watch-variant',
    estimatedPrice: 380,
    priceRange: { min: 280, max: 650 },
    deviceType: 'watch',
  },
  {
    id: 'watch-battery',
    name: 'Battery Replacement',
    nameAr: 'تبديل البطارية',
    icon: 'battery-charging',
    estimatedPrice: 200,
    priceRange: { min: 180, max: 320 },
    deviceType: 'watch',
  },
  {
    id: 'watch-crown',
    name: 'Crown / Buttons',
    nameAr: 'إصلاح الأزرار',
    icon: 'circle-double',
    estimatedPrice: 200,
    priceRange: { min: 150, max: 280 },
    deviceType: 'watch',
  },
  {
    id: 'other-watch',
    name: 'Other Issue',
    nameAr: 'أخرى',
    icon: 'dots-horizontal-circle-outline',
    estimatedPrice: 0,
    deviceType: 'watch',
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
  },

  // ── Gaming Devices ────────────────────────────────────────────────────
  {
    id: 'gaming-no-power',
    name: 'Not Powering On',
    nameAr: 'لا يعمل / لا يشتغل',
    icon: 'power-plug-off',
    estimatedPrice: 250,
    priceRange: { min: 150, max: 600 },
    deviceType: 'gaming',
  },
  {
    id: 'gaming-hdmi',
    name: 'HDMI / Display Port',
    nameAr: 'منفذ HDMI / الصورة',
    icon: 'video-input-hdmi',
    estimatedPrice: 300,
    priceRange: { min: 200, max: 700 },
    deviceType: 'gaming',
  },
  {
    id: 'gaming-overheat',
    name: 'Overheating / Fan Noise',
    nameAr: 'سخونة / صوت المروحة',
    icon: 'fan',
    estimatedPrice: 200,
    priceRange: { min: 120, max: 450 },
    deviceType: 'gaming',
  },
  {
    id: 'gaming-disc',
    name: 'Disc Drive Issue',
    nameAr: 'مشكلة محرك الأقراص',
    icon: 'disc',
    estimatedPrice: 280,
    priceRange: { min: 180, max: 550 },
    deviceType: 'gaming',
  },
  {
    id: 'gaming-controller',
    name: 'Controller Repair',
    nameAr: 'إصلاح يد التحكم',
    icon: 'gamepad-variant',
    estimatedPrice: 120,
    priceRange: { min: 60, max: 300 },
    deviceType: 'gaming',
  },
  {
    id: 'other-gaming',
    name: 'Other Issue',
    nameAr: 'أخرى',
    icon: 'dots-horizontal-circle-outline',
    estimatedPrice: 0,
    deviceType: 'gaming',
  },

  // ── Other / Custom devices ────────────────────────────────────────────
  {
    id: 'other-general-diagnose',
    name: 'Diagnosis / Inspection',
    nameAr: 'فحص وتشخيص',
    icon: 'magnify-scan',
    estimatedPrice: 0,
    deviceType: 'other',
  },
  {
    id: 'other-general',
    name: 'Other Issue',
    nameAr: 'أخرى',
    icon: 'dots-horizontal-circle-outline',
    estimatedPrice: 0,
    deviceType: 'other',
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
