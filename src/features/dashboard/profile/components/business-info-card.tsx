"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Plus } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { countryCodeFromName, countryDisplayName } from "@/lib/onboarding/markets";
import {
  EditBusinessInfoDialog,
  type EditBusinessInfoDialogBusiness,
} from "./edit-business-info-dialog";
import { useBusinessTimezone } from "../hooks/use-business-timezone";
import { formatTimezoneLabel } from "../lib/timezone-options";

interface BusinessInfoCardProps {
  /**
   * `timezone` is optional: the Profile pages' server-built profile doesn't
   * carry it yet, in which case the card fetches it (useBusinessTimezone).
   */
  business?: EditBusinessInfoDialogBusiness | null;
  userId: string;
  onUpdate?: () => void;
}

export function BusinessInfoCard({ business, userId, onUpdate }: BusinessInfoCardProps) {
  const { t, locale } = useI18n();
  const [editOpen, setEditOpen] = useState(false);
  const timezoneFromProfile = business?.timezone;
  const { data: fetchedTimezone } = useBusinessTimezone(
    business?.id,
    !!business && timezoneFromProfile === undefined
  );
  const timezone = timezoneFromProfile !== undefined ? timezoneFromProfile : fetchedTimezone;
  // Stable identity: the dialog must not see a "new" business on every render.
  const businessForDialog = useMemo<EditBusinessInfoDialogBusiness | null>(
    () => (business ? { ...business, timezone: timezone ?? undefined } : null),
    [business, timezone]
  );

  if (!business) {
    return (
      <>
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl font-bold">{t("profile.business.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-muted-foreground mb-4">{t("profile.business.noBusinessInfo")}</p>
              <Button onClick={() => setEditOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                {t("profile.business.addBusinessInfo")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <EditBusinessInfoDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          business={null}
          userId={userId}
          onUpdate={onUpdate}
        />
      </>
    );
  }

  // A recognised country reads in the UI language ("Indonésie"); other text as saved.
  const countryCode = countryCodeFromName(business.country);
  const countryLabel = countryCode
    ? countryDisplayName(countryCode, locale)
    : business.country || "—";

  const infoItems = [
    { label: t("profile.business.name"), value: business.name },
    { label: t("common.email"), value: business.email || "—" },
    { label: t("common.phone"), value: business.phone || "—" },
    { label: t("profile.business.website"), value: business.website || "—" },
    { label: t("profile.business.address"), value: business.address || "—" },
    { label: t("profile.business.city"), value: business.city || "—" },
    { label: t("profile.business.country"), value: countryLabel },
    {
      label: t("profile.business.timezone"),
      value: timezone ? formatTimezoneLabel(timezone) : "—",
    },
  ];

  return (
    <>
      <Card className="border-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-bold">{t("profile.business.title")}</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="h-9 w-9 gap-0 p-0 sm:h-auto sm:w-auto sm:gap-2 sm:px-3"
          >
            <Pencil className="h-4 w-4" />
            <span className="hidden sm:inline">{t("profile.actions.edit")}</span>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {infoItems.map((item, index) => (
              <div key={index} className="space-y-1">
                <p className="text-muted-foreground text-sm font-medium">{item.label}</p>
                <p className="text-base font-semibold break-words">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <EditBusinessInfoDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        business={businessForDialog}
        userId={userId}
        onUpdate={onUpdate}
      />
    </>
  );
}
