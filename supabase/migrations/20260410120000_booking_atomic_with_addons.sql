-- --------------------------------------------------------
-- Atomic booking creation with server-validated add-ons
--
-- Replaces the previous create_booking_if_available, which:
--   1. accepted a client-supplied p_total_price (spoofable)
--   2. required the caller to make a separate insert into
--      booking_add_ons, which was not part of the same
--      transaction and had its error silently discarded.
--
-- The new version takes the add-on ids and computes the
-- authoritative total from the catalog inside the same
-- transaction as the booking insert.
-- --------------------------------------------------------

drop function if exists public.create_booking_if_available(
  uuid, uuid, uuid, timestamptz, timestamptz, numeric, numeric
);

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
  v_resource_hourly_rate integer;
  v_resource_price integer;
  v_addons_price integer;
  v_total_price integer;
  v_requested_count int;
  v_found_count int;
  v_conflict_count int;
begin
  -- 1. Fetch the authoritative resource rate (and verify it's active)
  select hourly_rate into v_resource_hourly_rate
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

  -- 5. Insert the booking with the server-computed total
  insert into public.bookings (
    resource_id, location_id, booker_id,
    start_time, end_time, duration_hours,
    total_price, status
  ) values (
    p_resource_id, p_location_id, p_booker_id,
    p_start_time, p_end_time, p_duration_hours,
    v_total_price, 'pending'
  )
  returning id into v_booking_id;

  -- 6. Insert the add-on line items with snapshotted prices.
  --    Same transaction as the booking insert — either both land or
  --    neither does.
  if v_requested_count > 0 then
    insert into public.booking_add_ons (booking_id, add_on_service_id, price)
    select v_booking_id, id, (hourly_rate * p_duration_hours)::integer
    from public.add_on_services
    where id = any(p_add_on_ids)
      and location_id = p_location_id
      and is_active = true;
  end if;

  return jsonb_build_object(
    'booking_id', v_booking_id,
    'total_price', v_total_price
  );
end;
$$;
