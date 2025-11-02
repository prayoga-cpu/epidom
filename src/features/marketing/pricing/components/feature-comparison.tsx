"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Check } from "lucide-react";

export function FeatureComparison() {
  const { t } = useI18n();

  return (
    <section className="pb-12 md:pb-20 lg:pb-24">
      <div className="mx-auto max-w-7xl px-6 md:px-8 lg:px-8">
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight md:mb-8 md:text-4xl">
          {t("pricing.compare.title")}
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr className="text-left">
                <th className="p-3 font-semibold md:p-4">{t("pricing.compare.headers.feature")}</th>
                <th className="p-3 text-center font-semibold md:p-4">
                  {t("pricing.compare.headers.starter")}
                </th>
                <th
                  className="border-l-2 p-3 text-center font-semibold md:p-4"
                  style={{ borderLeftColor: "var(--color-brand-primary)" }}
                >
                  {t("pricing.compare.headers.pro")}
                </th>
                <th className="p-3 text-center font-semibold md:p-4">
                  {t("pricing.compare.headers.enterprise")}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-muted/30 border-t">
                <td className="p-3 md:p-4">{t("pricing.compare.rows.pointOfSale.name")}</td>
                <td className="p-3 text-center md:p-4">
                  <Check className="text-primary mx-auto h-4 w-4 md:h-5 md:w-5" />
                </td>
                <td
                  className="border-l-2 p-3 text-center md:p-4"
                  style={{ borderLeftColor: "var(--color-brand-primary)" }}
                >
                  <Check className="text-primary mx-auto h-4 w-4 md:h-5 md:w-5" />
                </td>
                <td className="p-3 text-center md:p-4">
                  <Check className="text-primary mx-auto h-4 w-4 md:h-5 md:w-5" />
                </td>
              </tr>
              <tr className="hover:bg-muted/30 border-t">
                <td className="p-3 md:p-4">{t("pricing.compare.rows.multiSite.name")}</td>
                <td className="p-3 text-center md:p-4">—</td>
                <td
                  className="border-l-2 p-3 text-center md:p-4"
                  style={{ borderLeftColor: "var(--color-brand-primary)" }}
                >
                  <Check className="text-primary mx-auto h-4 w-4 md:h-5 md:w-5" />
                </td>
                <td className="p-3 text-center md:p-4">
                  <Check className="text-primary mx-auto h-4 w-4 md:h-5 md:w-5" />
                </td>
              </tr>
              <tr className="hover:bg-muted/30 border-t">
                <td className="p-3 md:p-4">{t("pricing.compare.rows.supplierManagement.name")}</td>
                <td className="p-3 text-center md:p-4">
                  <Check className="text-primary mx-auto h-4 w-4 md:h-5 md:w-5" />
                </td>
                <td
                  className="border-l-2 p-3 text-center md:p-4"
                  style={{ borderLeftColor: "var(--color-brand-primary)" }}
                >
                  <Check className="text-primary mx-auto h-4 w-4 md:h-5 md:w-5" />
                </td>
                <td className="p-3 text-center md:p-4">
                  <Check className="text-primary mx-auto h-4 w-4 md:h-5 md:w-5" />
                </td>
              </tr>
              <tr className="hover:bg-muted/30 border-t">
                <td className="p-3 md:p-4">{t("pricing.compare.rows.reports.name")}</td>
                <td className="p-3 text-center md:p-4">—</td>
                <td
                  className="border-l-2 p-3 text-center md:p-4"
                  style={{ borderLeftColor: "var(--color-brand-primary)" }}
                >
                  <Check className="text-primary mx-auto h-4 w-4 md:h-5 md:w-5" />
                </td>
                <td className="p-3 text-center md:p-4">
                  <Check className="text-primary mx-auto h-4 w-4 md:h-5 md:w-5" />
                </td>
              </tr>
              <tr className="hover:bg-muted/30 border-t">
                <td className="p-3 md:p-4">{t("pricing.compare.rows.support.name")}</td>
                <td className="p-3 text-center md:p-4">
                  {t("pricing.compare.rows.support.starter")}
                </td>
                <td
                  className="border-l-2 p-3 text-center md:p-4"
                  style={{ borderLeftColor: "var(--color-brand-primary)" }}
                >
                  {t("pricing.compare.rows.support.pro")}
                </td>
                <td className="p-3 text-center md:p-4">
                  {t("pricing.compare.rows.support.enterprise")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
