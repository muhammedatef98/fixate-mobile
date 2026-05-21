-- Platform foundation (Phase A): payment methods, Saudi-wide service areas,
-- user/technician status models, and moderation logs.

-- ── Payment methods ───────────────────────────────────────────────────────
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_ar text not null,
  name_en text not null,
  icon text,
  enabled boolean not null default true,
  is_coming_soon boolean not null default false,
  show_in_request_step boolean not null default true,
  show_in_payment_page boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.payment_methods enable row level security;

drop policy if exists "Anyone reads payment methods" on public.payment_methods;
create policy "Anyone reads payment methods" on public.payment_methods
  for select to authenticated using (true);

drop policy if exists "Admins manage payment methods" on public.payment_methods;
create policy "Admins manage payment methods" on public.payment_methods
  for all to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

insert into public.payment_methods
  (code, name_ar, name_en, icon, enabled, is_coming_soon, show_in_request_step, show_in_payment_page, sort_order)
values
  ('cod',       'نقداً عند الاستلام', 'Cash on Delivery', 'cash',                 true, false, true, true, 1),
  ('card',      'بطاقة / مدى',        'Card / Visa / Mada','credit-card-outline',  true, false, true, true, 2),
  ('apple_pay', 'Apple Pay',          'Apple Pay',         'apple',                true, false, true, true, 3),
  ('tabby',     'تابي',               'Tabby',             'calendar-clock',       true, true,  true, true, 4),
  ('tamara',    'تمارا',              'Tamara',            'calendar-clock',       true, true,  true, true, 5)
on conflict (code) do nothing;

