"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { dashboardNavigation, posModeNavItems, grantableOnlyNavItems } from "@/config/navigation.config";
import { ROLE_DEFAULT_PAGES } from "@/config/staff-permissions.config";
import { staffRoleLabel } from "@/features/dashboard/shared/lib/staff-role-label";
import type { StaffRole } from "@prisma/client";

// Profile, Billing, and Staff management are owner-only (see
// requireOwnerOnly) — granting them here would be a no-op at best, so they
// never appear as options.
const OWNER_ONLY_PAGES = new Set(["/profile", "/billing", "/staff"]);

// Two top-level systems, matching the POS Mode / Back Office shell split
// this whole app is built around (docs/dashboard-revamp.md,
// docs/back-office-revamp.md) — a staff member's access is fundamentally a
// question of "which shell(s) can they open," with individual pages as the
// detail underneath that, not the other way around.
const BACK_OFFICE_SECTIONS = dashboardNavigation
  .map((section) => ({
    ...section,
    items: section.items.filter((item) => !OWNER_ONLY_PAGES.has(item.href)),
  }))
  .filter((section) => section.items.length > 0)
  // grantableOnlyNavItems (/menu) isn't part of dashboardNavigation (it's
  // reachable through Storefront's tab, not its own rail entry — see that
  // export's doc comment) but it's still a Back Office page an owner can
  // grant/revoke independently of Storefront itself.
  .concat([{ title: "Other", items: grantableOnlyNavItems }]);

// posModeNavItems isn't part of dashboardNavigation either (it renders in
// the (pos-mode) shell's own tab bar — see that export's doc comment), so
// it needs its own top-level group rather than folding into the Back
// Office list above.
const POS_SECTION = { title: null as string | null, items: posModeNavItems };

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((href) => s.has(href));
}

interface PageAccessChecklistProps {
  role: StaffRole;
  value: string[];
  onChange: (pages: string[]) => void;
  /** Overrides ROLE_DEFAULT_PAGES[role] as the "template" to compare/reset
   * against — needed for a job title like Bartender (staff-client.tsx's
   * CASHIER_JOB_TEMPLATES), which is still StaffRole.CASHIER underneath but
   * grants a different page set than bare Cashier. Without this, that page
   * set would look "already customized" the moment it's picked, and
   * "Reset to role defaults" would silently drop it back to bare Cashier. */
  templatePages?: string[];
  /** Display name for templatePages in the summary hint (e.g. "Bartender")
   * — falls back to the plain role label (e.g. "Cashier") when omitted. */
  templateLabel?: string;
}

/**
 * Per-staff page access. Defaults to a read-only summary of the selected
 * role's template (Cashier/Kitchen/Manager/…) grouped by POS vs. Back
 * Office — an owner assigning a standard role never needs to see a
 * checkbox grid at all. "Customize access" reveals the same two groups as
 * an editable checklist, for the narrower case of widening or trimming one
 * staff member's access beyond their role's usual pages.
 */
export function PageAccessChecklist({
  role,
  value,
  onChange,
  templatePages: templatePagesProp,
  templateLabel,
}: PageAccessChecklistProps) {
  const { t } = useI18n();
  const templatePages = templatePagesProp ?? ROLE_DEFAULT_PAGES[role] ?? [];
  const [showCustom, setShowCustom] = useState(() => !sameSet(value, templatePages));

  // Switching the role dropdown, or the job-title template within it,
  // already resets `value` to that template (see staff-client.tsx) —
  // collapse back to the template summary for it too, rather than leaving a
  // stale "customized" checklist open against a template it no longer
  // describes.
  const templateKey = `${role}:${templatePages.join(",")}`;
  const prevTemplateKey = useRef(templateKey);
  useEffect(() => {
    if (prevTemplateKey.current !== templateKey) {
      prevTemplateKey.current = templateKey;
      setShowCustom(false);
    }
  }, [templateKey]);

  const toggle = (href: string, checked: boolean) => {
    onChange(checked ? [...value, href] : value.filter((p) => p !== href));
  };

  const renderEditableGroup = (
    sections: { title?: string | null; items: typeof posModeNavItems }[]
  ) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {sections.map((section, i) => (
        <div key={section.title ?? i} className="space-y-1.5">
          {section.title && (
            <p className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
              {section.title}
            </p>
          )}
          {section.items.map((item) => (
            <label
              key={item.href}
              className="flex cursor-pointer items-center gap-2 text-sm select-none"
            >
              <input
                type="checkbox"
                className="rounded"
                checked={value.includes(item.href)}
                onChange={(e) => toggle(item.href, e.target.checked)}
              />
              {t(item.labelKey)}
            </label>
          ))}
        </div>
      ))}
    </div>
  );

  const renderSummaryGroup = (items: typeof posModeNavItems) => {
    const granted = items.filter((item) => templatePages.includes(item.href));
    if (granted.length === 0) return null;
    return (
      <div className="space-y-1">
        {granted.map((item) => (
          <div key={item.href} className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="text-primary h-3.5 w-3.5 shrink-0" />
            {t(item.labelKey)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-semibold">{t("pages.staffAccessTitle")}</p>
        {showCustom && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onChange(templatePages)}
          >
            {t("pages.staffResetToRoleDefaults")}
          </Button>
        )}
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm select-none">
        <input
          type="checkbox"
          className="rounded"
          checked={showCustom}
          onChange={(e) => {
            const next = e.target.checked;
            setShowCustom(next);
            // Turning customization back off discards whatever was checked
            // and returns cleanly to the role's own template, rather than
            // leaving a half-customized set hidden behind the toggle.
            if (!next) onChange(templatePages);
          }}
        />
        {t("pages.staffCustomAccessToggle")}
      </label>

      {showCustom ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-primary text-[10px] font-bold tracking-wide uppercase">
              {t("pages.staffAccessGroupPos")}
            </p>
            {renderEditableGroup([POS_SECTION])}
          </div>
          <div className="space-y-2 border-t pt-3">
            <p className="text-primary text-[10px] font-bold tracking-wide uppercase">
              {t("pages.staffAccessGroupBackOffice")}
            </p>
            {renderEditableGroup(BACK_OFFICE_SECTIONS)}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-muted-foreground text-xs">
            {t("pages.staffTemplateHint").replace(
              "{role}",
              templateLabel ?? staffRoleLabel({ role, customRoleLabel: null }, t)
            )}
          </p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-primary text-[10px] font-bold tracking-wide uppercase">
                {t("pages.staffAccessGroupPos")}
              </p>
              {renderSummaryGroup(POS_SECTION.items) ?? (
                <p className="text-muted-foreground/60 text-xs">{t("pages.staffAccessNone")}</p>
              )}
            </div>
            <div className="space-y-1.5 border-t pt-3">
              <p className="text-primary text-[10px] font-bold tracking-wide uppercase">
                {t("pages.staffAccessGroupBackOffice")}
              </p>
              {BACK_OFFICE_SECTIONS.some((section) =>
                section.items.some((item) => templatePages.includes(item.href))
              ) ? (
                BACK_OFFICE_SECTIONS.map((section) => (
                  <div key={section.title}>{renderSummaryGroup(section.items)}</div>
                ))
              ) : (
                <p className="text-muted-foreground/60 text-xs">{t("pages.staffAccessNone")}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
