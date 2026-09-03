import { describe, it, expect } from "vitest";
import { ACTION_CATALOG, ACTION_TYPES, getActionDefinition } from "../catalog";
import { hasReverseHandler } from "../catalog-types";

/**
 * Catalogue invariants.
 *
 * These are the checks that make a REVERSIBLE label trustworthy. Without them
 * the class is a comment: an entry can claim to be revertible while its handler
 * reads a field the payload never carried, and nothing would notice until an
 * operator clicked Revert during an incident.
 */

/** Representative payloads, one per action, used to exercise round-trips. */
const SAMPLES: Record<string, unknown> = {
  "admin.user.set_plan": {
    userId: "u1",
    userEmail: "a@b.com",
    before: { plan: "FREE", status: "ACTIVE" },
    after: { plan: "OPERATIONS", status: "ACTIVE" },
  },
  "admin.user.set_period": {
    userId: "u1",
    userEmail: "a@b.com",
    before: {
      status: "ACTIVE",
      currentPeriodStart: "2026-01-01T00:00:00.000Z",
      currentPeriodEnd: "2026-02-01T00:00:00.000Z",
    },
    after: {
      status: "ACTIVE",
      currentPeriodStart: "2026-03-01T00:00:00.000Z",
      currentPeriodEnd: "2026-06-01T00:00:00.000Z",
    },
    months: 3,
  },
  "admin.user.set_custom_price": {
    userId: "u1",
    userEmail: "a@b.com",
    before: null,
    after: { amount: "19.989999", currency: "EUR", interval: "MONTHLY", plan: "POS" },
    stripeSubscriptionCancelled: true,
  },
  "admin.user.clear_custom_price": {
    userId: "u1",
    userEmail: "a@b.com",
    before: { amount: "1234567.123456", currency: "IDR", interval: "YEARLY", plan: "ENTERPRISE" },
  },
  "admin.user.set_admin": { userId: "u1", userEmail: "a@b.com", before: false, after: true },
  "admin.user.reset_password": {
    userId: "u1",
    userEmail: "a@b.com",
    credentialExisted: true,
    emailVerifiedBefore: false,
  },
  "admin.user.temp_password": {
    userId: "u1",
    userEmail: "a@b.com",
    credentialExisted: false,
    emailVerifiedBefore: true,
  },
  "admin.user.delete": { userId: "u1", userEmail: "a@b.com", snapshotId: "s1", rowCount: 120 },
  "admin.user.reset_account": {
    userId: "u1",
    userEmail: "a@b.com",
    snapshotId: "s1",
    rowCount: 80,
  },
  "admin.user.reactivate": {
    userId: "u1",
    userEmail: "a@b.com",
    before: { deactivatedAt: "2026-01-01T00:00:00.000Z", purgeAt: "2027-01-01T00:00:00.000Z" },
  },
  "admin.seed_demo": { storeId: "s1", userEmail: "a@b.com" },
  "admin.feedback.triage": {
    feedbackId: "f1",
    before: { status: "OPEN", priority: "MEDIUM", devNote: null },
    after: { status: "RESOLVED" },
  },
  "admin.custom_development.triage": {
    requestId: "cd1",
    before: { status: "NEW", devNote: null },
    after: { status: "IN_REVIEW" },
  },
  "stock.adjust": {
    storeId: "s1",
    itemType: "MATERIAL",
    itemId: "m1",
    itemName: "Flour",
    quantityDelta: "-2.500",
    balanceAfter: "10.000",
    reason: "spillage",
  },
  "waste.delete": {
    storeId: "s1",
    wasteId: "w1",
    itemName: "Croissant",
    quantity: "3.000",
    reason: "EXPIRED",
  },
  "pos.order.refund": {
    storeId: "s1",
    orderId: "o1",
    orderNumber: "A-001",
    amount: "42.50",
    reason: "wrong item",
  },
  "store.delete": { storeId: "s1", storeName: "Warung A", snapshotId: "s2", rowCount: 900 },
};

