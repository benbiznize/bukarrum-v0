-- --------------------------------------------------------
-- Per-resource add-ons with flexible pricing mode
--
-- Previously `add_on_services` belonged to a location. In practice
-- an add-on (e.g. "headphones rental", "audio recording") is tied
-- to a specific resource — not every resource at a location offers
-- the same extras, and pricing can vary by resource.
--
-- This migration:
--   1. Re-parents add_on_services from location_id -> resource_id
--   2. Renames `hourly_rate` -> `unit_price`
--   3. Adds `pricing_mode` enum ('hourly' | 'flat') so an add-on
--      can be billed per duration-hour or as a flat fee
--   4. Rewrites `create_booking_if_available` to:
--        * validate add-ons against booking's resource_id
--        * compute prices via CASE pricing_mode
--
-- Backfill strategy:
--   Each existing add-on is cloned per resource currently attached
--   to its old location (via `resource_locations`). This preserves
--   the "any resource at this location has access" semantics from
--   the previous schema. Each clone can then diverge independently.
-- --------------------------------------------------------

-- 1. Pricing mode enum ------------------------------------

create type public.add_on_pricing_mode as enum ('hourly', 'flat');

-- 2. Add new columns (resource_id nullable for now, backfilled below)
--    and rename hourly_rate -> unit_price so the name reflects that
--    the value is now interpreted by pricing_mode.

alter table public.add_on_services
  add column resource_id uuid references public.resources(id) on delete cascade,
  add column pricing_mode public.add_on_pricing_mode not null default 'hourly';

alter table public.add_on_services
  rename column hourly_rate to unit_price;

-- 3. Backfill: clone each add-on per resource at its location.
--    For N resources at the location, the single add-on becomes N
--    rows — one per resource — preserving availability semantics.

-- NOTE: `location_id` is still NOT NULL on `add_on_services` at this point
-- (it's only dropped in step 5 below). We therefore carry `ao.location_id`
-- through the CTE and into the INSERT column list to satisfy the constraint
-- for the cloned rows — they'll lose the column a few statements later anyway.
-- Without this, the backfill explodes on any database that actually has
-- existing add_on_services rows (e.g. Supabase Preview branches, which clone
-- production data). Locally with `db:reset` it silently passes because the
-- table is empty when migrations run, so the CTE produces zero rows.
with source as (
  select
    ao.id           as old_id,
    ao.location_id,
    ao.name,
    ao.description,
    ao.unit_price,
    ao.is_active,
    ao.created_at,
    rl.resource_id
  from public.add_on_services ao
  join public.resource_locations rl on rl.location_id = ao.location_id
)
insert into public.add_on_services (
  location_id, resource_id, name, description, unit_price, is_active,
  pricing_mode, created_at, updated_at
)
select
  location_id, resource_id, name, description, unit_price, is_active,
  'hourly'::public.add_on_pricing_mode, created_at, now()
from source;

-- Delete all originals — their clones now exist with resource_id set.
-- We scope the delete to rows with NULL resource_id to avoid touching
-- the freshly-inserted clones, which all have non-null resource_id.
delete from public.add_on_services where resource_id is null;

-- 4. Drop old RLS policy (it chains through location_id) -----

drop policy if exists "Tenant owner can manage add-on services"
  on public.add_on_services;

-- 5. Drop location-based FK + index + make resource_id required

drop index if exists public.add_on_services_location_id_idx;

alter table public.add_on_services
  drop column location_id;

alter table public.add_on_services
  alter column resource_id set not null;

create index add_on_services_resource_id_idx
  on public.add_on_services(resource_id);

-- 6. Recreate RLS policy keyed on resource_id -> tenant_id ---

create policy "Tenant owner can manage add-on services"
  on public.add_on_services for all
  using (
    resource_id in (
      select r.id
      from public.resources r
      join public.tenants t on t.id = r.tenant_id
      where t.user_id = auth.uid()
    )
  );

-- (The "Anyone can read active add-on services" policy from the
--  initial schema has no location_id reference and stays as-is.)

-- 7. Rewrite create_booking_if_available to enforce that add-ons
--    belong to the booking's resource, and to price per pricing_mode.

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
  --    active, and belong to p_resource_id — otherwise we fail the
  --    whole booking rather than silently dropping items.
  --
  --    Price per add-on depends on its pricing_mode:
  --      'hourly' -> unit_price * duration_hours
  --      'flat'   -> unit_price (duration-independent)
  v_requested_count := coalesce(array_length(p_add_on_ids, 1), 0);

  if v_requested_count > 0 then
    select
      count(*),
      coalesce(
        sum(
          case pricing_mode
            when 'hourly' then unit_price * p_duration_hours
            when 'flat'   then unit_price
          end
        ),
        0
      )::integer
      into v_found_count, v_addons_price
    from public.add_on_services
    where id = any(p_add_on_ids)
      and resource_id = p_resource_id
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
    select
      v_booking_id,
      id,
      (
        case pricing_mode
          when 'hourly' then unit_price * p_duration_hours
          when 'flat'   then unit_price
        end
      )::integer
    from public.add_on_services
    where id = any(p_add_on_ids)
      and resource_id = p_resource_id
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
