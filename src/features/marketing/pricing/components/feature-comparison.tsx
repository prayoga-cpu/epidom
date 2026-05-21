"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { Check, Minus } from "lucide-react";
import { Container } from "@/features/marketing/shared/components/container";

type Availability = boolean | "text";

const ROWS: { key: string; free: Availability; pos: Availability; ops: Availability; enterprise: Availability }[] = [
  { key: "menuPage",       free: true,   pos: true,   ops: true,   enterprise: true   },
  { key: "qrisPayment",    free: true,   pos: true,   ops: true,   enterprise: true   },
  { key: "pointOfSale",    free: false,  pos: true,   ops: true,   enterprise: true   },
  { key: "kds",            free: false,  pos: true,   ops: true,   enterprise: true   },
  { key: "multiSite",      free: false,  pos: false,  ops: true,   enterprise: true   },
  { key: "staffShift",     free: false,  pos: false,  ops: true,   enterprise: true   },
  { key: "recipeCosting",  free: false,  pos: false,  ops: true,   enterprise: true   },
  { key: "stockAlerts",    free: false,  pos: false,  ops: true,   enterprise: true   },
  { key: "reports",        free: false,  pos: false,  ops: true,   enterprise: true   },
  { key: "support",        free: "text", pos: "text", ops: "text", enterprise: "text" },
];

const SUPPORT_KEYS = ["free", "starter", "pro", "enterprise"] as const;

function Cell({ value, textKey, t }: { value: Availability; textKey?: string; t: (k: string) => string }) {
  if (value === "text" && textKey) return <span className="text-xs font-medium text-brand-primary">{t(textKey)}</span>;
  if (value === true) return <Check className="text-green-500 mx-auto h-4 w-4" />;
  return <Minus className="text-neutral-300 mx-auto h-4 w-4" />;
}

export function FeatureComparison() {
  const { t } = useI18n();

  return (
    <section className="pb-12 md:pb-20 lg:pb-24">
      <Container maxWidth="7xl">
        <h2 className="text-brand-primary mb-8 text-center text-2xl font-bold tracking-tight md:text-4xl">
          {t("pricing.compare.title")}
        </h2>

        <div className="overflow-x-auto rounded-2xl border border-neutral-100 shadow-sm">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left">
                <th className="p-4 font-semibold text-brand-primary">
                  {t("pricing.compare.headers.feature")}
                </th>
                <th className="p-4 text-center font-semibold text-brand-primary/70">
                  {t("pricing.compare.headers.free")}
                </th>
                <th className="p-4 text-center font-semibold text-brand-primary/70">
                  {t("pricing.compare.headers.starter")}
                </th>
                <th className="p-4 text-center font-semibold text-white bg-brand-primary rounded-t-lg">
                  {t("pricing.compare.headers.pro")}
                </th>
                <th className="p-4 text-center font-semibold text-brand-primary/70">
                  {t("pricing.compare.headers.enterprise")}
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(({ key, free, pos, ops, enterprise }, i) => (
                <tr key={key} className={`border-t border-neutral-100 ${i % 2 === 0 ? "bg-white" : "bg-neutral-50/40"}`}>
                  <td className="p-4 font-medium text-brand-primary">
                    {t(`pricing.compare.rows.${key}.name`)}
                  </td>
                  <td className="p-4 text-center">
                    <Cell value={free} textKey={`pricing.compare.rows.support.free`} t={t} />
                  </td>
                  <td className="p-4 text-center">
                    <Cell value={pos} textKey={`pricing.compare.rows.support.starter`} t={t} />
                  </td>
                  <td className="p-4 text-center bg-brand-primary/5">
                    <Cell value={ops} textKey={`pricing.compare.rows.support.pro`} t={t} />
                  </td>
                  <td className="p-4 text-center">
                    <Cell value={enterprise} textKey={`pricing.compare.rows.support.enterprise`} t={t} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  );
}
