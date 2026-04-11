import { describe, it, expect } from "vitest";
import { parseSearchParams, filtersToSearchParams } from "../filters";

describe("parseSearchParams", () => {
  it("returns defaults when empty", () => {
    const f = parseSearchParams({});
    expect(f.tab).toBe("all");
    expect(f.q).toBe("");
    expect(f.locationId).toBeNull();
    expect(f.resourceId).toBeNull();
    expect(f.fromDate).toBeNull();
    expect(f.toDate).toBeNull();
    expect(f.hasAddOns).toBeNull();
    expect(f.page).toBe(1);
  });

  it("parses every valid tab", () => {
    for (const tab of [
      "all",
      "pending",
      "unpaid",
      "upcoming",
      "past_due",
      "archived",
    ] as const) {
      expect(parseSearchParams({ tab }).tab).toBe(tab);
    }
  });

  it("falls back to 'all' for unknown tab", () => {
    expect(parseSearchParams({ tab: "bogus" }).tab).toBe("all");
  });

  it("trims and keeps the omnibox query", () => {
    expect(parseSearchParams({ q: "  juan  " }).q).toBe("juan");
  });

  it("drops empty q to empty string", () => {
    expect(parseSearchParams({ q: "   " }).q).toBe("");
  });

  it("parses ISO dates and drops malformed ones", () => {
    expect(parseSearchParams({ from: "2026-04-01" }).fromDate).toBe(
      "2026-04-01"
    );
    expect(parseSearchParams({ from: "not-a-date" }).fromDate).toBeNull();
    expect(parseSearchParams({ to: "2026-12-31" }).toDate).toBe("2026-12-31");
  });

  it("parses has_add_ons tri-state", () => {
    expect(parseSearchParams({ has_add_ons: "1" }).hasAddOns).toBe(true);
    expect(parseSearchParams({ has_add_ons: "0" }).hasAddOns).toBe(false);
    expect(parseSearchParams({}).hasAddOns).toBeNull();
    expect(parseSearchParams({ has_add_ons: "bogus" }).hasAddOns).toBeNull();
  });

  it("parses a positive page and clamps invalid values to 1", () => {
    expect(parseSearchParams({ page: "3" }).page).toBe(3);
    expect(parseSearchParams({ page: "0" }).page).toBe(1);
    expect(parseSearchParams({ page: "-5" }).page).toBe(1);
    expect(parseSearchParams({ page: "abc" }).page).toBe(1);
  });

  it("accepts array values (Next's searchParams shape) and picks the first", () => {
    expect(parseSearchParams({ tab: ["pending", "unpaid"] }).tab).toBe(
      "pending"
    );
  });
});

describe("filtersToSearchParams", () => {
  it("omits default/empty values", () => {
    const qs = filtersToSearchParams({
      tab: "all",
      q: "",
      locationId: null,
      resourceId: null,
      fromDate: null,
      toDate: null,
      hasAddOns: null,
      page: 1,
    });
    expect(qs.toString()).toBe("");
  });

  it("serializes non-default values", () => {
    const qs = filtersToSearchParams({
      tab: "pending",
      q: "juan",
      locationId: "loc-1",
      resourceId: "res-2",
      fromDate: "2026-04-01",
      toDate: "2026-04-30",
      hasAddOns: true,
      page: 2,
    });
    expect(qs.get("tab")).toBe("pending");
    expect(qs.get("q")).toBe("juan");
    expect(qs.get("location")).toBe("loc-1");
    expect(qs.get("resource")).toBe("res-2");
    expect(qs.get("from")).toBe("2026-04-01");
    expect(qs.get("to")).toBe("2026-04-30");
    expect(qs.get("has_add_ons")).toBe("1");
    expect(qs.get("page")).toBe("2");
  });

  it("serializes has_add_ons=false as 0", () => {
    const qs = filtersToSearchParams({
      tab: "all",
      q: "",
      locationId: null,
      resourceId: null,
      fromDate: null,
      toDate: null,
      hasAddOns: false,
      page: 1,
    });
    expect(qs.get("has_add_ons")).toBe("0");
  });
});
