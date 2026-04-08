-- ============================================================
-- Bukarrum MVP — Initial Schema
-- Multi-tenant booking platform for physical creative resources
-- ============================================================

-- --------------------------------------------------------
-- Custom types
-- --------------------------------------------------------
create type public.booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
create type public.resource_type as enum ('room', 'equipment');
create type public.subscription_status as enum ('active', 'past_due', 'cancelled', 'trialing');
create type public.day_of_week as enum ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');

-- --------------------------------------------------------
-- Plans (subscription tiers)
-- --------------------------------------------------------
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  price_monthly integer not null, -- in CLP (Chilean pesos), no decimals needed
  price_annual integer not null,  -- in CLP
  features jsonb not null default '{}',
  display_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.plans.features is 'JSON: { locations, resources_per_location, bookings_per_month, add_ons, analytics }';

-- --------------------------------------------------------
-- Tenants (one business = one tenant = one membership)
-- --------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$')
);

create unique index tenants_user_id_idx on public.tenants(user_id);

-- --------------------------------------------------------
-- Subscriptions (tenant <-> plan link)
-- --------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status public.subscription_status not null default 'trialing',
  mercadopago_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subscriptions_tenant_id_idx on public.subscriptions(tenant_id);

-- --------------------------------------------------------
-- Locations (physical stores/branches)
-- --------------------------------------------------------
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  address text,
  city text,
  timezone text not null default 'America/Santiago',
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locations_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
  unique (tenant_id, slug)
);

create index locations_tenant_id_idx on public.locations(tenant_id);

-- --------------------------------------------------------
-- Resources (bookable rooms/equipment within a location)
-- --------------------------------------------------------
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  description text,
  type public.resource_type not null default 'room',
  hourly_rate integer not null, -- in CLP
  min_duration_hours smallint not null default 1,
  max_duration_hours smallint not null default 8,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index resources_location_id_idx on public.resources(location_id);

-- --------------------------------------------------------
-- Availability (recurring weekly schedule per resource)
-- --------------------------------------------------------
create table public.availability (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  day_of_week public.day_of_week not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint availability_time_range check (start_time < end_time),
  unique (resource_id, day_of_week, start_time)
);

create index availability_resource_id_idx on public.availability(resource_id);

-- --------------------------------------------------------
-- Bookers (end customers who make bookings)
-- --------------------------------------------------------
create table public.bookers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index bookers_email_idx on public.bookers(email);

-- --------------------------------------------------------
-- Bookings (reservations)
-- --------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  booker_id uuid not null references public.bookers(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_hours smallint not null,
  total_price integer not null, -- in CLP
  status public.booking_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_time_range check (start_time < end_time)
);

create index bookings_resource_id_idx on public.bookings(resource_id);
create index bookings_booker_id_idx on public.bookings(booker_id);
create index bookings_start_time_idx on public.bookings(start_time);
create index bookings_status_idx on public.bookings(status);

