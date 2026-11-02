import { describe, expect, it } from "vitest";
import { adminPathAllowed } from "@/lib/route-access";

describe("admin route access (outer wall)", () => {
  it("every signed-in role can open Business OS (pages check their own permission)", () => {
    for (const r of ["OWNER", "MANAGER", "CASHIER", "TECHNICIAN"]) expect(adminPathAllowed(r, "/admin/business-os/pos")).toBe(true);
  });
  it("store admin pages are for owner and manager only", () => {
    for (const path of ["/admin", "/admin/orders", "/admin/orders/SWD-1", "/admin/products", "/admin/coupons", "/admin/shipping", "/admin/suppliers", "/admin/payments", "/admin/fulfillment", "/admin/marketing", "/admin/analytics"]) {
      expect(adminPathAllowed("OWNER", path)).toBe(true);
      expect(adminPathAllowed("MANAGER", path)).toBe(true);
      expect(adminPathAllowed("CASHIER", path)).toBe(false);
      expect(adminPathAllowed("TECHNICIAN", path)).toBe(false);
    }
  });
  it("the old settings page (can add owner accounts) is owner-only", () => {
    expect(adminPathAllowed("OWNER", "/admin/settings")).toBe(true);
    expect(adminPathAllowed("MANAGER", "/admin/settings")).toBe(false);
  });
  it("unknown or missing roles get nothing but the login page", () => {
    expect(adminPathAllowed(null, "/admin/orders")).toBe(false);
    expect(adminPathAllowed("ROOT", "/admin/products")).toBe(false);
    expect(adminPathAllowed(undefined, "/admin/business-os")).toBe(false);
    expect(adminPathAllowed(undefined, "/admin/login")).toBe(true);
  });
  it("lookalike paths do not slip through", () => {
    expect(adminPathAllowed("CASHIER", "/admin/business-osx")).toBe(false);
    expect(adminPathAllowed("CASHIER", "/admin/settingsx")).toBe(false);
  });
});
