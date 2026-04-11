import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildBookingsQuery, buildCountsQuery, ROW_SELECT } from "../queries";
import type { BookingsFilters } from "../types";

type Spy = ReturnType<typeof vi.fn>;

type MockChain = {
  select: Spy;
  eq: Spy;
  in: Spy;
  gte: Spy;
  lte: Spy;
  lt: Spy;
  or: Spy;
  order: Spy;
  range: Spy;
  then: Spy;
};

function makeChain(): MockChain {
  const chain = {} as MockChain;
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.in = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.lt = vi.fn(self);
  chain.or = vi.fn(self);
  chain.order = vi.fn(self);
  chain.range = vi.fn(self);
  // Make the chain thenable so `await` on the builder resolves to a standard result.
  chain.then = vi.fn((resolve: (v: unknown) => void) =>
    resolve({ data: [], count: 0, error: null })
  );
  return chain;
}

function makeClient() {
  const chain = makeChain();
  const from = vi.fn(() => chain);
  // RPC returns a thenable resolving to `{ data, error }` — search_bookings
  // yields rows of IDs, search_bookings_count yields a bigint.
  const rpc = vi.fn((name: string) => ({
    then: (resolve: (v: unknown) => void) => {
      if (name === "search_bookings") {
        resolve({ data: [], error: null });
      } else if (name === "search_bookings_count") {
        resolve({ data: 0, error: null });
      } else {
        resolve({ data: null, error: null });
      }
    },
  }));
  return { from, rpc, chain };
}

const TENANT_ID = "tenant-123";

function baseFilters(overrides: Partial<BookingsFilters> = {}): BookingsFilters {
  return {
    tab: "all",
    q: "",
    locationId: null,
    resourceId: null,
    fromDate: null,
    toDate: null,
    hasAddOns: null,
    page: 1,
    ...overrides,
  };
}

describe("buildBookingsQuery", () => {
  let client: ReturnType<typeof makeClient>;

  beforeEach(() => {
    client = makeClient();
  });

  it("selects from bookings with the ROW_SELECT shape", async () => {
    await buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters(),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.from).toHaveBeenCalledWith("bookings");
    expect(client.chain.select).toHaveBeenCalledWith(
      ROW_SELECT,
      expect.objectContaining({ count: "exact" })
    );
  });

  it("always applies the tenant-isolation filter on the joined resource", async () => {
    await buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters(),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.eq).toHaveBeenCalledWith("resource.tenant_id", TENANT_ID);
  });

  it("'pending' tab narrows status", async () => {
    await buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ tab: "pending" }),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.eq).toHaveBeenCalledWith("status", "pending");
  });

  it("'unpaid' tab narrows to confirmed + unpaid/partial", async () => {
    await buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ tab: "unpaid" }),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.eq).toHaveBeenCalledWith("status", "confirmed");
    expect(client.chain.in).toHaveBeenCalledWith("payment_status", [
      "unpaid",
      "partial",
    ]);
  });

  it("'upcoming' tab applies start_time bounds of [now, now+7d]", async () => {
    const now = new Date("2026-04-10T12:00:00Z");
    await buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ tab: "upcoming" }),
      now
    );
    expect(client.chain.eq).toHaveBeenCalledWith("status", "confirmed");
    expect(client.chain.gte).toHaveBeenCalledWith(
      "start_time",
      now.toISOString()
    );
    const expectedEnd = new Date(now);
    expectedEnd.setUTCDate(expectedEnd.getUTCDate() + 7);
    expect(client.chain.lte).toHaveBeenCalledWith(
      "start_time",
      expectedEnd.toISOString()
    );
  });

  it("'past_due' tab applies start_time < now on confirmed", async () => {
    const now = new Date("2026-04-10T12:00:00Z");
    await buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ tab: "past_due" }),
      now
    );
    expect(client.chain.eq).toHaveBeenCalledWith("status", "confirmed");
    expect(client.chain.lt).toHaveBeenCalledWith(
      "start_time",
      now.toISOString()
    );
  });

  it("'archived' tab narrows to completed/cancelled/no_show", async () => {
    await buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ tab: "archived" }),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.in).toHaveBeenCalledWith("status", [
      "completed",
      "cancelled",
      "no_show",
    ]);
  });

  it("applies location/resource/has_add_ons filters when present", async () => {
    await buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({
        locationId: "loc-1",
        resourceId: "res-1",
        hasAddOns: true,
      }),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.eq).toHaveBeenCalledWith("location_id", "loc-1");
    expect(client.chain.eq).toHaveBeenCalledWith("resource_id", "res-1");
    expect(client.chain.eq).toHaveBeenCalledWith("has_add_ons", true);
  });

  it("applies has_add_ons=false when hasAddOns is false", async () => {
    await buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ hasAddOns: false }),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.eq).toHaveBeenCalledWith("has_add_ons", false);
  });

  it("orders by start_time desc and paginates with range(0, 49) on page 1", async () => {
    await buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters(),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.order).toHaveBeenCalledWith("start_time", {
      ascending: false,
    });
    expect(client.chain.range).toHaveBeenCalledWith(0, 49);
  });

  it("paginates with range(100, 149) on page 3", async () => {
    await buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ page: 3 }),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.chain.range).toHaveBeenCalledWith(100, 149);
  });

  it("delegates to search_bookings RPC when q is present", async () => {
    await buildBookingsQuery(
      client as never,
      TENANT_ID,
      baseFilters({ q: "juan", tab: "pending" }),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(client.rpc).toHaveBeenCalledWith(
      "search_bookings",
      expect.objectContaining({
        p_tenant_id: TENANT_ID,
        p_query: "juan",
        p_tab: "pending",
      })
    );
    expect(client.rpc).toHaveBeenCalledWith(
      "search_bookings_count",
      expect.objectContaining({
        p_tenant_id: TENANT_ID,
        p_query: "juan",
        p_tab: "pending",
      })
    );
    // Search branch skips the table query builder when the RPC returns zero
    // matches (our mock) — no rehydration round-trip needed.
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("buildCountsQuery", () => {
  it("returns 6 promises, one per tab", () => {
    const client = makeClient();
    const promises = buildCountsQuery(
      client as never,
      TENANT_ID,
      baseFilters(),
      new Date("2026-04-10T12:00:00Z")
    );
    expect(Object.keys(promises).sort()).toEqual(
      ["all", "archived", "past_due", "pending", "unpaid", "upcoming"].sort()
    );
  });

  it("each count query applies non-tab filters (location, resource, dates, has_add_ons, q)", () => {
    const client = makeClient();
    buildCountsQuery(
      client as never,
      TENANT_ID,
      baseFilters({
        locationId: "loc-1",
        resourceId: "res-1",
        fromDate: "2026-04-01",
        toDate: "2026-04-30",
        hasAddOns: true,
        q: "juan",
      }),
      new Date("2026-04-10T12:00:00Z")
    );
    // Every count query should use the search RPC when q is present
    expect(client.rpc).toHaveBeenCalledWith(
      "search_bookings_count",
      expect.objectContaining({
        p_tenant_id: TENANT_ID,
        p_query: "juan",
        p_location_id: "loc-1",
        p_resource_id: "res-1",
        p_has_add_ons: true,
      })
    );
  });
});
