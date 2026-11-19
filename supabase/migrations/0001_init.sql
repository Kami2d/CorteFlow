-- CorteFlow: migração inicial (multi-tenant por barbershop_id)

-- Tabelas principais
create table if not exists public.barbershops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  address text,
  whatsapp text,
  hours jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{"slot_interval":30,"lead_time_minutes":60,"cancel_hours":2,"max_days_ahead":60}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  full_name text,
  role text not null default 'manager',
  created_at timestamptz default now()
);

create table if not exists public.barbers (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  name text not null,
  phone text,
  whatsapp text,
  photo_url text,
  specialties text[] not null default '{}',
  bio text,
  active boolean not null default true,
  breaks jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  name text not null,
  phone text,
  whatsapp text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  duration_minutes integer not null check (duration_minutes > 0),
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.service_barbers (
  service_id uuid not null references public.services(id) on delete cascade,
  barber_id uuid not null references public.barbers(id) on delete cascade,
  primary key (service_id, barber_id)
);

create table if not exists public.service_plans (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  name text not null,
  description text,
  price numeric(10,2) not null default 0,
  duration_minutes integer not null default 0,
  active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.service_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.service_plans(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  unique (plan_id, service_id)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  barber_id uuid not null references public.barbers(id) on delete restrict,
  service_id uuid references public.services(id) on delete restrict,
  plan_id uuid references public.service_plans(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'pending',
  notes text,
  public_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint appointments_single_item check ((service_id is not null) <> (plan_id is not null)),
  constraint appointments_period check (end_at > start_at),
  constraint appointments_status check (status in ('pending','confirmed','arrived','in_progress','completed','canceled','no_show'))
);

create table if not exists public.barber_schedules (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_time time,
  end_time time,
  is_day_off boolean not null default false,
  unique (barber_id, weekday)
);

create table if not exists public.blocked_times (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  barber_id uuid references public.barbers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_at timestamptz default now(),
  constraint blocked_times_period check (ends_at > starts_at)
);

-- Índices de tenant, agenda e chaves estrangeiras
create index if not exists idx_users_barbershop_id on public.users(barbershop_id);
create index if not exists idx_barbers_barbershop_id on public.barbers(barbershop_id);
create index if not exists idx_clients_barbershop_id on public.clients(barbershop_id);
create index if not exists idx_services_barbershop_id on public.services(barbershop_id);
create index if not exists idx_service_barbers_barber_id on public.service_barbers(barber_id);
create index if not exists idx_service_plans_barbershop_id on public.service_plans(barbershop_id);
create index if not exists idx_service_plan_items_service_id on public.service_plan_items(service_id);
create index if not exists idx_appointments_barbershop_id on public.appointments(barbershop_id);
create index if not exists idx_appointments_barber_period on public.appointments(barber_id, start_at, end_at);
create index if not exists idx_appointments_client_id on public.appointments(client_id);
create index if not exists idx_barber_schedules_barber_id on public.barber_schedules(barber_id);
create index if not exists idx_blocked_times_barbershop_id on public.blocked_times(barbershop_id);
create index if not exists idx_blocked_times_barber_period on public.blocked_times(barber_id, starts_at, ends_at);

-- Atualização automática de updated_at
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_barbershops_updated_at on public.barbershops;
create trigger trg_barbershops_updated_at before update on public.barbershops
for each row execute function public.set_updated_at();

drop trigger if exists trg_barbers_updated_at on public.barbers;
create trigger trg_barbers_updated_at before update on public.barbers
for each row execute function public.set_updated_at();

drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists trg_services_updated_at on public.services;
create trigger trg_services_updated_at before update on public.services
for each row execute function public.set_updated_at();

drop trigger if exists trg_service_plans_updated_at on public.service_plans;
create trigger trg_service_plans_updated_at before update on public.service_plans
for each row execute function public.set_updated_at();

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at before update on public.appointments
for each row execute function public.set_updated_at();

-- Contexto do tenant do usuário autenticado
create or replace function public.current_barbershop_id() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select u.barbershop_id from public.users u where u.id = auth.uid() limit 1;
$$;

create or replace function public.is_shop_member(p_shop uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.barbershop_id = p_shop);
$$;

grant execute on function public.current_barbershop_id() to anon, authenticated;
grant execute on function public.is_shop_member(uuid) to anon, authenticated;

-- Row Level Security
alter table public.barbershops enable row level security;
alter table public.users enable row level security;
alter table public.barbers enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.service_barbers enable row level security;
alter table public.service_plans enable row level security;
alter table public.service_plan_items enable row level security;
alter table public.appointments enable row level security;
alter table public.barber_schedules enable row level security;
alter table public.blocked_times enable row level security;

-- Políticas: barbershops
drop policy if exists barbershops_select on public.barbershops;
create policy barbershops_select on public.barbershops for select to authenticated
using (id = public.current_barbershop_id());

drop policy if exists barbershops_insert on public.barbershops;
create policy barbershops_insert on public.barbershops for insert to authenticated
with check (id = public.current_barbershop_id());

drop policy if exists barbershops_update on public.barbershops;
create policy barbershops_update on public.barbershops for update to authenticated
using (id = public.current_barbershop_id()) with check (id = public.current_barbershop_id());

drop policy if exists barbershops_delete on public.barbershops;
create policy barbershops_delete on public.barbershops for delete to authenticated
using (id = public.current_barbershop_id());

-- Políticas: users (leitura do próprio tenant, escrita apenas do próprio registro)
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated
using (id = auth.uid() or barbershop_id = public.current_barbershop_id());

-- Somente a RPC security definer de onboarding escreve em users.
drop policy if exists users_insert on public.users;
drop policy if exists users_update on public.users;
drop policy if exists users_delete on public.users;

-- Políticas: tabelas com barbershop_id
drop policy if exists barbers_select on public.barbers;
create policy barbers_select on public.barbers for select to authenticated
using (barbershop_id = public.current_barbershop_id());

drop policy if exists barbers_insert on public.barbers;
create policy barbers_insert on public.barbers for insert to authenticated
with check (barbershop_id = public.current_barbershop_id());

drop policy if exists barbers_update on public.barbers;
create policy barbers_update on public.barbers for update to authenticated
using (barbershop_id = public.current_barbershop_id()) with check (barbershop_id = public.current_barbershop_id());

drop policy if exists barbers_delete on public.barbers;
create policy barbers_delete on public.barbers for delete to authenticated
using (barbershop_id = public.current_barbershop_id());

drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated
using (barbershop_id = public.current_barbershop_id());

drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated
with check (barbershop_id = public.current_barbershop_id());

drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated
using (barbershop_id = public.current_barbershop_id()) with check (barbershop_id = public.current_barbershop_id());

drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated
using (barbershop_id = public.current_barbershop_id());

drop policy if exists services_select on public.services;
create policy services_select on public.services for select to authenticated
using (barbershop_id = public.current_barbershop_id());

drop policy if exists services_insert on public.services;
create policy services_insert on public.services for insert to authenticated
with check (barbershop_id = public.current_barbershop_id());

drop policy if exists services_update on public.services;
create policy services_update on public.services for update to authenticated
using (barbershop_id = public.current_barbershop_id()) with check (barbershop_id = public.current_barbershop_id());

drop policy if exists services_delete on public.services;
create policy services_delete on public.services for delete to authenticated
using (barbershop_id = public.current_barbershop_id());

drop policy if exists service_plans_select on public.service_plans;
create policy service_plans_select on public.service_plans for select to authenticated
using (barbershop_id = public.current_barbershop_id());

drop policy if exists service_plans_insert on public.service_plans;
create policy service_plans_insert on public.service_plans for insert to authenticated
with check (barbershop_id = public.current_barbershop_id());

drop policy if exists service_plans_update on public.service_plans;
create policy service_plans_update on public.service_plans for update to authenticated
using (barbershop_id = public.current_barbershop_id()) with check (barbershop_id = public.current_barbershop_id());

drop policy if exists service_plans_delete on public.service_plans;
create policy service_plans_delete on public.service_plans for delete to authenticated
using (barbershop_id = public.current_barbershop_id());

drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments for select to authenticated
using (barbershop_id = public.current_barbershop_id());

drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert on public.appointments for insert to authenticated
with check (barbershop_id = public.current_barbershop_id());

drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments for update to authenticated
using (barbershop_id = public.current_barbershop_id()) with check (barbershop_id = public.current_barbershop_id());

drop policy if exists appointments_delete on public.appointments;
create policy appointments_delete on public.appointments for delete to authenticated
using (barbershop_id = public.current_barbershop_id());

drop policy if exists blocked_times_select on public.blocked_times;
create policy blocked_times_select on public.blocked_times for select to authenticated
using (barbershop_id = public.current_barbershop_id());

drop policy if exists blocked_times_insert on public.blocked_times;
create policy blocked_times_insert on public.blocked_times for insert to authenticated
with check (barbershop_id = public.current_barbershop_id());

drop policy if exists blocked_times_update on public.blocked_times;
create policy blocked_times_update on public.blocked_times for update to authenticated
using (barbershop_id = public.current_barbershop_id()) with check (barbershop_id = public.current_barbershop_id());

drop policy if exists blocked_times_delete on public.blocked_times;
create policy blocked_times_delete on public.blocked_times for delete to authenticated
using (barbershop_id = public.current_barbershop_id());

-- Políticas: tabelas filhas (tenant validado pela tabela pai)
drop policy if exists service_barbers_select on public.service_barbers;
create policy service_barbers_select on public.service_barbers for select to authenticated
using (exists (select 1 from public.services s where s.id = service_barbers.service_id and s.barbershop_id = public.current_barbershop_id()));

drop policy if exists service_barbers_insert on public.service_barbers;
create policy service_barbers_insert on public.service_barbers for insert to authenticated
with check (
  exists (select 1 from public.services s where s.id = service_barbers.service_id and s.barbershop_id = public.current_barbershop_id())
  and exists (select 1 from public.barbers b where b.id = service_barbers.barber_id and b.barbershop_id = public.current_barbershop_id())
);

drop policy if exists service_barbers_update on public.service_barbers;
create policy service_barbers_update on public.service_barbers for update to authenticated
using (exists (select 1 from public.services s where s.id = service_barbers.service_id and s.barbershop_id = public.current_barbershop_id()))
with check (
  exists (select 1 from public.services s where s.id = service_barbers.service_id and s.barbershop_id = public.current_barbershop_id())
  and exists (select 1 from public.barbers b where b.id = service_barbers.barber_id and b.barbershop_id = public.current_barbershop_id())
);

drop policy if exists service_barbers_delete on public.service_barbers;
create policy service_barbers_delete on public.service_barbers for delete to authenticated
using (exists (select 1 from public.services s where s.id = service_barbers.service_id and s.barbershop_id = public.current_barbershop_id()));

drop policy if exists barber_schedules_select on public.barber_schedules;
create policy barber_schedules_select on public.barber_schedules for select to authenticated
using (exists (select 1 from public.barbers b where b.id = barber_schedules.barber_id and b.barbershop_id = public.current_barbershop_id()));

drop policy if exists barber_schedules_insert on public.barber_schedules;
create policy barber_schedules_insert on public.barber_schedules for insert to authenticated
with check (exists (select 1 from public.barbers b where b.id = barber_schedules.barber_id and b.barbershop_id = public.current_barbershop_id()));

drop policy if exists barber_schedules_update on public.barber_schedules;
create policy barber_schedules_update on public.barber_schedules for update to authenticated
using (exists (select 1 from public.barbers b where b.id = barber_schedules.barber_id and b.barbershop_id = public.current_barbershop_id()))
with check (exists (select 1 from public.barbers b where b.id = barber_schedules.barber_id and b.barbershop_id = public.current_barbershop_id()));

drop policy if exists barber_schedules_delete on public.barber_schedules;
create policy barber_schedules_delete on public.barber_schedules for delete to authenticated
using (exists (select 1 from public.barbers b where b.id = barber_schedules.barber_id and b.barbershop_id = public.current_barbershop_id()));

drop policy if exists service_plan_items_select on public.service_plan_items;
create policy service_plan_items_select on public.service_plan_items for select to authenticated
using (exists (select 1 from public.service_plans sp where sp.id = service_plan_items.plan_id and sp.barbershop_id = public.current_barbershop_id()));

drop policy if exists service_plan_items_insert on public.service_plan_items;
create policy service_plan_items_insert on public.service_plan_items for insert to authenticated
with check (
  exists (select 1 from public.service_plans sp where sp.id = service_plan_items.plan_id and sp.barbershop_id = public.current_barbershop_id())
  and exists (select 1 from public.services s where s.id = service_plan_items.service_id and s.barbershop_id = public.current_barbershop_id())
);

drop policy if exists service_plan_items_update on public.service_plan_items;
create policy service_plan_items_update on public.service_plan_items for update to authenticated
using (exists (select 1 from public.service_plans sp where sp.id = service_plan_items.plan_id and sp.barbershop_id = public.current_barbershop_id()))
with check (
  exists (select 1 from public.service_plans sp where sp.id = service_plan_items.plan_id and sp.barbershop_id = public.current_barbershop_id())
  and exists (select 1 from public.services s where s.id = service_plan_items.service_id and s.barbershop_id = public.current_barbershop_id())
);

drop policy if exists service_plan_items_delete on public.service_plan_items;
create policy service_plan_items_delete on public.service_plan_items for delete to authenticated
using (exists (select 1 from public.service_plans sp where sp.id = service_plan_items.plan_id and sp.barbershop_id = public.current_barbershop_id()));

-- Criação da primeira loja pelo usuário autenticado
create or replace function public.create_barbershop_for_current_user(
  p_name text,
  p_address text default null,
  p_whatsapp text default null,
  p_logo_url text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_shop_id uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

  select u.barbershop_id into v_shop_id from public.users u where u.id = auth.uid();
  if v_shop_id is not null then
    return v_shop_id;
  end if;

  v_name := coalesce(
    nullif(btrim(coalesce((select raw_user_meta_data->>'full_name' from auth.users where id = auth.uid()), '')), ''),
    nullif(btrim(coalesce((select split_part(email, '@', 1) from auth.users where id = auth.uid()), '')), ''),
    'Usuário'
  );

  insert into public.barbershops (name, address, whatsapp, logo_url, hours)
  values (
    p_name,
    p_address,
    p_whatsapp,
    p_logo_url,
    '[{"day":1,"open":"09:00","close":"19:00","closed":false},{"day":2,"open":"09:00","close":"19:00","closed":false},{"day":3,"open":"09:00","close":"19:00","closed":false},{"day":4,"open":"09:00","close":"19:00","closed":false},{"day":5,"open":"09:00","close":"19:00","closed":false},{"day":6,"open":"09:00","close":"14:00","closed":false},{"day":0,"open":"09:00","close":"19:00","closed":true}]'::jsonb
  )
  returning id into v_shop_id;

  insert into public.users (id, barbershop_id, full_name, role)
  values (auth.uid(), v_shop_id, v_name, 'manager');

  return v_shop_id;
end;
$$;

grant execute on function public.create_barbershop_for_current_user(text, text, text, text) to authenticated;

-- API pública de agendamento
create or replace function public.public_get_services(p_shop uuid)
returns table(id uuid, name text, description text, price numeric, duration_minutes integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.barbershops b where b.id = p_shop) then
    raise exception 'Loja não encontrada' using errcode = 'P0002';
  end if;
  return query
    select s.id, s.name, s.description, s.price, s.duration_minutes
    from public.services s
    where s.barbershop_id = p_shop and s.active
    order by s.name;
end;
$$;

grant execute on function public.public_get_services(uuid) to anon, authenticated;

create or replace function public.public_get_barbers(p_shop uuid)
returns table(id uuid, name text, photo_url text, specialties text[])
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.barbershops b where b.id = p_shop) then
    raise exception 'Loja não encontrada' using errcode = 'P0002';
  end if;
  return query
    select b.id, b.name, b.photo_url, b.specialties
    from public.barbers b
    where b.barbershop_id = p_shop and b.active
    order by b.name;
end;
$$;

grant execute on function public.public_get_barbers(uuid) to anon, authenticated;

create or replace function public.public_get_shop_settings(p_shop uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_hours jsonb;
  v_settings jsonb;
begin
  select b.hours, b.settings into v_hours, v_settings from public.barbershops b where b.id = p_shop;
  if not found then
    raise exception 'Loja não encontrada' using errcode = 'P0002';
  end if;
  return jsonb_build_object('hours', v_hours, 'settings', v_settings);
end;
$$;

grant execute on function public.public_get_shop_settings(uuid) to anon, authenticated;

create or replace function public.public_get_barber_schedules(p_shop uuid)
returns table(barber_id uuid, weekday integer, start_time time, end_time time, is_day_off boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.barbershops b where b.id = p_shop) then
    raise exception 'Loja não encontrada' using errcode = 'P0002';
  end if;
  return query
    select bs.barber_id, bs.weekday, bs.start_time, bs.end_time, bs.is_day_off
    from public.barber_schedules bs
    join public.barbers b on b.id = bs.barber_id
    where b.barbershop_id = p_shop
    order by bs.barber_id, bs.weekday;
end;
$$;

grant execute on function public.public_get_barber_schedules(uuid) to anon, authenticated;

create or replace function public.public_get_blocked_times(p_shop uuid, p_from timestamptz, p_to timestamptz)
returns table(barber_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.barbershops b where b.id = p_shop) then
    raise exception 'Loja não encontrada' using errcode = 'P0002';
  end if;
  return query
    select bt.barber_id, bt.starts_at, bt.ends_at
    from public.blocked_times bt
    where bt.barbershop_id = p_shop and bt.starts_at < p_to and bt.ends_at > p_from
    order by bt.starts_at;
end;
$$;

grant execute on function public.public_get_blocked_times(uuid, timestamptz, timestamptz) to anon, authenticated;

create or replace function public.public_get_busy_intervals(p_shop uuid, p_from timestamptz, p_to timestamptz)
returns table(barber_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.barbershops b where b.id = p_shop) then
    raise exception 'Loja não encontrada' using errcode = 'P0002';
  end if;
  return query
    select a.barber_id, a.start_at, a.end_at
    from public.appointments a
    where a.barbershop_id = p_shop
      and a.status in ('pending','confirmed','arrived','in_progress')
      and a.start_at < p_to and a.end_at > p_from
    order by a.start_at;
end;
$$;

grant execute on function public.public_get_busy_intervals(uuid, timestamptz, timestamptz) to anon, authenticated;

-- Criação pública de agendamento com todas as validações de disponibilidade
drop function if exists public.public_create_appointment(uuid, text, text, text, uuid, uuid, uuid, timestamptz, text);
create or replace function public.public_create_appointment(
  p_shop uuid,
  p_client_name text,
  p_client_phone text,
  p_client_whatsapp text,
  p_barber uuid,
  p_service_id uuid,
  p_plan_id uuid,
  p_start_at timestamptz,
  p_notes text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_shop public.barbershops%rowtype;
  v_barber public.barbers%rowtype;
  v_duration integer;
  v_lead integer;
  v_max_days integer;
  v_end_at timestamptz;
  v_weekday integer;
  v_local_start time;
  v_local_end time;
  v_closed boolean;
  v_open time;
  v_close time;
  v_day_off boolean;
  v_barber_open time;
  v_barber_close time;
  v_break record;
  v_client_id uuid;
  v_appointment_id uuid;
  v_token uuid;
begin
  select * into v_shop from public.barbershops b where b.id = p_shop;
  if not found then
    raise exception 'Loja não encontrada' using errcode = 'P0002';
  end if;

  if (p_service_id is null) = (p_plan_id is null) then
    raise exception 'Informe exatamente um serviço ou um plano' using errcode = '22023';
  end if;

  select * into v_barber from public.barbers b
  where b.id = p_barber and b.barbershop_id = p_shop and b.active = true;
  if not found then
    raise exception 'Barbeiro indisponível' using errcode = '22023';
  end if;

  if p_service_id is not null then
    select s.duration_minutes into v_duration from public.services s
    where s.id = p_service_id::uuid and s.barbershop_id = p_shop and s.active = true;
  else
    select sp.duration_minutes into v_duration from public.service_plans sp
    where sp.id = p_plan_id::uuid and sp.barbershop_id = p_shop and sp.active = true;
  end if;
  if v_duration is null or v_duration <= 0 then
    raise exception 'Serviço ou plano indisponível' using errcode = '22023';
  end if;

  -- Quando há permissões configuradas, o barbeiro precisa estar habilitado.
  if p_service_id is not null and exists (
    select 1 from public.service_barbers sb where sb.service_id = p_service_id
  ) and not exists (
    select 1 from public.service_barbers sb
    where sb.service_id = p_service_id and sb.barber_id = p_barber
  ) then
    raise exception 'Barbeiro não habilitado para este serviço' using errcode = '22023';
  end if;

  -- Serializa a agenda do barbeiro durante toda a transação
  perform pg_advisory_xact_lock(hashtext(p_barber::text));

  v_lead := coalesce((v_shop.settings->>'lead_time_minutes')::integer, 60);
  if p_start_at is null or p_start_at < now() + make_interval(mins => v_lead) then
    raise exception 'Horário não respeita a antecedência mínima' using errcode = '22023';
  end if;

  v_end_at := p_start_at + make_interval(mins => v_duration);
  v_weekday := extract(dow from (p_start_at at time zone 'America/Sao_Paulo'))::integer;
  v_local_start := (p_start_at at time zone 'America/Sao_Paulo')::time;
  v_local_end := (v_end_at at time zone 'America/Sao_Paulo')::time;

  select (elem->>'closed')::boolean, (elem->>'open')::time, (elem->>'close')::time
  into v_closed, v_open, v_close
  from jsonb_array_elements(v_shop.hours) as h(elem)
  where (elem->>'day')::integer = v_weekday
  limit 1;
  if coalesce(v_closed, false) or v_open is null or v_close is null then
    raise exception 'A loja está fechada neste horário' using errcode = '22023';
  end if;
  if v_local_start < v_open or v_local_end > v_close then
    raise exception 'Horário fora do expediente da loja' using errcode = '22023';
  end if;

  select bs.is_day_off, bs.start_time, bs.end_time
  into v_day_off, v_barber_open, v_barber_close
  from public.barber_schedules bs
  where bs.barber_id = p_barber and bs.weekday = v_weekday;
  if found then
    if coalesce(v_day_off, false) or v_barber_open is null or v_barber_close is null then
      raise exception 'O barbeiro não atende neste horário' using errcode = '22023';
    end if;
    if v_local_start < v_barber_open or v_local_end > v_barber_close then
      raise exception 'Horário fora do expediente do barbeiro' using errcode = '22023';
    end if;
  else
    raise exception 'Barbeiro sem jornada configurada para este dia' using errcode = '22023';
  end if;

  v_max_days := coalesce((v_shop.settings->>'max_days_ahead')::integer, 60);
  if p_start_at > now() + make_interval(days => v_max_days) then
    raise exception 'Horário além do limite de antecedência' using errcode = '22023';
  end if;

  for v_break in
    select (elem->>'start')::time as ini, (elem->>'end')::time as fim
    from jsonb_array_elements(v_barber.breaks) as b(elem)
  loop
    if v_local_start < v_break.fim and v_local_end > v_break.ini then
      raise exception 'Horário conflita com uma pausa do barbeiro' using errcode = '22023';
    end if;
  end loop;

  if exists (
    select 1 from public.blocked_times bt
    where bt.barbershop_id = p_shop
      and (bt.barber_id = p_barber or bt.barber_id is null)
      and bt.starts_at < v_end_at and bt.ends_at > p_start_at
  ) then
    raise exception 'Horário bloqueado' using errcode = '23P01';
  end if;

  if exists (
    select 1 from public.appointments a
    where a.barber_id = p_barber
      and a.status in ('pending','confirmed','arrived','in_progress')
      and a.start_at < v_end_at and a.end_at > p_start_at
  ) then
    raise exception 'Horário já ocupado' using errcode = '23P01';
  end if;

  if p_client_phone is not null and btrim(p_client_phone) <> '' then
    select c.id into v_client_id from public.clients c
    where c.barbershop_id = p_shop and c.phone = p_client_phone
    order by c.created_at limit 1;
  end if;

  if v_client_id is null then
    insert into public.clients (id, barbershop_id, name, phone, whatsapp)
    values (
      gen_random_uuid(),
      p_shop,
      coalesce(nullif(btrim(p_client_name), ''), 'Cliente'),
      p_client_phone,
      p_client_whatsapp
    )
    returning id into v_client_id;
  end if;

  insert into public.appointments
    (barbershop_id, client_id, barber_id, service_id, plan_id, start_at, end_at, status, notes)
  values
    (p_shop, v_client_id, p_barber, p_service_id::uuid, p_plan_id::uuid, p_start_at, v_end_at, 'pending', p_notes)
  returning id, public_token into v_appointment_id, v_token;

  return jsonb_build_object(
    'id', v_appointment_id,
    'publicToken', v_token,
    'status', 'pending',
    'startAt', p_start_at,
    'endAt', v_end_at
  );
end;
$$;

grant execute on function public.public_create_appointment(uuid, text, text, text, uuid, uuid, uuid, timestamptz, text) to anon, authenticated;

-- Cancelamento público pelo token do agendamento
create or replace function public.public_cancel_appointment(p_token uuid) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
begin
  select a.id into v_id from public.appointments a
  where a.public_token = p_token
    and a.status not in ('completed','canceled','no_show');
  if v_id is null then
    return false;
  end if;

  update public.appointments a set status = 'canceled', updated_at = now() where a.id = v_id;
  return true;
end;
$$;

grant execute on function public.public_cancel_appointment(uuid) to anon, authenticated;

-- Proteção final contra sobreposição de agendamentos do mesmo barbeiro
create or replace function public.prevent_appointment_overlap() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.barber_id::text));

  if new.service_id is not null and exists (
    select 1 from public.service_barbers sb where sb.service_id = new.service_id
  ) and not exists (
    select 1 from public.service_barbers sb
    where sb.service_id = new.service_id and sb.barber_id = new.barber_id
  ) then
    raise exception 'Barbeiro não habilitado para este serviço' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.appointments a
    where a.barber_id = new.barber_id
      and a.id is distinct from new.id
      and a.status in ('pending','confirmed','arrived','in_progress')
      and tstzrange(a.start_at, a.end_at, '[)') && tstzrange(new.start_at, new.end_at, '[)')
  ) then
    raise exception 'Horário já ocupado para este barbeiro' using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_appointment_overlap on public.appointments;
create trigger trg_prevent_appointment_overlap
before insert or update on public.appointments
for each row execute function public.prevent_appointment_overlap();

-- Intervalos de pausa necessários para calcular a disponibilidade via API pública
create or replace function public.public_get_barber_breaks(p_shop uuid)
returns table(barber_id uuid, breaks jsonb)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.barbershops b where b.id = p_shop) then
    raise exception 'Loja não encontrada' using errcode = 'P0002';
  end if;
  return query
    select b.id, b.breaks
    from public.barbers b
    where b.barbershop_id = p_shop and b.active = true;
end;
$$;

grant execute on function public.public_get_barber_breaks(uuid) to anon, authenticated;

-- Planos ativos disponíveis para sites externos
create or replace function public.public_get_plans(p_shop uuid)
returns table(id uuid, name text, description text, price numeric, duration_minutes integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.barbershops b where b.id = p_shop) then
    raise exception 'Loja não encontrada' using errcode = 'P0002';
  end if;
  return query
    select sp.id, sp.name, sp.description, sp.price, sp.duration_minutes
    from public.service_plans sp
    where sp.barbershop_id = p_shop and sp.active
    order by sp.name;
end;
$$;

grant execute on function public.public_get_plans(uuid) to anon, authenticated;

-- Barbeiros habilitados para um serviço (filtra a disponibilidade pública)
create or replace function public.public_get_service_barbers(p_shop uuid, p_service uuid)
returns table(barber_id uuid)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if p_service is null then
    return;
  end if;
  if not exists (select 1 from public.barbershops b where b.id = p_shop) then
    raise exception 'Loja não encontrada' using errcode = 'P0002';
  end if;
  return query
    select sb.barber_id
    from public.service_barbers sb
    join public.services s on s.id = sb.service_id
    where sb.service_id = p_service and s.barbershop_id = p_shop;
end;
$$;

grant execute on function public.public_get_service_barbers(uuid, uuid) to anon, authenticated;
