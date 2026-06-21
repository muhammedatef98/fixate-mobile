-- Service-area neighborhoods (per city) with delivery fees + seed data.
-- Recovered verbatim from the remote migration history
-- (supabase_migrations.schema_migrations.statements) after the local file
-- was lost in a rebase. Already applied on remote; idempotent.

create table if not exists public.service_area_neighborhoods (
  id            uuid primary key default gen_random_uuid(),
  city_id       uuid not null references public.service_area_cities(id) on delete cascade,
  name_ar       text not null,
  name_en       text not null,
  enabled       boolean not null default false,
  delivery_fee  numeric not null default 0,
  sort_order    int not null default 0,
  created_at    timestamptz default now()
);

create index if not exists service_area_neighborhoods_city_idx
  on public.service_area_neighborhoods (city_id);

alter table public.service_area_neighborhoods enable row level security;

drop policy if exists "Anyone reads neighborhoods" on public.service_area_neighborhoods;
create policy "Anyone reads neighborhoods" on public.service_area_neighborhoods
  for select to authenticated using (true);

drop policy if exists "Admins manage neighborhoods" on public.service_area_neighborhoods;
create policy "Admins manage neighborhoods" on public.service_area_neighborhoods
  for all to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

insert into public.service_area_neighborhoods (city_id, name_ar, name_en, enabled, delivery_fee, sort_order)
select c.id, n.name_ar, n.name_en, false, 0, n.ord
from public.service_area_cities c
join public.service_area_regions r on r.id = c.region_id
join (values
  ('riyadh','Riyadh','العليا','Olaya',1),('riyadh','Riyadh','الملز','Al Malaz',2),
  ('riyadh','Riyadh','النخيل','Al Nakheel',3),('riyadh','Riyadh','الياسمين','Al Yasmin',4),
  ('riyadh','Riyadh','الملقا','Al Malqa',5),('riyadh','Riyadh','حطين','Hittin',6),
  ('riyadh','Riyadh','الورود','Al Wurud',7),('riyadh','Riyadh','السليمانية','As Sulimaniyah',8),
  ('riyadh','Riyadh','المروج','Al Muruj',9),('riyadh','Riyadh','الربوة','Ar Rabwah',10),
  ('riyadh','Riyadh','النرجس','Al Narjis',11),('riyadh','Riyadh','القيروان','Al Qirawan',12),
  ('riyadh','Riyadh','الروضة','Ar Rawdah',13),('riyadh','Riyadh','المغرزات','Al Mughrizat',14),
  ('riyadh','Riyadh','الدرعية','Ad Diriyah',15),('riyadh','Riyadh','العزيزية','Al Aziziyah',16),
  ('riyadh','Riyadh','السويدي','As Suwaidi',17),('riyadh','Riyadh','النسيم','An Naseem',18),
  ('riyadh','Riyadh','الشفا','Ash Shifa',19),('riyadh','Riyadh','طويق','Tuwaiq',20),
  ('makkah','Jeddah','الحمراء','Al Hamra',1),('makkah','Jeddah','الروضة','Ar Rawdah',2),
  ('makkah','Jeddah','الشاطئ','Ash Shati',3),('makkah','Jeddah','السلامة','As Salamah',4),
  ('makkah','Jeddah','النعيم','An Naeem',5),('makkah','Jeddah','الزهراء','Az Zahra',6),
  ('makkah','Jeddah','البساتين','Al Basateen',7),('makkah','Jeddah','المروة','Al Marwah',8),
  ('makkah','Jeddah','النزهة','An Nuzhah',9),('makkah','Jeddah','الصفا','As Safa',10),
  ('makkah','Jeddah','الفيصلية','Al Faisaliyah',11),('makkah','Jeddah','السامر','As Samer',12),
  ('makkah','Jeddah','الربوة','Ar Rabwah',13),('makkah','Jeddah','أبحر الشمالية','Obhur Al Shamaliyah',14),
  ('makkah','Jeddah','بريمان','Bryman',15),('makkah','Jeddah','الجامعة','Al Jamiah',16),
  ('makkah','Makkah','العزيزية','Al Aziziyah',1),('makkah','Makkah','الششة','Ash Shisha',2),
  ('makkah','Makkah','العوالي','Al Awali',3),('makkah','Makkah','الزاهر','Az Zahir',4),
  ('makkah','Makkah','الشوقية','Ash Shawqiyah',5),('makkah','Makkah','النسيم','An Naseem',6),
  ('makkah','Makkah','الكعكية','Al Kakiyah',7),('makkah','Makkah','الرصيفة','Ar Rusaifah',8),
  ('makkah','Makkah','بطحاء قريش','Batha Quraish',9),('makkah','Makkah','جرول','Jarwal',10),
  ('makkah','Taif','الحوية','Al Hawiyah',1),('makkah','Taif','شهار','Shihar',2),
  ('makkah','Taif','الشفا','Ash Shafa',3),('makkah','Taif','قروى','Qarwa',4),
  ('makkah','Taif','الفيصلية','Al Faisaliyah',5),('makkah','Taif','معشي','Mishi',6),
  ('madinah','Madinah','قباء','Quba',1),('madinah','Madinah','العوالي','Al Awali',2),
  ('madinah','Madinah','الحرة الشرقية','Eastern Harrah',3),('madinah','Madinah','العاقول','Al Aqul',4),
  ('madinah','Madinah','شظاة','Shaza',5),('madinah','Madinah','الدفاع','Ad Difa',6),
  ('madinah','Madinah','بني حارثة','Bani Harithah',7),('madinah','Madinah','الجرف','Al Jurf',8),
  ('madinah','Madinah','العزيزية','Al Aziziyah',9),('madinah','Madinah','المطار','Al Matar',10),
  ('eastern','Dammam','الفيصلية','Al Faisaliyah',1),('eastern','Dammam','الشاطئ','Ash Shati',2),
  ('eastern','Dammam','الجلوية','Al Jalawiyah',3),('eastern','Dammam','الأمل','Al Amal',4),
  ('eastern','Dammam','النور','An Noor',5),('eastern','Dammam','الروضة','Ar Rawdah',6),
  ('eastern','Dammam','الفنار','Al Fanar',7),('eastern','Dammam','بدر','Badr',8),
  ('eastern','Dammam','الضباب','Ad Dabab',9),('eastern','Dammam','أحد','Uhud',10),
  ('eastern','Dammam','المنار','Al Manar',11),('eastern','Dammam','الريان','Ar Rayan',12),
  ('eastern','Al Khobar','الراكة','Ar Rakah',1),('eastern','Al Khobar','العقربية','Al Aqrabiyah',2),
  ('eastern','Al Khobar','الثقبة','Ath Thuqbah',3),('eastern','Al Khobar','الخبر الشمالية','North Khobar',4),
  ('eastern','Al Khobar','الكورنيش','Al Corniche',5),('eastern','Al Khobar','اليرموك','Al Yarmouk',6),
  ('eastern','Al Khobar','العزيزية','Al Aziziyah',7),('eastern','Al Khobar','الحزام الذهبي','Golden Belt',8),
  ('eastern','Dhahran','الدوحة','Ad Doha',1),('eastern','Dhahran','هجر','Hajar',2),
  ('eastern','Dhahran','القشلة','Al Qashlah',3),('eastern','Dhahran','تهامة','Tihamah',4),
  ('eastern','Qatif','القلعة','Al Qalah',1),('eastern','Qatif','الناصرة','An Nasirah',2),
  ('eastern','Qatif','الكويكب','Al Kuwaikib',3),('eastern','Qatif','الجش','Al Jish',4),
  ('eastern','Qatif','أم الحمام','Umm Al Hamam',5),('eastern','Qatif','الملاحة','Al Mallahah',6),
  ('eastern','Al Ahsa','المبرز','Al Mubarraz',1),('eastern','Al Ahsa','الهفوف','Hofuf',2),
  ('eastern','Al Ahsa','العمران','Al Omran',3),('eastern','Al Ahsa','الجفر','Al Jafr',4),
  ('asir','Abha','المنسك','Al Mansak',1),('asir','Abha','النصب','An Nasb',2),
  ('asir','Abha','الموظفين','Al Muwazafin',3),('asir','Abha','السد','As Sadd',4),
  ('qassim','Buraydah','الصفراء','As Safra',1),('qassim','Buraydah','الفايزية','Al Fayziyah',2),
  ('qassim','Buraydah','الرابية','Ar Rabiyah',3),('qassim','Buraydah','الإسكان','Al Iskan',4),
  ('tabuk','Tabuk','المروج','Al Muruj',1),('tabuk','Tabuk','العزيزية','Al Aziziyah',2),
  ('tabuk','Tabuk','الورود','Al Wurud',3),('tabuk','Tabuk','السلام','As Salam',4),
  ('hail','Hail','المطار','Al Matar',1),('hail','Hail','الزبارة','Az Zabarah',2),
  ('hail','Hail','النقرة','An Naqrah',3),('hail','Hail','صبابة','Sababah',4),
  ('jazan','Jazan','الروضة','Ar Rawdah',1),('jazan','Jazan','الصفا','As Safa',2),
  ('jazan','Jazan','المطار','Al Matar',3),('jazan','Jazan','الشاطئ','Ash Shati',4),
  ('najran','Najran','الفيصلية','Al Faisaliyah',1),('najran','Najran','الفهد','Al Fahd',2),
  ('najran','Najran','أبا السعود','Aba As Saud',3),('najran','Najran','الغويلا','Al Ghuwayla',4)
) as n(region_code, city_en, name_ar, name_en, ord)
  on r.code = n.region_code and c.name_en = n.city_en
where not exists (
  select 1 from public.service_area_neighborhoods x
  where x.city_id = c.id and x.name_en = n.name_en
);
