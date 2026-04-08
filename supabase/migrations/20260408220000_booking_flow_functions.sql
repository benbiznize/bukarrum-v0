-- --------------------------------------------------------
-- Functions for public booking flow
-- Security definer to bypass RLS for specific operations
-- --------------------------------------------------------

-- Upsert a booker by email (returning customers get updated)
create or replace function public.upsert_booker(
  p_email text,
  p_name text,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.bookers (email, name, phone)
  values (lower(trim(p_email)), trim(p_name), p_phone)
  on conflict (email) do update set
    name = excluded.name,
    phone = coalesce(excluded.phone, bookers.phone),
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

-- Get booked time ranges for a resource on a given date range
-- Used by the booking flow to calculate available time slots
create or replace function public.get_bookings_for_resource(
  p_resource_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns table (
  start_time timestamptz,
  end_time timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select b.start_time, b.end_time
  from public.bookings b
  where b.resource_id = p_resource_id
    and b.status not in ('cancelled')
    and b.start_time < p_end
    and b.end_time > p_start;
$$;

-- Atomically create a booking with overlap check
create or replace function public.create_booking_if_available(
  p_resource_id uuid,
  p_location_id uuid,
  p_booker_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_duration_hours numeric,
  p_total_price numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflict_count int;
  v_booking_id uuid;
begin
  -- Lock bookings for this resource to prevent race conditions
  perform 1
  from public.bookings
  where resource_id = p_resource_id
    and status not in ('cancelled')
  for update;

  -- Check for overlapping bookings
  select count(*) into v_conflict_count
  from public.bookings
  where resource_id = p_resource_id
    and status not in ('cancelled')
    and start_time < p_end_time
    and end_time > p_start_time;

  if v_conflict_count > 0 then
    raise exception 'BOOKING_CONFLICT' using errcode = 'P0001';
  end if;

  -- Insert the booking
  insert into public.bookings (
    resource_id, location_id, booker_id,
    start_time, end_time, duration_hours,
    total_price, status
  ) values (
    p_resource_id, p_location_id, p_booker_id,
    p_start_time, p_end_time, p_duration_hours,
    p_total_price, 'pending'
  )
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;