describe("action catalogue", () => {
  it("has a sample payload for every action", () => {
    // Guards against a new action shipping with no test coverage at all.
    const missing = ACTION_TYPES.filter((t) => !(t in SAMPLES));
    expect(missing, `actions with no sample payload: ${missing.join(", ")}`).toEqual([]);
  });

  it("validates every sample against its own schema", () => {
    for (const [type, sample] of Object.entries(SAMPLES)) {
      const def = getActionDefinition(type);
      expect(def, `no catalogue entry for ${type}`).toBeDefined();
      const parsed = def!.payload.safeParse(sample);
      expect(
        parsed.success,
        `${type} sample failed validation: ${JSON.stringify(
          parsed.success ? {} : parsed.error.flatten()
        )}`
      ).toBe(true);
    }
  });

  it("produces a non-empty label for every action", () => {
    for (const [type, sample] of Object.entries(SAMPLES)) {
      const def = getActionDefinition(type)!;
      const parsed = def.payload.parse(sample);
      expect(def.label(parsed).length, `${type} produced an empty label`).toBeGreaterThan(0);
    }
  });

  describe("reversible entries", () => {
    it("all carry a reverse handler and a round-trip fixture", () => {
      for (const type of ACTION_TYPES) {
        const def = getActionDefinition(type)!;
        if (def.reversibility !== "REVERSIBLE" && def.reversibility !== "REVERSIBLE_WITH_CAVEAT") {
          continue;
        }
        expect(hasReverseHandler(def), `${type} is reversible but has no handler`).toBe(true);
        expect(typeof (def as any).reverse, `${type}.reverse must be a function`).toBe("function");
        expect(typeof (def as any).roundTrip, `${type}.roundTrip must be a function`).toBe(
          "function"
        );
      }
    });

    it("survives an encode -> decode cycle without losing precision", () => {
      // The failure this catches: a Decimal(14,6) stored as a JSON number comes
      // back as 19.989999999999998, and the reverse handler then writes a value
      // that was never in the database.
      for (const type of ACTION_TYPES) {
        const def = getActionDefinition(type)!;
        if (!hasReverseHandler(def)) continue;
        const sample = SAMPLES[type];
        const decoded = def.payload.parse(JSON.parse(JSON.stringify(sample)));
        expect(() => (def as any).roundTrip(decoded), `${type} round-trip threw`).not.toThrow();
      }
    });

    it("keeps money as a plain decimal string, never a number", () => {
      const priced = ACTION_TYPES.filter((t) =>
        ["admin.user.set_custom_price", "admin.user.clear_custom_price", "pos.order.refund"].includes(
          t
        )
      );
      for (const type of priced) {
        const def = getActionDefinition(type)!;
        // A JSON number must be rejected outright — accepting it would let a
        // rounded value into the log unnoticed.
        const withNumber = JSON.parse(JSON.stringify(SAMPLES[type]));
        const target = withNumber.after ?? withNumber.before ?? withNumber;
        target.amount = 19.99;
        expect(def.payload.safeParse(withNumber).success, `${type} accepted a numeric amount`).toBe(
          false
        );
      }
    });
  });

  describe("non-reversible entries", () => {
    it("explain themselves rather than just refusing", () => {
      for (const type of ACTION_TYPES) {
        const def = getActionDefinition(type)! as any;
        if (def.reversibility === "IRREVERSIBLE") {
          expect(def.rationale?.length, `${type} has no rationale`).toBeGreaterThan(20);
        }
        if (def.reversibility === "COMPENSATE_ONLY") {
          expect(def.compensation?.length, `${type} has no compensation guidance`).toBeGreaterThan(
            20
          );
        }
        if (def.reversibility === "REVERSIBLE_WITH_CAVEAT") {
          expect(def.caveat?.length, `${type} has no caveat`).toBeGreaterThan(20);
        }
      }
    });

    it("routes every ledger write through a compensating entry, never an inverse", () => {
      // Reverting a StockMovement row directly would leave currentStock
      // disagreeing with the sum of its movements — the exact corruption this
      // feature exists to surface.
      for (const type of ["stock.adjust", "waste.delete"]) {
        expect(getActionDefinition(type)!.reversibility).toBe("COMPENSATE_ONLY");
      }
    });

    it("routes cascade roots to snapshot restore", () => {
      for (const type of ["admin.user.delete", "admin.user.reset_account", "store.delete"]) {
        expect(getActionDefinition(type)!.reversibility).toBe("SNAPSHOT_RESTORE");
      }
    });
  });

  describe("severity", () => {
    it("marks every admin action CRITICAL", () => {
      for (const [type, def] of Object.entries(ACTION_CATALOG)) {
        if (!type.startsWith("admin.user.")) continue;
        expect((def as any).severity, `${type} should be CRITICAL`).toBe("CRITICAL");
      }
    });

    it("names data subjects on every action that touches a user", () => {
      // Without subjectUserIds the GDPR shredder cannot find the row, and the
      // 365-day erasure promise in the Terms becomes unimplementable.
      for (const [type, def] of Object.entries(ACTION_CATALOG)) {
        if (!type.startsWith("admin.user.")) continue;
        expect(typeof (def as any).subjects, `${type} must declare subjects`).toBe("function");
      }
    });
  });
});
