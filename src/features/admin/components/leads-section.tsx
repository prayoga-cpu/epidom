"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type SalesLead = {
  id: string;
  page: string;
  locale: string;
  source: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  createdAt: string;
};

export type NewsletterSub = {
  id: string;
  email: string;
  source: string;
  page: string | null;
  locale: string;
  createdAt: string;
};

type Tab = "leads" | "newsletter";

const fmt = (iso: string, locale: string) =>
  new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" });

export function LeadsSection({
  salesLeads,
  subscribers,
}: {
  salesLeads: SalesLead[];
  subscribers: NewsletterSub[];
}) {
  const [tab, setTab] = useState<Tab>("leads");
  const { t, intlLocale } = useI18n();

  if (salesLeads.length === 0 && subscribers.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">{t("adminPages.salesPages.leads.title")}</CardTitle>
          <div className="flex gap-1.5">
            <Button
              variant={tab === "leads" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("leads")}
              className="h-7 text-xs"
            >
              {t("adminPages.salesPages.leads.popupLeads")}
              {salesLeads.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {salesLeads.length}
                </Badge>
              )}
            </Button>
            <Button
              variant={tab === "newsletter" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("newsletter")}
              className="h-7 text-xs"
            >
              {t("adminPages.salesPages.leads.newsletter")}
              {subscribers.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                  {subscribers.length}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="overflow-x-auto pt-0">
        {tab === "leads" && (
          <>
            {salesLeads.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("adminPages.salesPages.leads.noLeads")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-muted-foreground py-2 pr-4 text-left font-medium">{t("adminPages.salesPages.leads.head.name")}</th>
                    <th className="text-muted-foreground py-2 pr-4 text-left font-medium">{t("adminPages.salesPages.leads.head.email")}</th>
                    <th className="text-muted-foreground py-2 pr-4 text-left font-medium">{t("adminPages.salesPages.leads.head.phone")}</th>
                    <th className="text-muted-foreground py-2 pr-4 text-left font-medium">{t("adminPages.salesPages.leads.head.page")}</th>
                    <th className="text-muted-foreground py-2 pr-4 text-left font-medium">{t("adminPages.salesPages.leads.head.source")}</th>
                    <th className="text-muted-foreground py-2 text-left font-medium">{t("adminPages.salesPages.leads.head.date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {salesLeads.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        {l.firstName} {l.lastName}
                      </td>
                      <td className="py-2 pr-4">{l.email}</td>
                      <td className="py-2 pr-4">{l.phone}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-xs">
                          {l.page}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground py-2 pr-4 text-xs">{l.source}</td>
                      <td className="text-muted-foreground py-2 text-xs">{fmt(l.createdAt, intlLocale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {tab === "newsletter" && (
          <>
            {subscribers.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("adminPages.salesPages.leads.noSubs")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-muted-foreground py-2 pr-4 text-left font-medium">{t("adminPages.salesPages.leads.head.email")}</th>
                    <th className="text-muted-foreground py-2 pr-4 text-left font-medium">{t("adminPages.salesPages.leads.head.source")}</th>
                    <th className="text-muted-foreground py-2 pr-4 text-left font-medium">{t("adminPages.salesPages.leads.head.page")}</th>
                    <th className="text-muted-foreground py-2 text-left font-medium">{t("adminPages.salesPages.leads.head.date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{s.email}</td>
                      <td className="text-muted-foreground py-2 pr-4 text-xs">{s.source}</td>
                      <td className="py-2 pr-4">
                        {s.page && (
                          <Badge variant="outline" className="text-xs">
                            {s.page}
                          </Badge>
                        )}
                      </td>
                      <td className="text-muted-foreground py-2 text-xs">{fmt(s.createdAt, intlLocale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
