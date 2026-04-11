import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/**
 * These tests run with the pre-authenticated session from global.setup.ts
 * against the shared `e2e-studio` tenant. Each test seeds its own pending
 * and confirmed bookings with a unique per-test display name, so assertions
 * stay hermetic even when the DB has faker-seeded bookings alongside.
 */
test.describe("Bookings admin page", () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const TENANT_SLUG = "e2e-studio";

  let pendingBookingId: string;
  let confirmedBookingId: string;
  let pendingBookerName: string;
  let confirmedBookerName: string;
  let bookerIds: string[] = [];

  // Force Spanish locale (the proxy reads cookie first; Playwright's default
  // Accept-Language would otherwise serve the English dictionary).
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
      .eq("slug", TENANT_SLUG)
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
    if (!location || !resource)
      throw new Error("seeded location/resource missing");

    const suffix = `${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    pendingBookerName = `E2EPending-${suffix}`;
    confirmedBookerName = `E2EConfirmed-${suffix}`;

    const { data: booker1, error: b1Err } = await supabase
      .from("bookers")
      .insert({
        name: pendingBookerName,
        email: `e2e-pending-${suffix}@bukarrum.test`,
      })
      .select("id")
      .single();
    if (b1Err || !booker1) throw new Error(`seed booker1: ${b1Err?.message}`);
    bookerIds.push(booker1.id);

    const { data: booker2, error: b2Err } = await supabase
      .from("bookers")
      .insert({
        name: confirmedBookerName,
        email: `e2e-confirmed-${suffix}@bukarrum.test`,
      })
      .select("id")
      .single();
    if (b2Err || !booker2) throw new Error(`seed booker2: ${b2Err?.message}`);
    bookerIds.push(booker2.id);

    // Pending booking — next week, 10:00 local, 1h
    const pendingStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    pendingStart.setHours(10, 0, 0, 0);
    const pendingEnd = new Date(pendingStart.getTime() + 60 * 60 * 1000);

    const { data: pending, error: pErr } = await supabase
      .from("bookings")
      .insert({
        resource_id: resource.id,
        location_id: location.id,
        booker_id: booker1.id,
        start_time: pendingStart.toISOString(),
        end_time: pendingEnd.toISOString(),
        duration_hours: 1,
        total_price: 10000,
        status: "pending",
      })
      .select("id")
      .single();
    if (pErr || !pending) throw new Error(`seed pending: ${pErr?.message}`);
    pendingBookingId = pending.id;

    // Confirmed booking — next week+1d, 14:00 local, 2h
    const confirmedStart = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    confirmedStart.setHours(14, 0, 0, 0);
    const confirmedEnd = new Date(
      confirmedStart.getTime() + 2 * 60 * 60 * 1000
    );

    const { data: confirmed, error: cErr } = await supabase
      .from("bookings")
      .insert({
        resource_id: resource.id,
        location_id: location.id,
        booker_id: booker2.id,
        start_time: confirmedStart.toISOString(),
        end_time: confirmedEnd.toISOString(),
        duration_hours: 2,
        total_price: 20000,
        status: "confirmed",
      })
      .select("id")
      .single();
    if (cErr || !confirmed) throw new Error(`seed confirmed: ${cErr?.message}`);
    confirmedBookingId = confirmed.id;
  });

  test.afterEach(async () => {
    if (pendingBookingId)
      await supabase.from("bookings").delete().eq("id", pendingBookingId);
    if (confirmedBookingId)
      await supabase.from("bookings").delete().eq("id", confirmedBookingId);
    for (const id of bookerIds) {
      await supabase.from("bookers").delete().eq("id", id);
    }
    bookerIds = [];
  });

  test("renders header, omnibox, tabs, filter bar", async ({ page }) => {
    await page.goto(`/dashboard/${TENANT_SLUG}/bookings`);

    await expect(
      page.getByRole("heading", { level: 1, name: /reservas/i })
    ).toBeVisible();
    await expect(page.getByPlaceholder(/buscar por número/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /pendientes/i })).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
  });

  test("omnibox search surfaces our seeded pending booking", async ({
    page,
  }) => {
    await page.goto(`/dashboard/${TENANT_SLUG}/bookings`);
    await page
      .getByPlaceholder(/buscar por número/i)
      .fill(pendingBookerName);
    await page.waitForURL(new RegExp(`q=${pendingBookerName}`), {
      timeout: 5000,
    });
    await expect(page.getByText(pendingBookerName)).toBeVisible();
    // The confirmed booking should not appear when searching for the
    // pending booker's unique name.
    await expect(page.getByText(confirmedBookerName)).toHaveCount(0);
  });

  test("'Pendientes' tab narrows to pending bookings only", async ({
    page,
  }) => {
    await page.goto(`/dashboard/${TENANT_SLUG}/bookings?tab=pending`);
    // Our seeded pending row is visible; our seeded confirmed row is not.
    await expect(page.getByText(pendingBookerName)).toBeVisible();
    await expect(page.getByText(confirmedBookerName)).toHaveCount(0);
  });

  test("clicking a row navigates to the detail page", async ({ page }) => {
    // Search so we know exactly which row is at the top.
    await page.goto(
      `/dashboard/${TENANT_SLUG}/bookings?q=${confirmedBookerName}`
    );
    await expect(page.getByText(confirmedBookerName)).toBeVisible();

    await page
      .getByRole("link", { name: /#\d+/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/bookings\/[a-f0-9-]+$/);
    await expect(page.locator("h1")).toContainText("#");
  });

  test("empty state renders when filters match nothing", async ({ page }) => {
    await page.goto(`/dashboard/${TENANT_SLUG}/bookings`);
    await page
      .getByPlaceholder(/buscar por número/i)
      .fill("zzzz-nonexistent-xyz-query");
    await expect(
      page.getByText(/no hay reservas que coincidan/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test("bulk confirm flips our pending booking to confirmed", async ({
    page,
  }) => {
    // Scope the list to our seeded pending row so the checkbox we click is
    // guaranteed to be the one we own.
    await page.goto(
      `/dashboard/${TENANT_SLUG}/bookings?q=${pendingBookerName}&tab=pending`
    );
    const row = page.getByRole("row", {
      name: new RegExp(pendingBookerName),
    });
    await expect(row).toBeVisible();
    await row.getByRole("checkbox").click();

    await expect(page.getByText(/seleccionadas?/i)).toBeVisible();
    const confirmBtn = page.getByRole("button", { name: /^confirmar$/i });
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // DB is the source of truth — verify the status flipped.
    await expect
      .poll(
        async () => {
          const { data } = await supabase
            .from("bookings")
            .select("status")
            .eq("id", pendingBookingId)
            .single();
          return data?.status;
        },
        { timeout: 5000 }
      )
      .toBe("confirmed");
  });

  test("detail page shows quick actions and timeline", async ({ page }) => {
    await page.goto(
      `/dashboard/${TENANT_SLUG}/bookings/${confirmedBookingId}`
    );

    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("h1")).toContainText("#");
    // Quick action rail — the overflow menu trigger is always present
    // and carries the aria-label "Más acciones".
    await expect(
      page.getByRole("button", { name: /más acciones/i })
    ).toBeVisible();
    // Activity timeline: the "Reserva creada" entry is always rendered
    // (inferred from created_at).
    await expect(page.getByText(/reserva creada/i)).toBeVisible();
  });
});