-- ── Service areas: regions + cities (district-ready) ──────────────────────
create table if not exists public.service_area_regions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name_ar text not null,
  name_en text not null,
  enabled boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.service_area_cities (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.service_area_regions(id) on delete cascade,
  name_ar text not null,
  name_en text not null,
  enabled boolean not null default false,
  delivery_fee numeric not null default 20,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists service_area_cities_region_idx
  on public.service_area_cities (region_id);

alter table public.service_area_regions enable row level security;
alter table public.service_area_cities enable row level security;

drop policy if exists "Anyone reads regions" on public.service_area_regions;
create policy "Anyone reads regions" on public.service_area_regions
  for select to authenticated using (true);
drop policy if exists "Admins manage regions" on public.service_area_regions;
create policy "Admins manage regions" on public.service_area_regions
  for all to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

drop policy if exists "Anyone reads cities" on public.service_area_cities;
create policy "Anyone reads cities" on public.service_area_cities
  for select to authenticated using (true);
drop policy if exists "Admins manage cities" on public.service_area_cities;
create policy "Admins manage cities" on public.service_area_cities
  for all to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- 13 Saudi regions. Only the Eastern Province is enabled at launch.
insert into public.service_area_regions (code, name_ar, name_en, enabled, sort_order) values
  ('riyadh',   'منطقة الرياض',            'Riyadh Region',           false, 1),
  ('makkah',   'منطقة مكة المكرمة',        'Makkah Region',           false, 2),
  ('madinah',  'منطقة المدينة المنورة',    'Madinah Region',          false, 3),
  ('eastern',  'المنطقة الشرقية',          'Eastern Province',        true,  4),
  ('qassim',   'منطقة القصيم',            'Qassim Region',           false, 5),
  ('asir',     'منطقة عسير',              'Asir Region',             false, 6),
  ('tabuk',    'منطقة تبوك',              'Tabuk Region',            false, 7),
  ('hail',     'منطقة حائل',              'Hail Region',             false, 8),
  ('northern', 'منطقة الحدود الشمالية',    'Northern Borders Region', false, 9),
  ('jazan',    'منطقة جازان',             'Jazan Region',            false, 10),
  ('najran',   'منطقة نجران',             'Najran Region',           false, 11),
  ('bahah',    'منطقة الباحة',            'Al Bahah Region',         false, 12),
  ('jawf',     'منطقة الجوف',             'Al Jawf Region',          false, 13)
on conflict (code) do nothing;

-- Cities for every region. Only Al Qatif is enabled at launch.
insert into public.service_area_cities (region_id, name_ar, name_en, enabled, delivery_fee, sort_order)
select r.id, c.name_ar, c.name_en, c.enabled, c.fee, c.ord
from public.service_area_regions r
join (values
  ('eastern','الدمام','Dammam',false,20,1),('eastern','الخبر','Al Khobar',false,20,2),
  ('eastern','الظهران','Dhahran',false,20,3),('eastern','القطيف','Qatif',true,15,4),
  ('eastern','الأحساء','Al Ahsa',false,20,5),('eastern','الهفوف','Hofuf',false,20,6),
  ('eastern','المبرز','Al Mubarraz',false,20,7),('eastern','الجبيل','Jubail',false,20,8),
  ('eastern','حفر الباطن','Hafar Al Batin',false,20,9),('eastern','سيهات','Saihat',false,20,10),
  ('eastern','صفوى','Safwa',false,25,11),('eastern','تاروت','Tarout',false,30,12),
  ('eastern','رأس تنورة','Ras Tanura',false,20,13),('eastern','بقيق','Abqaiq',false,20,14),
  ('eastern','الخفجي','Khafji',false,20,15),('eastern','النعيرية','Nairyah',false,20,16),
  ('eastern','قرية العليا','Qaryat Al Ulya',false,20,17),('eastern','العيون','Al Uyun',false,20,18),
  ('riyadh','الرياض','Riyadh',false,20,1),('riyadh','الخرج','Al Kharj',false,20,2),
  ('riyadh','الدوادمي','Ad Dawadimi',false,20,3),('riyadh','المجمعة','Al Majmaah',false,20,4),
  ('riyadh','القويعية','Al Quwaiyah',false,20,5),('riyadh','وادي الدواسر','Wadi ad-Dawasir',false,20,6),
  ('riyadh','الأفلاج','Al Aflaj',false,20,7),('riyadh','الزلفي','Az Zulfi',false,20,8),
  ('riyadh','شقراء','Shaqra',false,20,9),('riyadh','حوطة بني تميم','Hotat Bani Tamim',false,20,10),
  ('riyadh','عفيف','Afif',false,20,11),('riyadh','الدرعية','Diriyah',false,20,12),
  ('riyadh','الدلم','Ad Dilam',false,20,13),('riyadh','ثادق','Thadiq',false,20,14),
  ('riyadh','حريملاء','Huraymila',false,20,15),('riyadh','المزاحمية','Al Muzahimiyah',false,20,16),
  ('riyadh','رماح','Rumah',false,20,17),('riyadh','الغاط','Al Ghat',false,20,18),
  ('riyadh','مرات','Marat',false,20,19),
  ('makkah','مكة المكرمة','Makkah',false,20,1),('makkah','جدة','Jeddah',false,20,2),
  ('makkah','الطائف','Taif',false,20,3),('makkah','رابغ','Rabigh',false,20,4),
  ('makkah','القنفذة','Al Qunfudhah',false,20,5),('makkah','الليث','Al Lith',false,20,6),
  ('makkah','خليص','Khulais',false,20,7),('makkah','الجموم','Al Jumum',false,20,8),
  ('makkah','تربة','Turbah',false,20,9),('makkah','رنية','Ranyah',false,20,10),
  ('makkah','أضم','Adham',false,20,11),('makkah','الكامل','Al Kamil',false,20,12),
  ('makkah','بحرة','Bahrah',false,20,13),('makkah','المويه','Al Muwayh',false,20,14),
  ('madinah','المدينة المنورة','Madinah',false,20,1),('madinah','ينبع','Yanbu',false,20,2),
  ('madinah','العلا','Al Ula',false,20,3),('madinah','بدر','Badr',false,20,4),
  ('madinah','خيبر','Khaybar',false,20,5),('madinah','الحناكية','Al Hinakiyah',false,20,6),
  ('madinah','مهد الذهب','Mahd adh Dhahab',false,20,7),('madinah','العيص','Al Ais',false,20,8),
  ('asir','أبها','Abha',false,20,1),('asir','خميس مشيط','Khamis Mushait',false,20,2),
  ('asir','بيشة','Bisha',false,20,3),('asir','النماص','An Namas',false,20,4),
  ('asir','محايل عسير','Mahayil',false,20,5),('asir','سراة عبيدة','Sarat Abidah',false,20,6),
  ('asir','تثليث','Tathlith',false,20,7),('asir','رجال ألمع','Rijal Almaa',false,20,8),
  ('asir','ظهران الجنوب','Dhahran Al Janub',false,20,9),('asir','بلقرن','Balqarn',false,20,10),
  ('asir','أحد رفيدة','Ahad Rufaidah',false,20,11),('asir','تنومة','Tanomah',false,20,12),
  ('tabuk','تبوك','Tabuk',false,20,1),('tabuk','ضباء','Duba',false,20,2),
  ('tabuk','أملج','Umluj',false,20,3),('tabuk','حقل','Haql',false,20,4),
  ('tabuk','الوجه','Al Wajh',false,20,5),('tabuk','تيماء','Tayma',false,20,6),
  ('qassim','بريدة','Buraydah',false,20,1),('qassim','عنيزة','Unaizah',false,20,2),
  ('qassim','الرس','Ar Rass',false,20,3),('qassim','البكيرية','Al Bukayriyah',false,20,4),
  ('qassim','المذنب','Al Mithnab',false,20,5),('qassim','البدائع','Al Badai',false,20,6),
  ('qassim','رياض الخبراء','Riyadh Al Khabra',false,20,7),('qassim','عيون الجواء','Uyun Al Jiwa',false,20,8),
  ('qassim','النبهانية','An Nabhaniyah',false,20,9),('qassim','الشماسية','Ash Shimasiyah',false,20,10),
  ('hail','حائل','Hail',false,20,1),('hail','بقعاء','Baqaa',false,20,2),
  ('hail','الغزالة','Al Ghazalah',false,20,3),('hail','الشنان','Ash Shinan',false,20,4),
  ('hail','الشملي','Ash Shamli',false,20,5),('hail','موقق','Mawqaq',false,20,6),
  ('hail','السليمي','As Sulaymi',false,20,7),
  ('northern','عرعر','Arar',false,20,1),('northern','رفحاء','Rafha',false,20,2),
  ('northern','طريف','Turaif',false,20,3),('northern','العويقيلة','Al Uwayqilah',false,20,4),
  ('jazan','جازان','Jazan',false,20,1),('jazan','صبيا','Sabya',false,20,2),
  ('jazan','أبو عريش','Abu Arish',false,20,3),('jazan','صامطة','Samtah',false,20,4),
  ('jazan','أحد المسارحة','Ahad Al Masarihah',false,20,5),('jazan','فرسان','Farasan',false,20,6),
  ('jazan','بيش','Baish',false,20,7),('jazan','الدرب','Ad Darb',false,20,8),
  ('jazan','العارضة','Al Aridah',false,20,9),('jazan','ضمد','Damad',false,20,10),
  ('najran','نجران','Najran',false,20,1),('najran','شرورة','Sharurah',false,20,2),
  ('najran','حبونا','Hubuna',false,20,3),('najran','بدر الجنوب','Badr Al Janub',false,20,4),
  ('najran','يدمة','Yadamah',false,20,5),('najran','خباش','Khubash',false,20,6),
  ('najran','ثار','Thar',false,20,7),
  ('bahah','الباحة','Al Bahah',false,20,1),('bahah','بلجرشي','Baljurashi',false,20,2),
  ('bahah','المندق','Al Mandaq',false,20,3),('bahah','المخواة','Al Mikhwah',false,20,4),
  ('bahah','قلوة','Qilwah',false,20,5),('bahah','العقيق','Al Aqiq',false,20,6),
  ('bahah','القرى','Al Qura',false,20,7),
  ('jawf','سكاكا','Sakaka',false,20,1),('jawf','القريات','Al Qurayyat',false,20,2),
  ('jawf','دومة الجندل','Dumat Al Jandal',false,20,3),('jawf','طبرجل','Tabarjal',false,20,4)
) as c(region_code, name_ar, name_en, enabled, fee, ord) on r.code = c.region_code
where not exists (
  select 1 from public.service_area_cities x
  where x.region_id = r.id and x.name_en = c.name_en
);

-- ── User account status + admin notes ─────────────────────────────────────
alter table public.users
  add column if not exists account_status text not null default 'active',
  add column if not exists admin_notes text,
  add column if not exists status_updated_at timestamptz;
do $$
begin
  alter table public.users add constraint users_account_status_check
    check (account_status in ('active','suspended','blocked'));
exception when duplicate_object then null;
end $$;

drop policy if exists "Admins update any user" on public.users;
create policy "Admins update any user" on public.users
  for update to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- ── Technician lifecycle status + admin notes ─────────────────────────────
alter table public.technicians
  add column if not exists technician_status text not null default 'active',
  add column if not exists admin_notes text,
  add column if not exists status_updated_at timestamptz;
do $$
begin
  alter table public.technicians add constraint technicians_status_check
    check (technician_status in ('active','under_review','suspended','excluded'));
exception when duplicate_object then null;
end $$;

drop policy if exists "Admins update technicians" on public.technicians;
create policy "Admins update technicians" on public.technicians
  for update to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- ── Moderation / admin action log ─────────────────────────────────────────
create table if not exists public.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('user','technician')),
  target_id uuid not null,
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists moderation_logs_target_idx
  on public.moderation_logs (target_type, target_id, created_at desc);

alter table public.moderation_logs enable row level security;

drop policy if exists "Admins read moderation logs" on public.moderation_logs;
create policy "Admins read moderation logs" on public.moderation_logs
  for select to authenticated using (is_admin(auth.uid()));
drop policy if exists "Admins write moderation logs" on public.moderation_logs;
create policy "Admins write moderation logs" on public.moderation_logs
  for insert to authenticated with check (is_admin(auth.uid()));
