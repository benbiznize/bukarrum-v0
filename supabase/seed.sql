-- ============================================================
-- Bukarrum MVP — Seed Data
-- Realistic Chilean creative studio for development/testing
-- ============================================================

-- --------------------------------------------------------
-- Plans (3-tier pricing in CLP)
-- --------------------------------------------------------
insert into public.plans (name, slug, price_monthly, price_annual, features, display_order) values
  ('Starter', 'starter', 29990, 299900, '{"locations": 1, "resources_per_location": 3, "bookings_per_month": 30, "add_ons": false, "analytics": false}', 1),
  ('Pro', 'pro', 59990, 599900, '{"locations": 3, "resources_per_location": 10, "bookings_per_month": 200, "add_ons": true, "analytics": false}', 2),
  ('Enterprise', 'enterprise', 99990, 999900, '{"locations": -1, "resources_per_location": -1, "bookings_per_month": -1, "add_ons": true, "analytics": true}', 3);

-- --------------------------------------------------------
-- Demo tenant (no auth user yet — will be linked on first sign-up)
-- For seed purposes, we use a placeholder user_id that will be
-- replaced when a real user signs up and claims this tenant.
-- --------------------------------------------------------

-- First, create a test user in auth.users for the seed tenant
-- This uses Supabase's auth admin to create a test user
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token, raw_app_meta_data, raw_user_meta_data, email_change, email_change_token_new, email_change_token_current, phone_change, phone_change_token)
values (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'demo@bukarrum.test',
  crypt('demo-password-123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  '',
  '',
  '',
  '',
  ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  jsonb_build_object('sub', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'email', 'demo@bukarrum.test'),
  'email',
  now(),
  now(),
  now()
);

-- Tenant
insert into public.tenants (id, user_id, name, slug) values
  ('11111111-1111-1111-1111-111111111111', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Estudio Sónico', 'estudio-sonico');

-- Subscription (Pro tier)
insert into public.subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
select
  '11111111-1111-1111-1111-111111111111',
  id,
  'active',
  now(),
  now() + interval '30 days'
from public.plans where slug = 'pro';

-- --------------------------------------------------------
-- Locations
-- --------------------------------------------------------
insert into public.locations (id, tenant_id, name, slug, address, city, timezone) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Sede Providencia', 'providencia', 'Av. Providencia 1234', 'Santiago', 'America/Santiago'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Sede Ñuñoa', 'nunoa', 'Irarrázaval 567', 'Santiago', 'America/Santiago');

-- --------------------------------------------------------
-- Resources (tenant-scoped)
-- --------------------------------------------------------
insert into public.resources (id, tenant_id, name, description, type, hourly_rate, min_duration_hours, max_duration_hours) values
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Sala de Ensayo DJ', 'Sala equipada con CDJs Pioneer, mixer DJM-900, y monitores KRK', 'room', 15000, 1, 4),
  ('aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Estudio de Producción A', 'Producción musical con Pro Tools, interfaz Apollo, y monitores Genelec', 'room', 25000, 2, 8),
  ('aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Ciclorama', 'Ciclorama blanco 4x6m para fotografía y video', 'room', 35000, 2, 8),
  ('bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Sala de Podcasting', 'Sala acústica con 4 micrófonos Shure SM7B y grabadora Rodecaster', 'room', 12000, 1, 4),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Kit de Iluminación', 'Kit completo Godox con 3 luces, softboxes y trípodes', 'equipment', 8000, 1, 8);

-- --------------------------------------------------------
-- Resource ↔ Location assignments (many-to-many)
-- --------------------------------------------------------
insert into public.resource_locations (resource_id, location_id) values
  -- Providencia resources
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222'),
  ('aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222'),
  ('aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222'),
  -- Ñuñoa resources
  ('bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333'),
  -- Kit de Iluminación also available at Providencia (example of multi-location resource)
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222');

-- --------------------------------------------------------
-- Availability (weekly recurring schedule)
-- --------------------------------------------------------
-- Sala de Ensayo DJ: Mon-Sat 10:00-22:00
insert into public.availability (resource_id, day_of_week, start_time, end_time) values
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'monday', '10:00', '22:00'),
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tuesday', '10:00', '22:00'),
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'wednesday', '10:00', '22:00'),
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'thursday', '10:00', '22:00'),
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'friday', '10:00', '22:00'),
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'saturday', '10:00', '22:00');

-- Estudio de Producción A: Mon-Fri 09:00-23:00
insert into public.availability (resource_id, day_of_week, start_time, end_time) values
  ('aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'monday', '09:00', '23:00'),
  ('aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tuesday', '09:00', '23:00'),
  ('aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'wednesday', '09:00', '23:00'),
  ('aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'thursday', '09:00', '23:00'),
  ('aaaa2222-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'friday', '09:00', '23:00');

-- Ciclorama: Mon-Sun 08:00-20:00
insert into public.availability (resource_id, day_of_week, start_time, end_time) values
  ('aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'monday', '08:00', '20:00'),
  ('aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tuesday', '08:00', '20:00'),
  ('aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'wednesday', '08:00', '20:00'),
  ('aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'thursday', '08:00', '20:00'),
  ('aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'friday', '08:00', '20:00'),
  ('aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'saturday', '08:00', '20:00'),
  ('aaaa3333-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sunday', '08:00', '20:00');

-- Sala de Podcasting: Mon-Sat 09:00-21:00
insert into public.availability (resource_id, day_of_week, start_time, end_time) values
  ('bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'monday', '09:00', '21:00'),
  ('bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'tuesday', '09:00', '21:00'),
  ('bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'wednesday', '09:00', '21:00'),
  ('bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'thursday', '09:00', '21:00'),
  ('bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'friday', '09:00', '21:00'),
  ('bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'saturday', '09:00', '21:00');

-- Kit de Iluminación: Mon-Sun 08:00-22:00
insert into public.availability (resource_id, day_of_week, start_time, end_time) values
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'monday', '08:00', '22:00'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'tuesday', '08:00', '22:00'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'wednesday', '08:00', '22:00'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'thursday', '08:00', '22:00'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'friday', '08:00', '22:00'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'saturday', '08:00', '22:00'),
  ('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'sunday', '08:00', '22:00');

-- --------------------------------------------------------
-- Add-on services
-- --------------------------------------------------------
insert into public.add_on_services (location_id, name, description, hourly_rate) values
  ('22222222-2222-2222-2222-222222222222', 'Ingeniero de Sonido', 'Técnico profesional para grabación y mezcla en vivo', 20000),
  ('22222222-2222-2222-2222-222222222222', 'Fotógrafo', 'Fotógrafo profesional para sesiones en ciclorama', 25000),
  ('33333333-3333-3333-3333-333333333333', 'Editor de Podcast', 'Post-producción y edición de audio para tu podcast', 15000);

-- --------------------------------------------------------
-- Sample booker and booking
-- --------------------------------------------------------
insert into public.bookers (id, email, name, phone) values
  ('cccc1111-cccc-cccc-cccc-cccccccccccc', 'maria@example.com', 'María González', '+56912345678');

insert into public.bookings (resource_id, location_id, booker_id, start_time, end_time, duration_hours, total_price, status) values
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'cccc1111-cccc-cccc-cccc-cccccccccccc', now() + interval '2 days' + interval '14 hours', now() + interval '2 days' + interval '16 hours', 2, 30000, 'confirmed'),
  ('bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'cccc1111-cccc-cccc-cccc-cccccccccccc', now() + interval '5 days' + interval '10 hours', now() + interval '5 days' + interval '12 hours', 2, 24000, 'pending');
