import { prisma } from "@/lib/prisma";
import { getStorePlan } from "@/lib/plans/store-plan";
import { planHasFeature, PLAN_LABELS } from "@/lib/plans/entitlements";
import { getFinanceSettings } from "@/lib/services/finance-settings.service";
import { linkedStaffWhere } from "@/lib/auth/staff-link";

/** One store an account can reach, as the connector describes it. */
export interface ConnectorStore {
  storeId: string;
  name: string;
  city: string | null;
  country: string | null;
  businessName: string;
  timezone: string;
  /** "owner", or the linked staff role in lower case ("manager", ...). */
  role: string;
  plan: string;
  /** Whether the store's plan includes the Claude connector. */
  connectorEnabled: boolean;
  currency: string;
}

/**
 * Every store `userId` can reach: the ones its business owns, then the one
 * it is linked to as staff (an account is staff at one store at most). Used
 * by the list_stores tool and the consent screen, so both show the same list.
 */
export async function listConnectorStores(userId: string): Promise<ConnectorStore[]> {
  const [business, staff] = await Promise.all([
    prisma.business.findUnique({
      where: { userId },
      select: {
        name: true,
        timezone: true,
        stores: {
          select: { id: true, name: true, city: true, country: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.staffMember.findFirst({
      where: linkedStaffWhere(userId),
      select: {
        role: true,
        store: {
          select: {
            id: true,
            name: true,
            city: true,
            country: true,
            business: { select: { name: true, timezone: true } },
          },
        },
      },
    }),
  ]);

  const rows = (business?.stores ?? []).map((store) => ({
    storeId: store.id,
    name: store.name,
    city: store.city,
    country: store.country,
    businessName: business!.name,
    timezone: business!.timezone,
    role: "owner",
  }));
  if (staff && !rows.some((row) => row.storeId === staff.store.id)) {
    rows.push({
      storeId: staff.store.id,
      name: staff.store.name,
      city: staff.store.city,
      country: staff.store.country,
      businessName: staff.store.business.name,
      timezone: staff.store.business.timezone,
      role: staff.role.toLowerCase(),
    });
  }

  return Promise.all(
    rows.map(async (row) => {
      const [plan, finance] = await Promise.all([
        getStorePlan(row.storeId),
        getFinanceSettings(row.storeId),
      ]);
      return {
        ...row,
        plan: PLAN_LABELS[plan],
        connectorEnabled: planHasFeature(plan, "claudeConnector"),
        currency: finance.currency,
      };
    })
  );
}
