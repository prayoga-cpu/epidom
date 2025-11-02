"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { EditPersonalInfoDialog } from "./edit-personal-info-dialog";
import { useI18n } from "@/components/lang/i18n-provider";

interface PersonalInfoCardProps {
  user: {
    id: string;
    name?: string | null;
    email: string;
    phone?: string | null;
    locale: "en" | "fr" | "id" | undefined;
    timezone: string;
    currency: string;
  };
  onUpdate: () => void;
}

export function PersonalInfoCard({ user, onUpdate }: PersonalInfoCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const { t } = useI18n();

  const getLanguageLabel = (locale?: string) => {
    switch (locale) {
      case "en":
        return t("common.language.en") || "English";
      case "fr":
        return t("common.language.fr") || "Français";
      case "id":
        return t("common.language.id") || "Bahasa";
      default:
        return locale || "—";
    }
  };

  const infoItems = [
    { label: t("auth.name"), value: user.name || "—" },
    { label: t("auth.email"), value: user.email },
    { label: t("profile.personal.phone"), value: user.phone || "—" },
    { label: t("profile.personal.language"), value: getLanguageLabel(user.locale) },
    { label: t("profile.personal.timezone"), value: user.timezone || "—" },
    { label: t("profile.personal.currency"), value: user.currency || "—" },
  ];

  return (
    <>
      <Card className="border-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-bold">{t("profile.personal.title")}</CardTitle>
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
                <p className="text-base font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <EditPersonalInfoDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        user={user}
        onUpdate={onUpdate}
      />
    </>
  );
}
