-- ============================================================================
-- Request device types — admin-controlled
-- ----------------------------------------------------------------------------
-- The customer repair-request flow used to ship a hardcoded list of device
-- types in `app/request.tsx`. That made it impossible to enable/disable an
-- option or add a new repairable device without a code release. This
-- migration lifts the list into the DB so admins can manage it from the
-- new Request Settings screen.
--
-- Schema mirrors `service_area_*`: a stable `code` column for join keys
-- (used by orders / market listings), nullable `name_ar` / `name_en` for
-- display, `icon` (MaterialCommunityIcons name), boolean `enabled`, and
-- `sort_order` for stable rendering. RLS: anyone reads, only admins
-- write. No client-reachable archive or hard-delete — admins use the
-- `enabled` flag to soft-hide options (mirrors the Market lifecycle rule
-- "archive is admin-only, no client hard-delete"). The admin UI itself
-- exposes only enable/disable + edit + create.
--
-- All clauses are idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.request_device_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name_ar     text NOT NULL,
  name_en     text NOT NULL,
  icon        text NOT NULL DEFAULT 'devices',
  enabled     boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 100,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS request_device_types_sort_idx
  ON public.request_device_types (sort_order);

CREATE INDEX IF NOT EXISTS request_device_types_enabled_idx
  ON public.request_device_types (enabled)
  WHERE enabled = true;

ALTER TABLE public.request_device_types ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated) reads the catalogue — needed for the
-- request flow to render the chooser.
DROP POLICY IF EXISTS "request_device_types_read" ON public.request_device_types;
CREATE POLICY "request_device_types_read"
  ON public.request_device_types
  FOR SELECT
  USING (true);

-- Only admins write. Same `is_admin(auth.uid())` gate used everywhere else
-- in the project — no new admin-promotion path is introduced.
DROP POLICY IF EXISTS "request_device_types_admin_all" ON public.request_device_types;
CREATE POLICY "request_device_types_admin_all"
  ON public.request_device_types
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Touch trigger keeps updated_at fresh on every mutation so the admin UI
-- can show last-edited markers without an extra column.
DROP TRIGGER IF EXISTS touch_request_device_types ON public.request_device_types;
CREATE TRIGGER touch_request_device_types
  BEFORE UPDATE ON public.request_device_types
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Seed: the 10 device types currently hardcoded in app/request.tsx, with
-- `enabled` preserving the existing `available` flag. ON CONFLICT (code)
-- DO NOTHING so re-applying the migration leaves admin edits intact.
-- ---------------------------------------------------------------------------
INSERT INTO public.request_device_types (code, name_ar, name_en, icon, enabled, sort_order) VALUES
  ('phone',      'جوال',            'Phone',             'cellphone',       true,  1),
  ('tablet',     'تابلت',           'Tablet',            'tablet',          true,  2),
  ('laptop',     'لابتوب',          'Laptop',            'laptop',          true,  3),
  ('watch',      'ساعة ذكية',       'Smart Watch',       'watch',           true,  4),
  ('gaming',     'أجهزة الألعاب',    'Gaming Devices',    'gamepad-variant', true,  5),
  ('other',      'أجهزة أخرى',      'Other Devices',     'devices',         true,  6),
  ('printer',    'طابعة',           'Printer',           'printer',         false, 7),
  ('headphones', 'سماعات',          'Headphones',        'headphones',      false, 8),
  ('tv',         'شاشة/تلفاز',      'TV/Monitor',        'television',      false, 9),
  ('appliance',  'أجهزة منزلية',    'Home Appliances',   'home-outline',    false, 10)
ON CONFLICT (code) DO NOTHING;
