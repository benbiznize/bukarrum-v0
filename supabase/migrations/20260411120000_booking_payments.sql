-- ============================================================
-- Booking payments — audit trail + denormalized status on bookings
-- ============================================================
-- Tenants record payments (and refunds) against bookings. Payments
-- may be offline (cash, transfer, card, other) or online. This is
-- pure tracking; no payment processor integration.
--
-- Payment status on the booking is derived from the sum of payment
-- and refund rows in booking_payments and kept in sync by a trigger.
-- ============================================================

-- Enums --------------------------------------------------------
create type public.payment_method as enum (
  'cash', 'transfer', 'card', 'mercadopago', 'other'
);
create type public.payment_entry_type as enum ('payment', 'refund');
create type public.booking_payment_status as enum (
  'unpaid', 'partial', 'paid', 'refunded'
);

-- Denormalized columns on bookings -----------------------------
alter table public.bookings
  add column payment_status public.booking_payment_status not null default 'unpaid',
  add column paid_amount integer not null default 0;

create index bookings_payment_status_idx on public.bookings(payment_status);

-- Audit trail table --------------------------------------------
create table public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount integer not null check (amount > 0),  -- CLP, always positive; sign comes from entry_type
  entry_type public.payment_entry_type not null default 'payment',
  method public.payment_method not null,
  paid_at timestamptz not null default now(),
  reference text,
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index booking_payments_booking_id_idx on public.booking_payments(booking_id);
create index booking_payments_paid_at_idx on public.booking_payments(paid_at);

-- Recompute trigger --------------------------------------------
create or replace function public.recompute_booking_payment_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid := coalesce(new.booking_id, old.booking_id);
  v_total integer;
  v_payments integer;
  v_refunds integer;
  v_net integer;
  v_status public.booking_payment_status;
begin
  select total_price into v_total from public.bookings where id = v_booking_id;

  -- If the booking was deleted (cascade from bookings), nothing to update.
  if v_total is null then
    return null;
  end if;

  select
    coalesce(sum(amount) filter (where entry_type = 'payment'), 0),
    coalesce(sum(amount) filter (where entry_type = 'refund'),  0)
  into v_payments, v_refunds
  from public.booking_payments
  where booking_id = v_booking_id;

  v_net := v_payments - v_refunds;

  if v_payments > 0 and v_net <= 0 then
    v_status := 'refunded';
  elsif v_net <= 0 then
    v_status := 'unpaid';
  elsif v_net >= v_total then
    v_status := 'paid';
  else
    v_status := 'partial';
  end if;

  update public.bookings
    set paid_amount = greatest(v_net, 0),
        payment_status = v_status,
        updated_at = now()
    where id = v_booking_id;

  return null;
end;
$$;

create trigger booking_payments_recompute
  after insert or update or delete on public.booking_payments
  for each row execute function public.recompute_booking_payment_state();

-- RLS ----------------------------------------------------------
alter table public.booking_payments enable row level security;

create policy "Tenant owner can read booking payments"
  on public.booking_payments for select
  using (
    booking_id in (
      select b.id from public.bookings b
      join public.resources r on r.id = b.resource_id
      where r.tenant_id = public.get_current_tenant_id()
    )
  );

create policy "Tenant owner can insert booking payments"
  on public.booking_payments for insert
  with check (
    booking_id in (
      select b.id from public.bookings b
      join public.resources r on r.id = b.resource_id
      where r.tenant_id = public.get_current_tenant_id()
    )
  );

create policy "Tenant owner can delete booking payments"
  on public.booking_payments for delete
  using (
    booking_id in (
      select b.id from public.bookings b
      join public.resources r on r.id = b.resource_id
      where r.tenant_id = public.get_current_tenant_id()
    )
  );
