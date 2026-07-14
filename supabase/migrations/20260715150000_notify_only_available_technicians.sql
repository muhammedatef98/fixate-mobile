-- Honor the technician availability switch in new-order notifications.
--
-- The dashboard toggle promises "you will not get new requests" when a
-- technician goes offline (available = false), but this trigger notified every
-- approved+active technician regardless. Respect `available` so an offline
-- technician is genuinely left alone — matching the UI's own copy.
create or replace function public.notify_technicians_new_order()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_device text;
  v_tech record;
begin
  if NEW.status = 'pending' then
    v_device := trim(coalesce(NEW.device_brand, '') || ' ' || coalesce(NEW.device_model, ''));
    for v_tech in
      select user_id
      from public.technicians
      where verification_status = 'approved'
        and coalesce(technician_status, 'active') = 'active'
        and coalesce(available, true) = true
        and deleted_at is null
    loop
      perform public.create_notification(
        v_tech.user_id,
        'طلب جديد متاح',
        'New request available',
        'وصل طلب إصلاح جديد (' || v_device || '). تحقق من الطلبات المتاحة.',
        'A new repair request is available (' || v_device || '). Check available jobs.',
        'order', NEW.id);
    end loop;
  end if;
  return NEW;
end;
$$;
