-- Push an in-app notification to every eligible, online courier when a new
-- delivery task enters the pool. Until now the available pool was only
-- discoverable via the in-app realtime subscription — a courier with the app
-- backgrounded never learned a task appeared. Mirrors
-- notify_technicians_new_order, and respects the courier availability switch.
create or replace function public.notify_couriers_new_task()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_leg_ar text;
  v_leg_en text;
  v_courier record;
begin
  if NEW.status = 'available' and NEW.courier_id is null then
    if NEW.task_type = 'pickup' then
      v_leg_ar := 'استلام من العميل';
      v_leg_en := 'Pickup from customer';
    else
      v_leg_ar := 'إعادة للعميل';
      v_leg_en := 'Return to customer';
    end if;

    for v_courier in
      select user_id
      from public.couriers
      where verification_status in ('approved', 'verified')
        and courier_status = 'active'
        and coalesce(available, true) = true
    loop
      perform public.create_notification(
        v_courier.user_id,
        'مهمة توصيل جديدة',
        'New delivery task',
        'مهمة توصيل جديدة متاحة (' || v_leg_ar || '). تحقق من المهمات المتاحة.',
        'A new delivery task is available (' || v_leg_en || '). Check available tasks.',
        'delivery', NEW.id);
    end loop;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_couriers_new_task on public.delivery_tasks;
create trigger trg_notify_couriers_new_task
  after insert on public.delivery_tasks
  for each row execute function public.notify_couriers_new_task();

-- Trigger functions need no direct client EXECUTE.
revoke execute on function public.notify_couriers_new_task() from public, anon, authenticated;
