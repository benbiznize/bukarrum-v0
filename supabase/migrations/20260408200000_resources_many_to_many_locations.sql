-- --------------------------------------------------------
-- Resources: change from location-scoped to tenant-scoped
-- with many-to-many relationship via junction table
-- --------------------------------------------------------

-- 1. Add tenant_id to resources
alter table public.resources add column tenant_id uuid references public.tenants(id) on delete cascade;

-- Backfill tenant_id from location
update public.resources r
  set tenant_id = l.tenant_id
  from public.locations l
  where r.location_id = l.id;

alter table public.resources alter column tenant_id set not null;
create index resources_tenant_id_idx on public.resources(tenant_id);

-- 2. Create junction table
create table public.resource_locations (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (resource_id, location_id)
);

alter table public.resource_locations enable row level security;
create index resource_locations_resource_id_idx on public.resource_locations(resource_id);
create index resource_locations_location_id_idx on public.resource_locations(location_id);

-- Backfill junction table from existing location_id
insert into public.resource_locations (resource_id, location_id)
  select id, location_id from public.resources where location_id is not null;

-- 3. Add location_id to bookings (which location was the resource booked at)
alter table public.bookings add column location_id uuid references public.locations(id);

-- Backfill from old resource.location_id
update public.bookings b
  set location_id = r.location_id
  from public.resources r
  where b.resource_id = r.id;

-- 4. Drop all policies that depend on resources.location_id BEFORE dropping the column
drop policy if exists "Tenant owner can manage resources" on public.resources;
drop policy if exists "Tenant owner can manage availability" on public.availability;
drop policy if exists "Tenant owner can read bookers for their bookings" on public.bookers;
drop policy if exists "Tenant owner can read and manage bookings" on public.bookings;
drop policy if exists "Tenant owner can update bookings" on public.bookings;
drop policy if exists "Tenant owner can read booking add-ons" on public.booking_add_ons;

-- 5. Now safe to drop the column
drop index if exists resources_location_id_idx;
alter table public.resources drop column location_id;

-- --------------------------------------------------------
-- Recreate RLS policies with new schema
-- --------------------------------------------------------

-- Resources: now tenant-scoped directly
create policy "Tenant owner can manage resources"
  on public.resources for all
  using (tenant_id = public.get_current_tenant_id());

-- Resource locations: tenant owner via resource
create policy "Tenant owner can manage resource locations"
  on public.resource_locations for all
  using (
    resource_id in (
      select id from public.resources where tenant_id = public.get_current_tenant_id()
    )
  );

create policy "Anyone can read resource locations"
  on public.resource_locations for select
  using (true);

-- Availability: now chains through resource.tenant_id
create policy "Tenant owner can manage availability"
  on public.availability for all
  using (
    resource_id in (
      select id from public.resources where tenant_id = public.get_current_tenant_id()
    )
  );

-- Bookers: update chain to use resource.tenant_id
create policy "Tenant owner can read bookers for their bookings"
  on public.bookers for select
  using (
    id in (
      select b.booker_id from public.bookings b
      join public.resources r on b.resource_id = r.id
      where r.tenant_id = public.get_current_tenant_id()
    )
  );

-- Bookings: update chain to use resource.tenant_id
create policy "Tenant owner can read and manage bookings"
  on public.bookings for select
  using (
    resource_id in (
      select id from public.resources where tenant_id = public.get_current_tenant_id()
    )
  );

create policy "Tenant owner can update bookings"
  on public.bookings for update
  using (
    resource_id in (
      select id from public.resources where tenant_id = public.get_current_tenant_id()
    )
  );

-- Booking add-ons: update chain
create policy "Tenant owner can read booking add-ons"
  on public.booking_add_ons for select
  using (
    booking_id in (
      select b.id from public.bookings b
      join public.resources r on b.resource_id = r.id
      where r.tenant_id = public.get_current_tenant_id()
    )
  );
