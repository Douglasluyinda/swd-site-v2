import { describe, expect, it } from "vitest";
import { buildAlerts, type AlertCounts } from "@/lib/alerts";

const zero: AlertCounts = { lowStock: 0, cashPendingApproval: 0, cashLeftOpen: 0, poAwaitingApproval: 0, quotesWaiting: 0, repairsUncollected: 0, sopReviewsDue: 0 };

describe("alerts", () => {
  it("nothing to report means no alerts", () => expect(buildAlerts(zero, "OWNER")).toEqual([]));
  it("only shows alerts the role can act on, urgent first", () => {
    const c = { ...zero, lowStock: 2, cashPendingApproval: 1, poAwaitingApproval: 3, repairsUncollected: 1 };
    expect(buildAlerts(c, "OWNER").map((a) => a.key)).toEqual(["cashPendingApproval", "poAwaitingApproval", "lowStock", "repairsUncollected"]);
    expect(buildAlerts(c, "CASHIER").map((a) => a.key)).toEqual(["lowStock", "repairsUncollected"]); // no cash approvals/POs for cashiers
    expect(buildAlerts(c, "TECHNICIAN").map((a) => a.key)).toEqual(["lowStock"]);
    expect(buildAlerts(c, null)).toEqual([]);
  });
  it("wording is singular/plural correct", () => {
    expect(buildAlerts({ ...zero, lowStock: 1 }, "MANAGER")[0].text).toBe("1 product is at or below reorder level");
    expect(buildAlerts({ ...zero, lowStock: 4 }, "MANAGER")[0].text).toBe("4 products are at or below reorder level");
  });
});
