"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Plus } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { EditBusinessInfoDialog } from "./edit-business-info-dialog";

interface BusinessInfoCardProps {
  business?: {
    id: string;
    name: string;
    address?: string | null;
    city?: string | null;
    country?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  } | null;
  userId: string;
  onUpdate: () => void;
}

export function BusinessInfoCard({ business, userId, onUpdate }: BusinessInfoCardProps) {
  const { t } = useI18n();
  const [editOpen, setEditOpen] = useState(false);

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

  const infoItems = [
    { label: t("profile.business.name"), value: business.name },
    { label: t("common.email"), value: business.email || "—" },
    { label: t("common.phone"), value: business.phone || "—" },
    { label: t("profile.business.website"), value: business.website || "—" },
    { label: t("profile.business.address"), value: business.address || "—" },
    { label: t("profile.business.city"), value: business.city || "—" },
    { label: t("profile.business.country"), value: business.country || "—" },
  ];

  return (
    <>
      <Card className="border-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-bold">{t("profile.business.title")}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2">
            <Pencil className="h-4 w-4" />
            {t("profile.actions.edit")}
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
        business={business}
        userId={userId}
        onUpdate={onUpdate}
      />
    </>
  );
}
