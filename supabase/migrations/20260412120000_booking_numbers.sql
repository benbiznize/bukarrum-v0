-- --------------------------------------------------------
-- Human-readable booking numbers (#1001, #1002, …)
--
-- Adds a per-tenant sequential number to every booking so
-- tenants and bookers can reference reservations by a short
-- memorable identifier instead of a UUID. Numbers start at
-- 1001 for each tenant and are allocated atomically inside
-- the same transaction as the booking insert.
--
-- Allocation strategy:
--   A dedicated `booking_number_counters` table holds one
--   row per tenant. The `create_booking_if_available` RPC
--   bumps that row with `INSERT ... ON CONFLICT DO UPDATE
--   ... RETURNING`, which is a single row-locked statement.
--   Two concurrent bookings for the same tenant serialize
--   on the counter row and always receive distinct numbers.
-- --------------------------------------------------------

-- 1. Per-tenant counter table -----------------------------

create table public.booking_number_counters (
  tenant_id   uuid primary key references public.tenants(id) on delete cascade,
  last_number integer not null,
  updated_at  timestamptz not null default now()
);

-- No policies — only the SECURITY DEFINER RPC touches this
-- table. Enabling RLS with no permissive policies locks it
-- down from direct anon/authenticated reads and writes.
alter table public.booking_number_counters enable row level security;

-- 2. Add the column to bookings ---------------------------

alter table public.bookings
  add column booking_number integer;

create index bookings_booking_number_idx
  on public.bookings (booking_number);

-- 3. Allocation helper + trigger --------------------------
-- A shared helper bumps the counter atomically and returns
-- the new number. The RPC uses it directly (so it can put
-- the value in its return payload); a BEFORE INSERT trigger
-- uses it to auto-allocate for any other insertion path
-- (seed data, background jobs, future admin tools).

create or replace function public.allocate_booking_number(p_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number integer;
begin
  insert into public.booking_number_counters as c (tenant_id, last_number)
  values (p_tenant_id, 1001)
  on conflict (tenant_id) do update
    set last_number = c.last_number + 1,
        updated_at  = now()
  returning last_number into v_number;

  return v_number;
end;
$$;

create or replace function public.bookings_assign_booking_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  if new.booking_number is not null then
    return new;
  end if;

  select tenant_id into v_tenant_id
  from public.resources
  where id = new.resource_id;

  if v_tenant_id is null then
    raise exception 'RESOURCE_NOT_FOUND' using errcode = 'P0003';
  end if;

  new.booking_number := public.allocate_booking_number(v_tenant_id);
  return new;
end;
$$;

create trigger bookings_assign_booking_number
  before insert on public.bookings
  for each row
  execute function public.bookings_assign_booking_number();

-- 4. Backfill existing bookings ---------------------------
-- Number existing rows per tenant ordered by creation time,
-- starting at 1001 for each tenant's earliest booking.

with numbered as (
  select
    b.id,
    r.tenant_id,
    1000 + row_number() over (
      partition by r.tenant_id
      order by b.created_at, b.id
    ) as n
  from public.bookings b
  join public.resources r on r.id = b.resource_id
)
update public.bookings b
set booking_number = numbered.n
from numbered
where b.id = numbered.id;

-- Seed the counter table so the next booking picks up where
-- the backfill left off.
insert into public.booking_number_counters (tenant_id, last_number)
select r.tenant_id, max(b.booking_number)
from public.bookings b
join public.resources r on r.id = b.resource_id
group by r.tenant_id;

alter table public.bookings
  alter column booking_number set not null;

-- 5. Update create_booking_if_available RPC --------------
-- Two additions on top of the previous version:
--   * fetch the resource's tenant_id
--   * allocate a booking_number via allocate_booking_number
-- The JSONB return shape gains a `booking_number` field.

create or replace function public.create_booking_if_available(
  p_resource_id uuid,
  p_location_id uuid,
  p_booker_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_duration_hours numeric,
  p_add_on_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_booking_number integer;
  v_tenant_id uuid;
  v_resource_hourly_rate integer;
  v_resource_price integer;
  v_addons_price integer;
  v_total_price integer;
  v_requested_count int;
  v_found_count int;
  v_conflict_count int;
  v_add_ons jsonb;
begin
  -- 1. Fetch the authoritative resource rate + tenant
  select hourly_rate, tenant_id
    into v_resource_hourly_rate, v_tenant_id
  from public.resources
  where id = p_resource_id and is_active = true;

  if v_resource_hourly_rate is null then
    raise exception 'RESOURCE_NOT_FOUND' using errcode = 'P0003';
  end if;

  v_resource_price := (v_resource_hourly_rate * p_duration_hours)::integer;

  -- 2. Validate + price add-ons. Every requested id must exist, be
  --    active, and belong to p_location_id — otherwise we fail the
  --    whole booking rather than silently dropping items.
  v_requested_count := coalesce(array_length(p_add_on_ids, 1), 0);

  if v_requested_count > 0 then
    select count(*), coalesce(sum(hourly_rate * p_duration_hours), 0)::integer
      into v_found_count, v_addons_price
    from public.add_on_services
    where id = any(p_add_on_ids)
      and location_id = p_location_id
      and is_active = true;

    if v_found_count <> v_requested_count then
      raise exception 'INVALID_ADD_ONS' using errcode = 'P0002';
    end if;
  else
    v_addons_price := 0;
  end if;

  v_total_price := v_resource_price + v_addons_price;

  -- 3. Lock bookings for this resource to prevent races
  perform 1
  from public.bookings
  where resource_id = p_resource_id
    and status not in ('cancelled')
  for update;

  -- 4. Check for overlapping bookings
  select count(*) into v_conflict_count
  from public.bookings
  where resource_id = p_resource_id
    and status not in ('cancelled')
    and start_time < p_end_time
    and end_time > p_start_time;

  if v_conflict_count > 0 then
    raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
  end if;

  -- 5. Allocate the next per-tenant booking number.
  --    First booking for a tenant → 1001.
  --    Every subsequent booking → previous + 1.
  --    (The BEFORE INSERT trigger would handle this too, but
  --    we call the helper directly so we can return the value.)
  v_booking_number := public.allocate_booking_number(v_tenant_id);

  -- 6. Insert the booking with the server-computed total
  insert into public.bookings (
    resource_id, location_id, booker_id,
    start_time, end_time, duration_hours,
    total_price, status, booking_number
  ) values (
    p_resource_id, p_location_id, p_booker_id,
    p_start_time, p_end_time, p_duration_hours,
    v_total_price, 'pending', v_booking_number
  )
  returning id into v_booking_id;

  -- 7. Insert the add-on line items with snapshotted prices.
  if v_requested_count > 0 then
    insert into public.booking_add_ons (booking_id, add_on_service_id, price)
    select v_booking_id, id, (hourly_rate * p_duration_hours)::integer
    from public.add_on_services
    where id = any(p_add_on_ids)
      and location_id = p_location_id
      and is_active = true;
  end if;

  -- 8. Resolve line items for the return payload.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',    ba.add_on_service_id,
        'name',  a.name,
        'price', ba.price
      )
      order by a.name
    ),
    '[]'::jsonb
  )
  into v_add_ons
  from public.booking_add_ons ba
  join public.add_on_services a on a.id = ba.add_on_service_id
  where ba.booking_id = v_booking_id;

  return jsonb_build_object(
    'booking_id',     v_booking_id,
    'booking_number', v_booking_number,
    'total_price',    v_total_price,
    'resource_price', v_resource_price,
    'add_ons',        v_add_ons
  );
end;
$$;
