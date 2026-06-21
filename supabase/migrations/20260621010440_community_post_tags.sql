-- ============================================================================
-- Community post tags — an optional category on each technician post so the
-- feed can be filtered by topic (سؤال / نصيحة / مشكلة / عام). Defaults to عام.
-- ============================================================================

alter table public.community_posts
  add column if not exists tag text
  check (tag in ('سؤال','نصيحة','مشكلة','عام'))
  default 'عام';
