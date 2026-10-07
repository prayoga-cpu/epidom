"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, UtensilsCrossed, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { usePosMenu } from "../hooks/use-pos-menu";

/** The query /pos adds when it sends an empty till here (see resolveMenuSetupHref). */
export const FROM_POS_PARAM = "from";
export const FROM_POS_VALUE = "pos";

interface PosMenuNoticeProps {
  storeId: string;
  /** Shown while the menu is still empty: the way to add it on this page. */
  action?: ReactNode;
  className?: string;
}

/**
 * Why the owner landed here from the POS: the till sells from the menu, and
 * the menu is empty. Watches the till's own menu (the same read the POS
 * makes), so the moment an item is on it the notice turns into "Open the
 * POS". Renders only on a visit that came from the POS (?from=pos); closing it
 * drops the param.
 */
export function PosMenuNotice({ storeId, action, className }: PosMenuNoticeProps) {
  const searchParams = useSearchParams();
  if (searchParams?.get(FROM_POS_PARAM) !== FROM_POS_VALUE) return null;
  return <PosMenuNoticeCard storeId={storeId} action={action} className={className} />;
}

function PosMenuNoticeCard({ storeId, action, className }: PosMenuNoticeProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data } = usePosMenu(storeId);
  const ready = (data?.total ?? 0) > 0;

  const dismiss = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete(FROM_POS_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : (pathname ?? "/"), { scroll: false });
  };

  const Icon = ready ? CheckCircle2 : UtensilsCrossed;
  const cta = ready ? (
    <Button asChild className="h-11 w-full sm:w-auto">
      <Link href={`/store/${storeId}/pos`}>{t("pos.menuNotice.openPos")}</Link>
    </Button>
  ) : (
    action
  );

  // Close stays in the top-right corner at every width; the button goes under
  // the text on a phone and beside it from sm up.
  return (
    <section
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-lg border p-4",
        ready ? "border-primary/40 bg-primary/5" : "border-amber-500/40 bg-amber-500/5",
        className
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("mt-0.5 size-5 shrink-0", ready ? "text-primary" : "text-amber-500")}
      />
      <div className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
        <div className="min-w-0 sm:flex-1">
          <h2 className="text-sm font-semibold">
            {ready ? t("pos.menuNotice.readyTitle") : t("pos.menuNotice.requiredTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">
            {ready ? t("pos.menuNotice.readyBody") : t("pos.menuNotice.requiredBody")}
          </p>
        </div>
        {cta && <div className="mt-3 shrink-0 sm:mt-0">{cta}</div>}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="-mt-2 -mr-2 size-11 shrink-0"
        aria-label={t("pos.menuNotice.dismiss")}
        onClick={dismiss}
      >
        <X aria-hidden="true" />
      </Button>
    </section>
  );
}
