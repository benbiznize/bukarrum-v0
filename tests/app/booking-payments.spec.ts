import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/**
 * These tests run with the pre-authenticated session from global.setup.ts.
 * Each test seeds its own booker + pending booking against the shared
 * e2e-studio tenant, then cleans up in afterEach. Bookers are global
 * (not tenant-scoped), so we use a unique email per test to avoid
 * collisions across retries.
 */
test.describe("Booking payments — auto-confirm on full payment", () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let bookingId: string;
  let bookerId: string;

  // Bukarrum is Spanish-first. Playwright's default browser Accept-Language
  // is en-US, which would cause the proxy to serve the English dictionary.
  // Force the production locale by setting the `locale` cookie (the proxy
  // checks cookie → Accept-Language → "es").
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: "locale",
        value: "es",
        url: "http://localhost:3000",
      },
    ]);
  });

  test.beforeEach(async () => {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", "e2e-studio")
      .single();
    if (!tenant) throw new Error("e2e-studio tenant missing — setup failed");

    const { data: location } = await supabase
      .from("locations")
      .select("id")
      .eq("tenant_id", tenant.id)
      .single();
    const { data: resource } = await supabase
      .from("resources")
      .select("id")
      .eq("tenant_id", tenant.id)
      .single();
    if (!location || !resource) throw new Error("seeded location/resource missing");

    const uniqueEmail = `e2e-booker-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}@bukarrum.test`;
    const { data: booker, error: bookerError } = await supabase
      .from("bookers")
      .insert({ name: "E2E Booker", email: uniqueEmail })
      .select("id")
      .single();
    if (bookerError || !booker) {
      throw new Error(`seed booker failed: ${bookerError?.message ?? "no row"}`);
    }
    bookerId = booker.id;

    const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        resource_id: resource.id,
        location_id: location.id,
        booker_id: bookerId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_hours: 1,
        total_price: 10000,
        status: "pending",
      })
      .select("id")
      .single();
    if (bookingError || !booking) {
      throw new Error(`seed booking failed: ${bookingError?.message ?? "no row"}`);
    }
    bookingId = booking.id;
  });

  test.afterEach(async () => {
    if (bookingId) {
      await supabase.from("bookings").delete().eq("id", bookingId);
    }
    if (bookerId) {
      await supabase.from("bookers").delete().eq("id", bookerId);
    }
  });

  test("recording a full payment auto-confirms the booking", async ({ page }) => {
    await page.goto(`/dashboard/e2e-studio/bookings/${bookingId}`);

    // Sanity: booking starts as Pendiente / Sin pagar, NOT Confirmada / Pagado.
    // Use the payment-status-badge test id so we aren't fooled by the
    // "Pagado: $0" summary row label on the detail page.
    const paymentBadge = page.getByTestId("payment-status-badge");
    await expect(
      page.getByText("Pendiente", { exact: true }).first()
    ).toBeVisible();
    await expect(paymentBadge).toHaveText("Sin pagar");
    await expect(page.getByText("Confirmada", { exact: true })).toHaveCount(0);

    // Open the payment dialog. The amount prefills with the full balance
    // (10000) and the method defaults to cash — we just submit.
    await page.getByRole("button", { name: "Registrar pago" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Guardar", exact: true }).click();

    // Successful submission closes the dialog (see panel's startTransition).
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // After revalidation, the detail page re-renders with Confirmada + Pagado.
    await expect(
      page.getByText("Confirmada", { exact: true })
    ).toBeVisible({ timeout: 5000 });
    await expect(paymentBadge).toHaveText("Pagado");

    // Database side is the source of truth — verify the status flipped there too.
    const { data: updated } = await supabase
      .from("bookings")
      .select("status, payment_status, paid_amount")
      .eq("id", bookingId)
      .single();

    expect(updated).toMatchObject({
      status: "confirmed",
      payment_status: "paid",
      paid_amount: 10000,
    });
  });

  test("recording a partial payment leaves the booking pending", async ({
    page,
  }) => {
    await page.goto(`/dashboard/e2e-studio/bookings/${bookingId}`);

    await page.getByRole("button", { name: "Registrar pago" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Override the prefilled full amount with a partial payment.
    const amountInput = dialog.getByLabel("Monto (CLP)");
    await amountInput.fill("4000");

    await dialog.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 5000 });

    // Status must NOT auto-promote — partial payments don't cross the threshold.
    await expect(
      page.getByText("Pago parcial", { exact: true })
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Confirmada", { exact: true })).toHaveCount(0);

    const { data: updated } = await supabase
      .from("bookings")
      .select("status, payment_status, paid_amount")
      .eq("id", bookingId)
      .single();

    expect(updated).toMatchObject({
      status: "pending",
      payment_status: "partial",
      paid_amount: 4000,
    });
  });
});
