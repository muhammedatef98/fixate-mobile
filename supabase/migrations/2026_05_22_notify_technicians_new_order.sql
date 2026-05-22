-- In-app notification to every eligible technician when a new repair
-- request is created, so they see it without polling the available list.
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

drop trigger if exists trg_notify_technicians_new_order on public.orders;
create trigger trg_notify_technicians_new_order
  after insert on public.orders
  for each row execute function public.notify_technicians_new_order();
