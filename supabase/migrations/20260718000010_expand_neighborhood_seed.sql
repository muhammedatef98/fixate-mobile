-- Expand service_area_neighborhoods with real district lists per city.
-- 1) Remove accidental duplicate rows (same city + Arabic name).
-- 2) Unique index so duplicates cannot recur.
-- 3) Seed comprehensive neighborhoods — thorough for the Eastern Province
--    (the operating market) plus the major cities. New rows inherit the
--    city's delivery_fee so pricing behavior is unchanged (a 0 fee on a
--    matched neighborhood would otherwise override the city fee).

DELETE FROM service_area_neighborhoods a
USING service_area_neighborhoods b
WHERE a.city_id = b.city_id
  AND a.name_ar = b.name_ar
  AND a.id > b.id;

CREATE UNIQUE INDEX IF NOT EXISTS service_area_neighborhoods_city_name_key
  ON service_area_neighborhoods (city_id, name_ar);

WITH data(city_en, name_ar, name_en) AS (
  VALUES
  -- ── Saihat ──
  ('Saihat', 'الكوثر', 'Al Kawthar'),
  ('Saihat', 'الزهور', 'Az Zuhur'),
  ('Saihat', 'الكويت', 'Al Kuwait'),
  ('Saihat', 'القدس', 'Al Quds'),
  ('Saihat', 'الشريعة', 'Ash Shariah'),
  ('Saihat', 'المجدل', 'Al Majdal'),
  ('Saihat', 'الفتح', 'Al Fath'),
  ('Saihat', 'الروضة', 'Ar Rawdah'),
  ('Saihat', 'البستان', 'Al Bustan'),
  -- ── Qatif ──
  ('Qatif', 'أبو معن', 'Abu Ma''n'),
  -- ── Tarout ──
  ('Tarout', 'دارين', 'Darin'),
  -- ── Safwa ──
  ('Safwa', 'أم الساهك', 'Umm As Sahik'),
  -- ── Ras Tanura ──
  ('Ras Tanura', 'رحيمة', 'Rahima'),
  -- ── Dammam ──
  ('Dammam', 'العزيزية', 'Al Aziziyah'),
  ('Dammam', 'البساتين', 'Al Basatin'),
  ('Dammam', 'النخيل', 'An Nakhil'),
  ('Dammam', 'الزهور', 'Az Zuhur'),
  ('Dammam', 'النهضة', 'An Nahdah'),
  ('Dammam', 'الصفا', 'As Safa'),
  ('Dammam', 'العنود', 'Al Anud'),
  ('Dammam', 'الفاخرية', 'Al Fakhriyah'),
  ('Dammam', 'القزاز', 'Al Qazaz'),
  ('Dammam', 'الخضرية', 'Al Khudriyah'),
  ('Dammam', 'السيف', 'As Saif'),
  ('Dammam', 'ابن خلدون', 'Ibn Khaldun'),
  ('Dammam', 'المحمدية', 'Al Muhammadiyah'),
  ('Dammam', 'طيبة', 'Taybah'),
  ('Dammam', 'الشفا', 'Ash Shifa'),
  ('Dammam', 'الفرسان', 'Al Fursan'),
  ('Dammam', 'النورس', 'An Nawras'),
  ('Dammam', 'غرناطة', 'Ghirnatah'),
  ('Dammam', 'القادسية', 'Al Qadisiyah'),
  ('Dammam', 'ضاحية الملك فهد', 'King Fahd Suburb'),
  ('Dammam', 'المطار', 'Airport District'),
  ('Dammam', 'الصناعية الأولى', 'First Industrial'),
  ('Dammam', 'العمامرة', 'Al Amamrah'),
  ('Dammam', 'الدواسر', 'Ad Dawasir'),
  ('Dammam', 'الجوهرة', 'Al Jawharah'),
  -- ── Al Khobar ──
  ('Al Khobar', 'قرطبة', 'Qurtubah'),
  ('Al Khobar', 'الحمراء', 'Al Hamra'),
  ('Al Khobar', 'الشراع', 'Ash Shira'),
  ('Al Khobar', 'الروابي', 'Ar Rawabi'),
  ('Al Khobar', 'التعاون', 'At Taawun'),
  ('Al Khobar', 'مدينة العمال', 'Workers City'),
  ('Al Khobar', 'الصدف', 'As Sadaf'),
  ('Al Khobar', 'العقيق', 'Al Aqiq'),
  -- ── Dhahran ──
  ('Dhahran', 'الدانة الشمالية', 'Ad Danah North'),
  ('Dhahran', 'الدانة الجنوبية', 'Ad Danah South'),
  ('Dhahran', 'القصور', 'Al Qusur'),
  -- ── Jubail ──
  ('Jubail', 'الفيحاء', 'Al Fayha'),
  ('Jubail', 'الفردوس', 'Al Firdaws'),
  ('Jubail', 'الدانة', 'Ad Danah'),
  -- ── Al Ahsa ──
  ('Al Ahsa', 'الجفر', 'Al Jafr'),
  ('Al Ahsa', 'العمران', 'Al Omran'),
  ('Al Ahsa', 'الطرف', 'At Taraf'),
  ('Al Ahsa', 'البطالية', 'Al Bataliyah'),
  ('Al Ahsa', 'القارة', 'Al Qarah'),
  ('Al Ahsa', 'الجشة', 'Al Jishshah'),
  ('Al Ahsa', 'المنصورة', 'Al Mansurah'),
  ('Al Ahsa', 'الشعبة', 'Ash Shubah'),
  -- ── Hofuf ──
  ('Hofuf', 'الكوت', 'Al Kut'),
  ('Hofuf', 'النعاثل', 'An Naathil'),
  ('Hofuf', 'الرفعة الشمالية', 'Ar Rifah North'),
  ('Hofuf', 'الرفعة الجنوبية', 'Ar Rifah South'),
  ('Hofuf', 'السلمانية', 'As Salmaniyah'),
  ('Hofuf', 'محاسن', 'Mahasin'),
  ('Hofuf', 'الصالحية', 'As Salihiyah'),
  ('Hofuf', 'المزروع', 'Al Mazru'),
  -- ── Riyadh ──
  ('Riyadh', 'الملز', 'Al Malaz'),
  ('Riyadh', 'العليا', 'Al Olaya'),
  ('Riyadh', 'السليمانية', 'As Sulimaniyah'),
  ('Riyadh', 'النخيل', 'An Nakheel'),
  ('Riyadh', 'الياسمين', 'Al Yasmin'),
  ('Riyadh', 'الملقا', 'Al Malqa'),
  ('Riyadh', 'النرجس', 'An Narjis'),
  ('Riyadh', 'العارض', 'Al Arid'),
  ('Riyadh', 'الصحافة', 'As Sahafah'),
  ('Riyadh', 'المروج', 'Al Muruj'),
  ('Riyadh', 'الورود', 'Al Wurud'),
  ('Riyadh', 'حطين', 'Hittin'),
  ('Riyadh', 'الخزامى', 'Al Khuzama'),
  ('Riyadh', 'الروضة', 'Ar Rawdah'),
  ('Riyadh', 'الريان', 'Ar Rayyan'),
  ('Riyadh', 'النسيم الشرقي', 'An Nasim East'),
  ('Riyadh', 'النسيم الغربي', 'An Nasim West'),
  ('Riyadh', 'السلي', 'As Sulay'),
  ('Riyadh', 'الخليج', 'Al Khaleej'),
  ('Riyadh', 'اليرموك', 'Al Yarmuk'),
  ('Riyadh', 'غرناطة', 'Ghirnatah'),
  ('Riyadh', 'إشبيلية', 'Ishbiliyah'),
  ('Riyadh', 'قرطبة', 'Qurtubah'),
  ('Riyadh', 'الحمراء', 'Al Hamra'),
  ('Riyadh', 'المونسية', 'Al Munsiyah'),
  ('Riyadh', 'القادسية', 'Al Qadisiyah'),
  ('Riyadh', 'الرمال', 'Ar Rimal'),
  ('Riyadh', 'النهضة', 'An Nahdah'),
  ('Riyadh', 'السويدي', 'As Suwaidi'),
  ('Riyadh', 'شبرا', 'Shubra'),
  ('Riyadh', 'العريجاء', 'Al Uraija'),
  ('Riyadh', 'لبن', 'Laban'),
  ('Riyadh', 'عرقة', 'Irqah'),
  ('Riyadh', 'طويق', 'Tuwaiq'),
  ('Riyadh', 'الشفا', 'Ash Shifa'),
  ('Riyadh', 'بدر', 'Badr'),
  ('Riyadh', 'المربع', 'Al Murabba'),
  ('Riyadh', 'المعذر', 'Al Mathar'),
  ('Riyadh', 'الرحمانية', 'Ar Rahmaniyah'),
  ('Riyadh', 'النفل', 'An Nafal'),
  ('Riyadh', 'المصيف', 'Al Masif'),
  ('Riyadh', 'التعاون', 'At Taawun'),
  ('Riyadh', 'الوادي', 'Al Wadi'),
  ('Riyadh', 'الغدير', 'Al Ghadir'),
  ('Riyadh', 'الازدهار', 'Al Izdihar'),
  ('Riyadh', 'الربوة', 'Ar Rabwah'),
  ('Riyadh', 'الملك فهد', 'King Fahd'),
  ('Riyadh', 'العقيق', 'Al Aqiq'),
  ('Riyadh', 'الديرة', 'Ad Dirah'),
  ('Riyadh', 'البطحاء', 'Al Batha'),
  ('Riyadh', 'منفوحة', 'Manfuhah'),
  ('Riyadh', 'نمار', 'Namar'),
  ('Riyadh', 'الدار البيضاء', 'Ad Dar Al Baida'),
  -- ── Jeddah ──
  ('Jeddah', 'الروضة', 'Ar Rawdah'),
  ('Jeddah', 'الرحاب', 'Ar Rehab'),
  ('Jeddah', 'السلامة', 'As Salamah'),
  ('Jeddah', 'النعيم', 'An Naim'),
  ('Jeddah', 'النزهة', 'An Nuzhah'),
  ('Jeddah', 'المرجان', 'Al Murjan'),
  ('Jeddah', 'الشاطئ', 'Ash Shati'),
  ('Jeddah', 'الحمراء', 'Al Hamra'),
  ('Jeddah', 'البلد', 'Al Balad'),
  ('Jeddah', 'العزيزية', 'Al Aziziyah'),
  ('Jeddah', 'الصفا', 'As Safa'),
  ('Jeddah', 'المروة', 'Al Marwah'),
  ('Jeddah', 'الفيصلية', 'Al Faisaliyah'),
  ('Jeddah', 'البوادي', 'Al Bawadi'),
  ('Jeddah', 'الخالدية', 'Al Khalidiyah'),
  ('Jeddah', 'الأندلس', 'Al Andalus'),
  ('Jeddah', 'الزهراء', 'Az Zahra'),
  ('Jeddah', 'السامر', 'As Samer'),
  ('Jeddah', 'النسيم', 'An Nasim'),
  ('Jeddah', 'الربوة', 'Ar Rabwah'),
  ('Jeddah', 'بني مالك', 'Bani Malik'),
  ('Jeddah', 'الثغر', 'Ath Thaghr'),
  ('Jeddah', 'الجامعة', 'Al Jamiah'),
  ('Jeddah', 'الفيحاء', 'Al Fayha'),
  ('Jeddah', 'مشرفة', 'Mushrifah'),
  ('Jeddah', 'الورود', 'Al Wurud'),
  ('Jeddah', 'أبحر الشمالية', 'Obhur North'),
  ('Jeddah', 'أبحر الجنوبية', 'Obhur South'),
  ('Jeddah', 'الحمدانية', 'Al Hamdaniyah'),
  ('Jeddah', 'النزلة اليمانية', 'An Nazlah Al Yamaniyah'),
  -- ── Makkah ──
  ('Makkah', 'العزيزية', 'Al Aziziyah'),
  ('Makkah', 'الشوقية', 'Ash Shawqiyah'),
  ('Makkah', 'العوالي', 'Al Awali'),
  ('Makkah', 'الزاهر', 'Az Zahir'),
  ('Makkah', 'الزهراء', 'Az Zahra'),
  ('Makkah', 'النسيم', 'An Nasim'),
  ('Makkah', 'الرصيفة', 'Ar Rusayfah'),
  ('Makkah', 'بطحاء قريش', 'Batha Quraish'),
  ('Makkah', 'جرول', 'Jarwal'),
  ('Makkah', 'المسفلة', 'Al Misfalah'),
  ('Makkah', 'أجياد', 'Ajyad'),
  ('Makkah', 'الششة', 'Ash Shishah'),
  ('Makkah', 'العتيبية', 'Al Utaybiyah'),
  ('Makkah', 'الكعكية', 'Al Kakiyah'),
  ('Makkah', 'الخالدية', 'Al Khalidiyah'),
  ('Makkah', 'النوارية', 'An Nawwariyah'),
  ('Makkah', 'ولي العهد', 'Waly Al Ahd'),
  -- ── Madinah ──
  ('Madinah', 'قباء', 'Quba'),
  ('Madinah', 'العوالي', 'Al Awali'),
  ('Madinah', 'سلطانة', 'Sultanah'),
  ('Madinah', 'قربان', 'Qurban'),
  ('Madinah', 'شوران', 'Shuran'),
  ('Madinah', 'الحرة الشرقية', 'Eastern Harrah'),
  ('Madinah', 'الحرة الغربية', 'Western Harrah'),
  ('Madinah', 'العيون', 'Al Uyun')
)
INSERT INTO service_area_neighborhoods
  (city_id, name_ar, name_en, enabled, delivery_fee, sort_order)
SELECT
  c.id,
  d.name_ar,
  d.name_en,
  true,
  c.delivery_fee,
  (SELECT coalesce(max(n.sort_order), 0)
     FROM service_area_neighborhoods n WHERE n.city_id = c.id)
  + row_number() OVER (PARTITION BY c.id ORDER BY d.ord)
FROM (SELECT *, row_number() OVER () AS ord FROM data) d
JOIN service_area_cities c ON c.name_en = d.city_en
ON CONFLICT (city_id, name_ar) DO NOTHING;
