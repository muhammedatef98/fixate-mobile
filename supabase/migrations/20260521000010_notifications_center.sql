-- In-app notifications center.
-- Table + RLS + server-side triggers that insert notifications on key events:
--   order status changed, technician assigned, listing approved/rejected,
--   new order message, new market comment.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title_ar text not null,
  title_en text not null,
  body_ar text,
  body_en text,
  type text not null default 'general',
  is_read boolean not null default false,
  related_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where is_read = false;

alter table public.notifications enable row level security;
alter table public.notifications replica identity full;

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications
  for select using (auth.uid() = user_id);

drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users delete own notifications" on public.notifications;
create policy "Users delete own notifications" on public.notifications
  for delete using (auth.uid() = user_id);

-- Authenticated clients may insert (used by utils/notifications.ts
-- sendNotification helper). Server triggers below bypass RLS anyway.
drop policy if exists "Authenticated insert notifications" on public.notifications;
create policy "Authenticated insert notifications" on public.notifications
  for insert to authenticated with check (true);

-- Stream notifications to clients in realtime (badge + list live updates).
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;

-- Shared insert helper used by every trigger.
create or replace function public.create_notification(
  p_user_id uuid,
  p_title_ar text,
  p_title_en text,
  p_body_ar text,
  p_body_en text,
  p_type text,
  p_related_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications
    (user_id, title_ar, title_en, body_ar, body_en, type, related_id)
  values
    (p_user_id, p_title_ar, p_title_en, p_body_ar, p_body_en,
     coalesce(p_type, 'general'), p_related_id);
end;
$$;

-- ── Orders: status change + technician assignment ────────────────────────
create or replace function public.notify_order_changes()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_device text;
  v_ar text;
  v_en text;
begin
  v_device := trim(coalesce(NEW.device_brand, '') || ' ' || coalesce(NEW.device_model, ''));

  if (OLD.technician_id is null and NEW.technician_id is not null) then
    perform public.create_notification(
      NEW.user_id,
      'تم تعيين فني لطلبك',
      'A technician was assigned',
      'تم تعيين فني للعمل على طلبك (' || v_device || ').',
      'A technician has been assigned to your order (' || v_device || ').',
      'order', NEW.id);
    perform public.create_notification(
      NEW.technician_id,
      'طلب جديد مُسند إليك',
      'New job assigned to you',
      'تم إسناد طلب جديد إليك (' || v_device || ').',
      'A new job has been assigned to you (' || v_device || ').',
      'order', NEW.id);
  elsif (NEW.status is distinct from OLD.status) then
    case NEW.status
      when 'pending'       then v_ar := 'قيد الانتظار';            v_en := 'Pending';
      when 'confirmed'     then v_ar := 'مؤكد';                    v_en := 'Confirmed';
      when 'accepted'      then v_ar := 'مقبول';                   v_en := 'Accepted';
      when 'picking_up'    then v_ar := 'جاري الاستلام';           v_en := 'Picking up';
      when 'diagnosing'    then v_ar := 'جاري الفحص';              v_en := 'Diagnosing';
      when 'quoted'        then v_ar := 'تم إرسال عرض السعر';      v_en := 'Quote sent';
      when 'waiting_parts' then v_ar := 'بانتظار قطع الغيار';      v_en := 'Waiting for parts';
      when 'repairing'     then v_ar := 'جاري الإصلاح';            v_en := 'Repairing';
      when 'testing'       then v_ar := 'جاري الاختبار';           v_en := 'Testing';
      when 'delivering'    then v_ar := 'جاري التوصيل';            v_en := 'Out for delivery';
      when 'completed'     then v_ar := 'مكتمل';                   v_en := 'Completed';
      when 'cancelled'     then v_ar := 'ملغي';                    v_en := 'Cancelled';
      else v_ar := NEW.status; v_en := NEW.status;
    end case;
    perform public.create_notification(
      NEW.user_id,
      'تحديث على طلبك',
      'Order status updated',
      'حالة طلبك الآن: ' || v_ar,
      'Your order is now: ' || v_en,
      'order', NEW.id);
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_order_changes on public.orders;
create trigger trg_notify_order_changes
  after update on public.orders
  for each row execute function public.notify_order_changes();

-- ── Market listings: approved / rejected ─────────────────────────────────
create or replace function public.notify_listing_review()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (NEW.status is distinct from OLD.status) then
    if NEW.status = 'active' then
      perform public.create_notification(
        NEW.seller_id,
        'تمت الموافقة على إعلانك',
        'Your listing was approved',
        'إعلانك "' || NEW.title || '" أصبح ظاهراً الآن في السوق.',
        'Your listing "' || NEW.title || '" is now live on the market.',
        'listing', NEW.id);
    elsif NEW.status = 'rejected' then
      perform public.create_notification(
        NEW.seller_id,
        'لم تتم الموافقة على إعلانك',
        'Your listing was rejected',
        'لم تتم الموافقة على إعلانك "' || NEW.title || '". يمكنك تعديله وإعادة إرساله.',
        'Your listing "' || NEW.title || '" was not approved. You can edit and resubmit it.',
        'listing', NEW.id);
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_listing_review on public.market_listings;
create trigger trg_notify_listing_review
  after update on public.market_listings
  for each row execute function public.notify_listing_review();

-- ── Order messages: notify the other participant ─────────────────────────
create or replace function public.notify_new_message()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_tech uuid;
  v_recipient uuid;
begin
  select user_id, technician_id into v_user, v_tech
  from public.orders where id = NEW.order_id;

  if NEW.sender_id = v_user then
    v_recipient := v_tech;
  else
    v_recipient := v_user;
  end if;

  if v_recipient is not null and v_recipient <> NEW.sender_id then
    perform public.create_notification(
      v_recipient,
      'رسالة جديدة',
      'New message',
      left(NEW.content, 140),
      left(NEW.content, 140),
      'message', NEW.order_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_new_message on public.messages;
create trigger trg_notify_new_message
  after insert on public.messages
  for each row execute function public.notify_new_message();

-- ── Market comments: notify the listing owner ────────────────────────────
create or replace function public.notify_new_comment()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_seller uuid;
  v_title text;
begin
  select seller_id, title into v_seller, v_title
  from public.market_listings where id = NEW.listing_id;

  if v_seller is not null and v_seller <> NEW.user_id then
    perform public.create_notification(
      v_seller,
      'تعليق جديد على إعلانك',
      'New comment on your listing',
      'لديك تعليق جديد على "' || coalesce(v_title, '') || '".',
      'You have a new comment on "' || coalesce(v_title, '') || '".',
      'comment', NEW.listing_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_new_comment on public.market_comments;
create trigger trg_notify_new_comment
  after insert on public.market_comments
  for each row execute function public.notify_new_comment();
