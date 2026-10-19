"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Eye, Handshake, Loader2, ShieldCheck, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GRANTABLE_ADMIN_SECTIONS } from "@/config/admin-sections.config";
import type { PartnerListRow } from "@/lib/services/partner.service";
import { apiJson } from "@/features/admin/partners/lib/partner-form";
import { PARTNERS_QUERY_KEY } from "@/features/admin/partners/components/partners-admin";
import { ADMIN_SECTION_ICONS } from "./admin-section-icons";

export interface AccessUser {
  id: string;
  name: string | null;
  email: string;
  isAdmin: boolean;
  adminSections: string[];
  partner: { id: string; referralCode: string | null; status: string } | null;
  partnerViews?: { partner: { id: string; displayName: string } }[];
}

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/**
 * One place for everything a user may open in the admin panel: full admin,
 * some admin pages, being a referral partner (their own page), or seeing a
 * partner's page read-only. Ticking "Referral partner" opens the partner form
 * after saving (`onMakePartner`).
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
  const queryClient = useQueryClient();
  const [full, setFull] = useState(false);
  const [sections, setSections] = useState<string[]>([]);
  const [makePartner, setMakePartner] = useState(false);
  const [views, setViews] = useState<{ id: string; displayName: string }[]>([]);
  const [addView, setAddView] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFull(user.isAdmin);
    setSections(user.adminSections ?? []);
    setMakePartner(false);
    setViews((user.partnerViews ?? []).map((v) => v.partner));
    setAddView("");
  }, [user]);

  const { data: partnersData } = useQuery<{ partners: PartnerListRow[] }>({
    queryKey: PARTNERS_QUERY_KEY,
    queryFn: () => apiJson("/api/admin/partners"),
    enabled: Boolean(user),
  });
  const viewable = useMemo(
    () =>
      (partnersData?.partners ?? []).filter(
        (p) => p.id !== user?.partner?.id && !views.some((v) => v.id === p.id)
      ),
    [partnersData, user, views]
  );

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
      const before = (user.partnerViews ?? []).map((v) => v.partner.id);
      for (const v of views.filter((v) => !before.includes(v.id))) {
        await apiJson(`/api/admin/partners/${v.id}/viewers`, {
          method: "POST",
          body: JSON.stringify({ email: user.email }),
        });
      }
      for (const id of before.filter((id) => !views.some((v) => v.id === id))) {
        await apiJson(`/api/admin/partners/${id}/viewers/${user.id}`, { method: "DELETE" });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: PARTNERS_QUERY_KEY });
      toast.success("Access saved");
      onOpenChange(false);
      if (makePartner) onMakePartner(user);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(user)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(90dvh/var(--app-zoom,1))] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>Access</DialogTitle>
          <DialogDescription>
            What <strong>{user.name || user.email}</strong> can open in the admin panel.
            {locked && " You can't change your own admin access."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-0.5 pb-1">
          {/* Full admin */}
          <label className="border-border flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1">
              <span className="text-foreground block text-sm font-medium">Full admin</span>
              <span className="text-muted-foreground block text-xs">
                Every admin page, the users list and the activity log.
              </span>
            </span>
            <Switch checked={full} onCheckedChange={setFull} disabled={locked} />
          </label>

          {/* Admin pages */}
          <div className={full ? "opacity-50" : undefined}>
            <p className="text-foreground mb-1 text-sm font-medium">Admin pages</p>
            <p className="text-muted-foreground mb-2 text-xs">
              {full
                ? "A full admin opens them all."
                : "Only these pages, nothing else of the admin panel."}
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
                        {section.label}
                      </span>
                      {section.grantWarning && (
                        <span className="block text-xs text-amber-500">{section.grantWarning}</span>
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
                  Referral partner
                  {user.partner.referralCode ? ` · ${user.partner.referralCode}` : ""}
                </span>
                <Button variant="outline" size="sm" className="min-h-10" asChild>
                  <Link href={`/admin/partners/${user.partner.id}`}>
                    Open <ExternalLink className="ml-1 h-3.5 w-3.5" />
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
                    Referral partner
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    Their own page with their link (or sales page), its report and their commission.
                    You&apos;ll set the deal next.
                  </span>
                </span>
              </label>
            )}
          </div>

          {/* Views of a partner's page */}
          <div>
            <p className="text-foreground mb-1 flex items-center gap-1.5 text-sm font-medium">
              <Eye className="h-3.5 w-3.5 text-sky-500" />
              Sees a partner&apos;s page (read-only)
            </p>
            <p className="text-muted-foreground mb-2 text-xs">
              Exactly what that partner sees. They change nothing and earn nothing.
            </p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {views.map((v) => (
                <span
                  key={v.id}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 py-0.5 pr-0.5 pl-2.5 text-xs text-sky-500"
                >
                  {v.displayName}
                  <button
                    type="button"
                    aria-label={`Stop seeing ${v.displayName}'s page`}
                    className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-sky-500/15"
                    onClick={() => setViews((list) => list.filter((x) => x.id !== v.id))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
            {viewable.length > 0 && (
              <Select
                value={addView}
                onValueChange={(id) => {
                  const p = viewable.find((x) => x.id === id);
                  if (p) setViews((list) => [...list, { id: p.id, displayName: p.displayName }]);
                  setAddView("");
                }}
              >
                <SelectTrigger className="min-h-10 w-full">
                  <SelectValue placeholder="Add a partner's page…" />
                </SelectTrigger>
                <SelectContent>
                  {viewable.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {makePartner ? "Save and set the deal" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
