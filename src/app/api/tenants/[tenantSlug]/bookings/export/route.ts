import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  bookingsToCsv,
  type CsvBookingRow,
} from "@/app/(dashboard)/dashboard/[tenantSlug]/bookings/_lib/csv";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ tenantSlug: string }> }
) {
  const { tenantSlug } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .eq("user_id", user.id)
    .single();
  if (!tenant) {
    return NextResponse.json({ error: "Tenant no encontrado" }, { status: 404 });
  }

  let body: { bookingIds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const bookingIds = Array.isArray(body.bookingIds)
    ? body.bookingIds.filter((x): x is string => typeof x === "string")
    : [];
  if (bookingIds.length === 0) {
    return NextResponse.json(
      { error: "bookingIds requeridos" },
      { status: 400 }
    );
  }

  const { data: rows, error } = await supabase
    .from("bookings")
    .select(
      `
      booking_number,
      start_time,
      duration_hours,
      total_price,
      paid_amount,
      payment_status,
      status,
      resource:resources!inner(name, tenant_id),
      location:locations(name, timezone),
      booker:bookers!inner(name, email, phone)
    `
    )
    .in("id", bookingIds)
    .eq("resource.tenant_id", tenant.id)
    .order("start_time", { ascending: false });

  if (error || !rows) {
    return NextResponse.json(
      { error: "No se pudo exportar" },
      { status: 500 }
    );
  }

  const csvRows: CsvBookingRow[] = rows.map((row) => {
    const resource = row.resource as unknown as { name: string };
    const location = row.location as unknown as {
      name: string;
      timezone: string;
    } | null;
    const booker = row.booker as unknown as {
      name: string;
      email: string;
      phone: string | null;
    };
    return {
      booking_number: row.booking_number,
      start_time: row.start_time,
      duration_hours: row.duration_hours,
      total_price: row.total_price,
      paid_amount: row.paid_amount,
      payment_status: row.payment_status,
      status: row.status,
      resource_name: resource.name,
      location_name: location?.name ?? null,
      location_timezone: location?.timezone ?? "America/Santiago",
      booker_name: booker.name,
      booker_email: booker.email,
      booker_phone: booker.phone,
    };
  });

  const csv = bookingsToCsv(csvRows);
  const filename = `reservas-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
