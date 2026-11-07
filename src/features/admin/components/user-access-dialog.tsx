"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Handshake, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GRANTABLE_ADMIN_SECTIONS } from "@/config/admin-sections.config";
import { apiJson } from "@/features/admin/partners/lib/partner-form";
import { PARTNERS_QUERY_KEY } from "@/features/admin/partners/components/partners-admin";
import { ADMIN_SECTION_ICONS } from "./admin-section-icons";
import { useI18n } from "@/components/lang/i18n-provider";
import { adminSectionLabel, adminSectionWarning } from "./admin-section-labels";

export interface AccessUser {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
  adminSections: string[];
  partner: { id: string; referralCode: string | null; status: string } | null;
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * One place for everything a user may open in the admin panel: full admin,
 * some admin pages, or being a referral partner (their own page). Ticking
 * "Referral partner" opens the partner form after saving (`onMakePartner`).
 * Following partners without being one is the Referrals page.
 */
export function UserAccessDialog({
  user,
  isSelf,
  onOpenChange,
  onMakePartner,
}: {
  user: AccessUser | null;
  isSelf: boolean;
  onOpenChange: (open: boolean) => void;
  onMakePartner: (user: AccessUser) => void;
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [full, setFull] = useState(false);
  const [sections, setSections] = useState<string[]>([]);
  const [makePartner, setMakePartner] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFull(user.isAdmin);
    setSections(user.adminSections ?? []);
    setMakePartner(false);
  }, [user]);

  if (!user) return null;
  const locked = isSelf;

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      const patch = (body: Record<string, unknown>) =>
        apiJson("/api/admin/users", { method: "PATCH", body: JSON.stringify(body) });
      if (!locked && full !== user.isAdmin) {
        await patch({ action: "set-admin", userId: user.id, isAdmin: full });
      }
      if (!locked && !sameSet(sections, user.adminSections ?? [])) {
        await patch({ action: "set-admin-sections", userId: user.id, sections });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: PARTNERS_QUERY_KEY });
      toast.success(t("adminDash.access.saved"));
      onOpenChange(false);
      if (makePartner) onMakePartner(user);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("adminDash.access.couldntSave"));
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(90dvh/var(--app-zoom,1))] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("adminDash.access.title")}</DialogTitle>
          <DialogDescription>
            {(() => {
              const [before, after = ""] = t("adminDash.access.desc").split("{name}");
              return (
                <>
                  {before}
                  <strong>{user.name || user.email}</strong>
                  {after}
                </>
              );
            })()}
            {locked && t("adminDash.access.selfLocked")}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-0.5 pb-1">
          {/* Full admin */}
          <label className="border-border flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1">
              <span className="text-foreground block text-sm font-medium">
                {t("adminDash.access.fullAdmin")}
              </span>
              <span className="text-muted-foreground block text-xs">
                {t("adminDash.access.fullAdminDesc")}
              </span>
            </span>
            <Switch checked={full} onCheckedChange={setFull} disabled={locked} />
          </label>

          {/* Admin pages */}
          <div className={full ? "opacity-50" : undefined}>
            <p className="text-foreground mb-1 text-sm font-medium">{t("adminDash.access.pages")}</p>
            <p className="text-muted-foreground mb-2 text-xs">
              {full ? t("adminDash.access.pagesAll") : t("adminDash.access.pagesOnly")}
            </p>
            <div className="space-y-1">
              {GRANTABLE_ADMIN_SECTIONS.map((section) => {
                const Icon = ADMIN_SECTION_ICONS[section.icon];
                const id = `access-${section.key}`;
                return (
                  <label
                    key={section.key}
                    htmlFor={id}
                    className="hover:bg-muted/50 flex min-h-11 cursor-pointer items-start gap-3 rounded-md px-2 py-2"
                  >
                    <Checkbox
                      id={id}
                      className="mt-0.5"
                      disabled={full || locked}
                      checked={sections.includes(section.key)}
                      onCheckedChange={(v) =>
                        setSections((list) =>
                          v === true
                            ? [...new Set([...list, section.key])]
                            : list.filter((k) => k !== section.key)
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span className="text-foreground flex items-center gap-1.5 text-sm">
                        <Icon className="h-3.5 w-3.5" />
                        {adminSectionLabel(t, section.key, section.label)}
                      </span>
                      {section.grantWarning && (
                        <span className="block text-xs text-amber-500">
                          {adminSectionWarning(t, section.key, section.grantWarning)}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Referral partner */}
          <div className="border-border rounded-lg border p-3">
            {user.partner ? (
              <div className="flex flex-wrap items-center gap-3">
                <Handshake className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="text-foreground min-w-0 flex-1 text-sm">
                  {t("adminDash.access.partner")}
                  {user.partner.referralCode ? ` · ${user.partner.referralCode}` : ""}
                </span>
                <Button variant="outline" size="sm" className="min-h-10" asChild>
                  <Link href={`/admin/partners/${user.partner.id}`}>
                    {t("adminDash.access.open")} <ExternalLink className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            ) : (
              <label className="flex min-h-10 cursor-pointer items-start gap-3">
                <Checkbox
                  className="mt-0.5"
                  checked={makePartner}
                  disabled={isSelf}
                  onCheckedChange={(v) => setMakePartner(v === true)}
                />
                <span className="min-w-0">
                  <span className="text-foreground flex items-center gap-1.5 text-sm font-medium">
                    <Handshake className="h-3.5 w-3.5 text-emerald-500" />
                    {t("adminDash.access.partner")}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {t("adminDash.access.partnerDesc")}
                  </span>
                </span>
              </label>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("adminDash.common.cancel")}
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {makePartner ? t("adminDash.access.saveAndDeal") : t("adminDash.common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
