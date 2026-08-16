"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { getAllDashboardNavItems } from "@/config/navigation.config";

interface AccountAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actingAsStaff: boolean;
  name: string | null;
  role: string | null;
  /** null = unrestricted (the real account owner) — every page is implicitly allowed. */
  allowedPages: string[] | null;
}

/**
 * Read-only "who am I, and what can I see right now" — replaces the old
 * Clock In/Out dropdown item (clock-in/out moved to the Schedule page
 * itself). A dialog rather than a page section on purpose: /profile is
 * hard-gated owner-only (requireOwnerOnly), so a staff persona could never
 * actually reach a card placed there — this needs to work for both.
 */
export function AccountAccessDialog({
  open,
  onOpenChange,
  actingAsStaff,
  name,
  role,
  allowedPages,
}: AccountAccessDialogProps) {
  const { t } = useI18n();
  const navItems = getAllDashboardNavItems();
  const pages = allowedPages ?? navItems.map((item) => item.href);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(90dvh/var(--app-zoom,1))] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("nav.accountAccess")}</DialogTitle>
          <DialogDescription>{t("pages.accountAccessDesc")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{name ?? "—"}</p>
            <p className="text-muted-foreground text-xs">
              {actingAsStaff ? t("pages.accountAccessStaffLabel") : t("pages.accountAccessOwnerLabel")}
            </p>
          </div>
          <Badge variant={actingAsStaff ? "secondary" : "default"}>{role ?? "—"}</Badge>
        </div>

        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {t("pages.accountAccessPagesLabel")}
          </p>
          <div className="space-y-1">
            {navItems
              .filter((item) => pages.includes(item.href))
              .map((item) => (
                <div key={item.href} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="text-primary h-3.5 w-3.5 shrink-0" />
                  {t(item.labelKey)}
                </div>
              ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
