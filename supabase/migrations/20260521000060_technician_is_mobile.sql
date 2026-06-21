-- "Mobile technician" (فني متنقل) flag, toggled per technician by admins.
alter table public.technicians
  add column if not exists is_mobile boolean not null default false;