-- --------------------------------------------------------
-- Add-on services (optional services attachable to bookings)
-- --------------------------------------------------------
create table public.add_on_services (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  description text,
  hourly_rate integer not null, -- in CLP
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index add_on_services_location_id_idx on public.add_on_services(location_id);

-- --------------------------------------------------------
-- Booking add-ons (junction table)
-- --------------------------------------------------------
create table public.booking_add_ons (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  add_on_service_id uuid not null references public.add_on_services(id) on delete cascade,
  price integer not null, -- snapshot at booking time, in CLP
  created_at timestamptz not null default now(),
  unique (booking_id, add_on_service_id)
);

-- --------------------------------------------------------
-- Updated_at trigger function
-- --------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply updated_at triggers
create trigger set_updated_at before update on public.plans
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.tenants
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.subscriptions
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.locations
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.resources
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.bookers
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.bookings
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.add_on_services
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.plans enable row level security;
alter table public.tenants enable row level security;
alter table public.subscriptions enable row level security;
alter table public.locations enable row level security;
alter table public.resources enable row level security;
alter table public.availability enable row level security;
alter table public.bookers enable row level security;
alter table public.bookings enable row level security;
alter table public.add_on_services enable row level security;
alter table public.booking_add_ons enable row level security;

-- --------------------------------------------------------
-- Helper: get current user's tenant_id
-- --------------------------------------------------------
create or replace function public.get_current_tenant_id()
returns uuid as $$
  select id from public.tenants where user_id = auth.uid()
$$ language sql security definer stable;

-- --------------------------------------------------------
-- Plans: readable by everyone (public pricing page)
-- --------------------------------------------------------
create policy "Plans are publicly readable"
  on public.plans for select
  using (true);

-- --------------------------------------------------------
-- Tenants: anyone can read (for booking pages), owner can manage
-- --------------------------------------------------------
create policy "Anyone can read tenants"
  on public.tenants for select
  using (true);

create policy "Users can insert their own tenant"
  on public.tenants for insert
  with check (user_id = auth.uid());

create policy "Users can update their own tenant"
  on public.tenants for update
  using (user_id = auth.uid());

-- --------------------------------------------------------
-- Subscriptions: tenant owner only
-- --------------------------------------------------------
create policy "Tenant owner can read subscription"
  on public.subscriptions for select
  using (tenant_id = public.get_current_tenant_id());

create policy "Tenant owner can update subscription"
  on public.subscriptions for update
  using (tenant_id = public.get_current_tenant_id());

-- Service role inserts/manages subscriptions via webhooks

-- --------------------------------------------------------
-- Locations: tenant owner CRUD, public read for active
-- --------------------------------------------------------
create policy "Tenant owner can manage locations"
  on public.locations for all
  using (tenant_id = public.get_current_tenant_id());

create policy "Anyone can read active locations"
  on public.locations for select
  using (is_active = true);

-- --------------------------------------------------------
-- Resources: scoped via location -> tenant, public read
-- --------------------------------------------------------
create policy "Tenant owner can manage resources"
  on public.resources for all
  using (
    location_id in (
      select id from public.locations where tenant_id = public.get_current_tenant_id()
    )
  );

create policy "Anyone can read active resources"
  on public.resources for select
  using (is_active = true);

-- --------------------------------------------------------
-- Availability: scoped via resource -> location -> tenant, public read
-- --------------------------------------------------------
create policy "Tenant owner can manage availability"
  on public.availability for all
  using (
    resource_id in (
      select r.id from public.resources r
      join public.locations l on r.location_id = l.id
      where l.tenant_id = public.get_current_tenant_id()
    )
  );

create policy "Anyone can read availability"
  on public.availability for select
  using (true);

-- --------------------------------------------------------
-- Bookers: public insert (booking flow), tenant reads via bookings
-- --------------------------------------------------------
create policy "Anyone can create a booker"
  on public.bookers for insert
  with check (true);

create policy "Tenant owner can read bookers for their bookings"
  on public.bookers for select
  using (
    id in (
      select b.booker_id from public.bookings b
      join public.resources r on b.resource_id = r.id
      join public.locations l on r.location_id = l.id
      where l.tenant_id = public.get_current_tenant_id()
    )
  );

-- --------------------------------------------------------
-- Bookings: public insert, tenant owner manages
-- --------------------------------------------------------
create policy "Anyone can create a booking"
  on public.bookings for insert
  with check (true);

create policy "Tenant owner can read and manage bookings"
  on public.bookings for select
  using (
    resource_id in (
      select r.id from public.resources r
      join public.locations l on r.location_id = l.id
      where l.tenant_id = public.get_current_tenant_id()
    )
  );

create policy "Tenant owner can update bookings"
  on public.bookings for update
  using (
    resource_id in (
      select r.id from public.resources r
      join public.locations l on r.location_id = l.id
      where l.tenant_id = public.get_current_tenant_id()
    )
  );

-- --------------------------------------------------------
-- Add-on services: tenant owner CRUD, public read for active
-- --------------------------------------------------------
create policy "Tenant owner can manage add-on services"
  on public.add_on_services for all
  using (
    location_id in (
      select id from public.locations where tenant_id = public.get_current_tenant_id()
    )
  );

create policy "Anyone can read active add-on services"
  on public.add_on_services for select
  using (is_active = true);

-- --------------------------------------------------------
-- Booking add-ons: scoped via booking
-- --------------------------------------------------------
create policy "Anyone can create booking add-ons"
  on public.booking_add_ons for insert
  with check (true);

create policy "Tenant owner can read booking add-ons"
  on public.booking_add_ons for select
  using (
    booking_id in (
      select b.id from public.bookings b
      join public.resources r on b.resource_id = r.id
      join public.locations l on r.location_id = l.id
      where l.tenant_id = public.get_current_tenant_id()
    )
  );
