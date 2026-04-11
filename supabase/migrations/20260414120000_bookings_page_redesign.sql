-- Bookings admin page redesign: indexes, has_add_ons materialized column, search_bookings RPC.
-- See docs/superpowers/specs/2026-04-10-bookings-admin-page-redesign-design.md

-- ----------------------------------------------------------------
-- 1. Indexes for list-page filter/sort queries
-- ----------------------------------------------------------------

-- Main list query: scoped via resource FK, sorted by start_time desc
create index if not exists bookings_resource_start_idx
  on public.bookings (resource_id, start_time desc);

-- Location-scoped filter with same sort
create index if not exists bookings_location_start_idx
  on public.bookings (location_id, start_time desc);

-- Partial index for hot tabs (pending + confirmed). The 'archived' tabs
-- (completed, cancelled, no_show) are cold — a full index would waste
-- space on rows that are rarely filtered.
create index if not exists bookings_status_pending_confirmed_idx
  on public.bookings (status)
  where status in ('pending', 'confirmed');

-- Composite for the 'unpaid' queue (status='confirmed' + payment_status in partial/unpaid)
create index if not exists bookings_status_payment_idx
  on public.bookings (status, payment_status);

-- ----------------------------------------------------------------
-- 2. has_add_ons materialized column + trigger
-- ----------------------------------------------------------------

alter table public.bookings
  add column if not exists has_add_ons boolean not null default false;

-- Backfill existing rows
update public.bookings b
set has_add_ons = exists (
  select 1 from public.booking_add_ons ba where ba.booking_id = b.id
);

-- Keep the column in sync via a trigger on booking_add_ons
create or replace function public.update_booking_has_add_ons()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    update public.bookings
      set has_add_ons = true
      where id = new.booking_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.bookings
      set has_add_ons = exists (
        select 1 from public.booking_add_ons
          where booking_id = old.booking_id
      )
      where id = old.booking_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists booking_add_ons_sync_has_add_ons on public.booking_add_ons;
create trigger booking_add_ons_sync_has_add_ons
  after insert or delete on public.booking_add_ons
  for each row
  execute function public.update_booking_has_add_ons();

create index if not exists bookings_has_add_ons_idx
  on public.bookings (has_add_ons)
  where has_add_ons = true;

-- ----------------------------------------------------------------
-- 3. search_bookings RPC
-- ----------------------------------------------------------------

-- Returns booking rows matching a tenant-scoped search + filter combo.
-- Security: SECURITY INVOKER, so Supabase RLS + tenant_id check in the
-- WHERE clause enforce isolation.
create or replace function public.search_bookings(
  p_tenant_id uuid,
  p_query text default '',
  p_tab text default 'all',
  p_location_id uuid default null,
  p_resource_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_has_add_ons boolean default null,
  p_page int default 1
)
returns setof public.bookings
language sql
stable
security invoker
as $$
  select b.*
  from public.bookings b
  join public.resources r on r.id = b.resource_id
  join public.bookers bk on bk.id = b.booker_id
  where r.tenant_id = p_tenant_id
    and (
      coalesce(p_query, '') = ''
      or b.booking_number::text ilike '%' || p_query || '%'
      or bk.name ilike '%' || p_query || '%'
      or bk.email ilike '%' || p_query || '%'
      or coalesce(bk.phone, '') ilike '%' || p_query || '%'
    )
    and (
      p_tab = 'all'
      or (p_tab = 'pending' and b.status = 'pending')
      or (p_tab = 'unpaid'
          and b.status = 'confirmed'
          and b.payment_status in ('unpaid', 'partial'))
      or (p_tab = 'upcoming'
          and b.status = 'confirmed'
          and b.start_time >= now()
          and b.start_time <= now() + interval '7 days')
      or (p_tab = 'past_due'
          and b.status = 'confirmed'
          and b.start_time < now())
      or (p_tab = 'archived'
          and b.status in ('completed', 'cancelled', 'no_show'))
    )
    and (p_location_id is null or b.location_id = p_location_id)
    and (p_resource_id is null or b.resource_id = p_resource_id)
    and (p_from is null or b.start_time >= p_from)
    and (p_to is null or b.start_time <= p_to)
    and (p_has_add_ons is null or b.has_add_ons = p_has_add_ons)
  order by b.start_time desc
  limit 50
  offset greatest(p_page - 1, 0) * 50;
$$;

-- Count variant of the same search (for the header "12 of N" subtitle and
-- for the single tab's total when a query is active).
create or replace function public.search_bookings_count(
  p_tenant_id uuid,
  p_query text default '',
  p_tab text default 'all',
  p_location_id uuid default null,
  p_resource_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_has_add_ons boolean default null
)
returns bigint
language sql
stable
security invoker
as $$
  select count(*)::bigint
  from public.bookings b
  join public.resources r on r.id = b.resource_id
  join public.bookers bk on bk.id = b.booker_id
  where r.tenant_id = p_tenant_id
    and (
      coalesce(p_query, '') = ''
      or b.booking_number::text ilike '%' || p_query || '%'
      or bk.name ilike '%' || p_query || '%'
      or bk.email ilike '%' || p_query || '%'
      or coalesce(bk.phone, '') ilike '%' || p_query || '%'
    )
    and (
      p_tab = 'all'
      or (p_tab = 'pending' and b.status = 'pending')
      or (p_tab = 'unpaid'
          and b.status = 'confirmed'
          and b.payment_status in ('unpaid', 'partial'))
      or (p_tab = 'upcoming'
          and b.status = 'confirmed'
          and b.start_time >= now()
          and b.start_time <= now() + interval '7 days')
      or (p_tab = 'past_due'
          and b.status = 'confirmed'
          and b.start_time < now())
      or (p_tab = 'archived'
          and b.status in ('completed', 'cancelled', 'no_show'))
    )
    and (p_location_id is null or b.location_id = p_location_id)
    and (p_resource_id is null or b.resource_id = p_resource_id)
    and (p_from is null or b.start_time >= p_from)
    and (p_to is null or b.start_time <= p_to)
    and (p_has_add_ons is null or b.has_add_ons = p_has_add_ons);
$$;
