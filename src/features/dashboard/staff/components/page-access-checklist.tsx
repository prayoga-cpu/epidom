"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { dashboardNavigation, posModeNavItems, grantableOnlyNavItems } from "@/config/navigation.config";
import { ROLE_DEFAULT_PAGES } from "@/config/staff-permissions.config";
import type { StaffRole } from "@prisma/client";

// Profile, Billing, and Staff management are owner-only (see
// requireOwnerOnly) — granting them here would be a no-op at best, so they
// never appear as options.
const OWNER_ONLY_PAGES = new Set(["/profile", "/billing", "/staff"]);

// posModeNavItems isn't part of dashboardNavigation (it renders in the
// (pos-mode) shell's own tab bar, not this Back Office rail — see that
// export's doc comment) but an owner still needs to grant/revoke it here,
// same as any other page. Its own section, appended after the nav-derived
// ones, so this checklist covers the same universe as ALL_STAFF_PAGES.
const GRANTABLE_SECTIONS = [
  ...dashboardNavigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !OWNER_ONLY_PAGES.has(item.href)),
    }))
    .filter((section) => section.items.length > 0),
  { title: "POS Mode", items: posModeNavItems },
  { title: "Other", items: grantableOnlyNavItems },
];

interface PageAccessChecklistProps {
  role: StaffRole;
  value: string[];
  onChange: (pages: string[]) => void;
}

/** Per-staff page access, grouped by nav section, with a "Reset to role defaults" shortcut. */
export function PageAccessChecklist({ role, value, onChange }: PageAccessChecklistProps) {
  const { t } = useI18n();
  const toggle = (href: string, checked: boolean) => {
    onChange(checked ? [...value, href] : value.filter((p) => p !== href));
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs font-semibold">Page Access</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onChange(ROLE_DEFAULT_PAGES[role] ?? [])}
        >
          Reset to role defaults
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {GRANTABLE_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1.5">
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
    </div>
  );
}
