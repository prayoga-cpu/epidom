import { describe, it, expect, vi, beforeEach } from "vitest";
import { AlertType, AlertSeverity } from "@prisma/client";

// var (not const/let) avoids TDZ when vi.mock factories are hoisted above declarations.
var prismaMock: any;
var sendMerchantAlertMock: any;

vi.mock("@/lib/prisma", () => {
  prismaMock = {
    alert: { findFirst: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
    store: { findUnique: vi.fn() },
    material: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
  };
  return { prisma: prismaMock };
});

vi.mock("@/lib/magicbell/client", () => {
  sendMerchantAlertMock = vi.fn();
  return { sendMerchantAlert: sendMerchantAlertMock };
});

import { fireLowStockAlert, fireLowStockAlertsForEntities } from "../stock-alerts.helpers";

const baseParams = {
  userId: "user-1",
  storeId: "store-1",
  entityId: "mat-1",
  entityType: "material" as const,
  name: "Flour",
  newStock: 8,
  minStock: 20,
  unit: "kg",
};

// These assertions are the behavioural baseline lifted from
// src/__tests__/services/stock-deduction.test.ts, where this logic lived as a
// closure inside deductStockForOrder. Extracting it must not change a byte of
// what a merchant sees.
describe("fireLowStockAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.alert.findFirst.mockResolvedValue(null);
    prismaMock.alert.create.mockResolvedValue({});
    prismaMock.user.findUnique.mockResolvedValue({ email: "owner@example.com" });
  });

  it("does nothing when the item has no minimum configured", async () => {
    await fireLowStockAlert({ ...baseParams, minStock: 0, newStock: 0 });
    expect(prismaMock.alert.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.alert.create).not.toHaveBeenCalled();
  });

  it("does nothing while stock stays above the minimum", async () => {
    await fireLowStockAlert({ ...baseParams, newStock: 25 });
    expect(prismaMock.alert.create).not.toHaveBeenCalled();
  });

  it("creates a LOW_STOCK/WARNING alert below the minimum but above 25% of it", async () => {
    await fireLowStockAlert(baseParams); // 8 of min 20 — above the 5 critical line
    expect(prismaMock.alert.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: AlertType.LOW_STOCK,
        severity: AlertSeverity.WARNING,
        title: "Stok rendah: Flour",
        message: "Sisa stok Flour: 8.00 kg (min: 20 kg)",
        entityType: "material",
        entityId: "mat-1",
      },
    });
  });

  it("escalates to CRITICAL_STOCK at or below 25% of the minimum", async () => {
    await fireLowStockAlert({ ...baseParams, newStock: 5 }); // exactly 25% of 20
    expect(prismaMock.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: AlertType.CRITICAL_STOCK,
          severity: AlertSeverity.CRITICAL,
          title: "Stok kritis: Flour",
        }),
      })
    );
  });

  it("does not re-fire while an unread alert already exists for the entity", async () => {
    prismaMock.alert.findFirst.mockResolvedValue({ id: "existing-alert" });
    await fireLowStockAlert(baseParams);
    expect(prismaMock.alert.create).not.toHaveBeenCalled();
    expect(sendMerchantAlertMock).not.toHaveBeenCalled();
  });

  it("dedupes across both stock alert types, unread only", async () => {
    await fireLowStockAlert(baseParams);
    expect(prismaMock.alert.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        entityId: "mat-1",
        type: { in: [AlertType.LOW_STOCK, AlertType.CRITICAL_STOCK] },
        isRead: false,
      },
    });
  });

  it("notifies the store owner via MagicBell, deep-linking to the store's Data page", async () => {
    await fireLowStockAlert(baseParams);
    expect(sendMerchantAlertMock).toHaveBeenCalledWith({
      recipientEmail: "owner@example.com",
      recipientExternalId: "user-1",
      category: "low-stock",
      title: "Stok rendah: Flour",
      content: "Sisa stok: 8.00 kg (min: 20 kg)",
      actionUrl: "/store/store-1/data",
    });
  });

  it("still writes the Alert row when the owner account can't be resolved", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await fireLowStockAlert(baseParams);
    expect(prismaMock.alert.create).toHaveBeenCalled();
    expect(sendMerchantAlertMock).not.toHaveBeenCalled();
  });
});

describe("fireLowStockAlertsForEntities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.alert.findFirst.mockResolvedValue(null);
    prismaMock.alert.create.mockResolvedValue({});
    prismaMock.user.findUnique.mockResolvedValue({ email: "owner@example.com" });
    prismaMock.store.findUnique.mockResolvedValue({ business: { userId: "user-1" } });
    prismaMock.material.findMany.mockResolvedValue([]);
    prismaMock.product.findMany.mockResolvedValue([]);
  });

  it("short-circuits on an empty entity list", async () => {
    await fireLowStockAlertsForEntities("store-1", []);
    expect(prismaMock.store.findUnique).not.toHaveBeenCalled();
  });

  it("re-reads committed stock and alerts for the entities that crossed their minimum", async () => {
    prismaMock.material.findMany.mockResolvedValue([
      { id: "mat-1", name: "FARINE T55", currentStock: 1, minStock: 20, unit: "kg" },
      { id: "mat-2", name: "Sugar", currentStock: 90, minStock: 10, unit: "kg" },
    ]);

    await fireLowStockAlertsForEntities("store-1", [
      { entityId: "mat-1", entityType: "material" },
      { entityId: "mat-2", entityType: "material" },
    ]);

    expect(prismaMock.material.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: "store-1", id: { in: ["mat-1", "mat-2"] } } })
    );
    // Only the one under its minimum — mat-2 is comfortably stocked.
    expect(prismaMock.alert.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entityId: "mat-1", type: AlertType.CRITICAL_STOCK }),
      })
    );
  });

  it("looks materials and products up separately, in one query per kind", async () => {
    prismaMock.product.findMany.mockResolvedValue([
      { id: "prod-1", name: "Baguette", currentStock: 2, minStock: 12, unit: "piece" },
    ]);

    await fireLowStockAlertsForEntities("store-1", [
      { entityId: "mat-1", entityType: "material" },
      { entityId: "prod-1", entityType: "product" },
    ]);

    expect(prismaMock.material.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: "store-1", id: { in: ["mat-1"] } } })
    );
    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { storeId: "store-1", id: { in: ["prod-1"] } } })
    );
    expect(prismaMock.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entityId: "prod-1", entityType: "product" }),
      })
    );
  });

  it("resolves the alert recipient as the store's business owner", async () => {
    prismaMock.store.findUnique.mockResolvedValue({ business: { userId: "owner-9" } });
    prismaMock.material.findMany.mockResolvedValue([
      { id: "mat-1", name: "Flour", currentStock: 0, minStock: 5, unit: "kg" },
    ]);

    await fireLowStockAlertsForEntities("store-1", [
      { entityId: "mat-1", entityType: "material" },
    ]);

    expect(prismaMock.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "owner-9" }) })
    );
  });

  it("never throws — a failed alert must not surface on an already-committed stock write", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.store.findUnique.mockRejectedValue(new Error("db down"));

    await expect(
      fireLowStockAlertsForEntities("store-1", [{ entityId: "mat-1", entityType: "material" }])
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[stock-alerts]"),
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });
});
