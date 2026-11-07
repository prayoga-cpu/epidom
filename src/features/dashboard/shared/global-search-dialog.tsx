"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { ArrowUp, Lock, Search, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useI18n } from "@/components/lang/i18n-provider";
import {
  ClaudeSearchControls,
  useHomeClaude,
} from "@/features/dashboard/home/components/home-claude";
import {
  useSearchTargets,
  type SearchTarget,
} from "@/features/dashboard/home/hooks/use-search-targets";
import { PLAN_LABELS } from "@/lib/plans/entitlements";
import { cn } from "@/lib/utils";
import { useCurrentStore } from "./hooks/use-current-store";

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ITEM =
  "data-[selected=true]:bg-muted/70 flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm outline-none";
const HEADING =
  "text-muted-foreground px-3 pt-3 pb-1 text-xs font-semibold tracking-wider uppercase";

/**
 * ⌘K / the sidebar's Search: the Home search in a window. Empty, it lists what
 * you opened recently and the quick actions; typing finds actions and pages by
 * name or keyword (plan locks and staff access applied, same as Home); and with
 * Claude MCP connected it can hand a question to your own Claude instead.
 */
export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const { t } = useI18n();
  const { store, storeId } = useCurrentStore();
  const id = storeId ?? "";
  const targets = useSearchTargets(id);
  const {
    staffAllowed,
    actions,
    visible,
    locked,
    search,
    open: openTarget,
    recentCards,
    when,
  } = targets;
  const claude = useHomeClaude({
    storeId: id,
    storeName: store?.name,
    enabled: staffAllowed === null,
  });
  const [query, setQuery] = React.useState("");
  const [pickedMode, setPickedMode] = React.useState<"ask" | "search" | null>(null);
  // Connected: the bar is the Claude chat until switched to search.
  const asking = claude.state === "connected" && (pickedMode ?? "ask") === "ask";

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  // A fresh start every time it opens.
  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setPickedMode(null);
    }
  }, [open]);

  const close = () => onOpenChange(false);
  const pick = (x: SearchTarget) => {
    close();
    openTarget(x);
  };
  const ask = (question: string) => {
    close();
    claude.ask(question);
  };

  const results = asking ? null : search(query);
  const claudeExamples = [
    t("claudeConnector.promo.exampleDashboard"),
    t("claudeConnector.promo.exampleStock"),
    t("claudeConnector.promo.exampleSchedule"),
    ...(claude.canWrite ? [t("home.claude.exampleWrite")] : []),
  ];

  const row = (x: SearchTarget, extra?: React.ReactNode) => (
    <CommandPrimitive.Item key={x.id} value={x.id} onSelect={() => pick(x)} className={ITEM}>
      <x.icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{x.label}</span>
      {extra}
      {locked(x) && (
        <Lock className="size-3.5 shrink-0 text-amber-500" aria-label={PLAN_LABELS[x.plan!]} />
      )}
    </CommandPrimitive.Item>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          // Phones: a full-screen sheet (input on top, results filling the screen,
          // nothing left for the keyboard to hide). From sm: a centred window.
          "top-0 left-0 flex h-[calc(100dvh/var(--app-zoom,1))] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0",
          "sm:top-[16%] sm:left-[50%] sm:h-auto sm:max-w-xl sm:-translate-x-1/2 sm:rounded-lg sm:border"
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("search.title")}</DialogTitle>
          <DialogDescription>{t("search.description")}</DialogDescription>
        </DialogHeader>
        <CommandPrimitive shouldFilter={false} loop className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="text-muted-foreground size-5 shrink-0" aria-hidden />
            <CommandPrimitive.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={asking ? t("home.claude.askPlaceholder") : t("home.searchPlaceholder")}
              aria-label={asking ? t("home.claude.askPlaceholder") : t("home.searchLabel")}
              className="placeholder:text-muted-foreground h-14 min-w-0 flex-1 bg-transparent text-base outline-none"
            />
            <div className="flex shrink-0 items-center gap-1">
              {/* A phone has no Esc key: an explicit close. */}
              <button
                type="button"
                onClick={close}
                aria-label={t("search.hintClose")}
                className="text-muted-foreground hover:text-foreground order-last flex size-10 items-center justify-center rounded-md sm:hidden"
              >
                <X className="size-5" aria-hidden />
              </button>
              <ClaudeSearchControls
                claude={claude}
                asking={asking}
                hasText={query.trim().length > 0}
                onAsk={() => ask(query)}
                onSwitch={setPickedMode}
                onNavigate={close}
              />
            </div>
          </div>

          <CommandPrimitive.List className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2 sm:max-h-[min(calc(58dvh/var(--app-zoom,1)),420px)] sm:flex-none">
            {asking ? (
              <>
                {query.trim() ? (
                  <CommandPrimitive.Group>
                    <CommandPrimitive.Item
                      value="ask-claude"
                      onSelect={() => ask(query)}
                      className={ITEM}
                    >
                      <ArrowUp className="text-muted-foreground size-4 shrink-0" aria-hidden />
                      <span className="flex-1 truncate">
                        {t("home.claude.send")}: “{query.trim()}”
                      </span>
                    </CommandPrimitive.Item>
                  </CommandPrimitive.Group>
                ) : (
                  <CommandPrimitive.Group heading={t("home.claude.ask")}>
                    {claudeExamples.map((example) => (
                      <CommandPrimitive.Item
                        key={example}
                        value={example}
                        onSelect={() => setQuery(example)}
                        className={ITEM}
                      >
                        <span className="flex-1 truncate">{example}</span>
                      </CommandPrimitive.Item>
                    ))}
                  </CommandPrimitive.Group>
                )}
                <p className="text-muted-foreground px-3 py-2 text-xs">
                  {claude.canWrite ? t("home.claude.hintWrite") : t("home.claude.hintRead")}
                </p>
              </>
            ) : results ? (
              results.actions.length + results.pages.length === 0 ? (
                <p className="text-muted-foreground px-3 py-8 text-center text-sm">
                  {t("home.noResults")}
                </p>
              ) : (
                (
                  [
                    ["actions", results.actions],
                    ["pages", results.pages],
                  ] as const
                ).map(([group, list]) =>
                  list.length === 0 ? null : (
                    <CommandPrimitive.Group
                      key={group}
                      heading={t(`home.groups.${group}`)}
                      className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase"
                    >
                      {list.map((x) => row(x))}
                    </CommandPrimitive.Group>
                  )
                )
              )
            ) : (
              <>
                {recentCards.length > 0 && (
                  <CommandPrimitive.Group
                    heading={t("home.recent.title")}
                    className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase"
                  >
                    {recentCards.slice(0, 5).map(({ visit, item }) => {
                      const target: SearchTarget = {
                        id: `recent-${visit.section}`,
                        label: t(item.labelKey),
                        keywords: "",
                        icon: item.icon,
                        href: `/store/${id}${visit.section}`,
                        gate: item.href,
                        plan: item.requiredPlan,
                      };
                      return row(
                        target,
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {when(visit.at)}
                        </span>
                      );
                    })}
                  </CommandPrimitive.Group>
                )}
                <CommandPrimitive.Group
                  heading={t("home.groups.actions")}
                  className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:uppercase"
                >
                  {actions.filter(visible).map((x) => row(x))}
                </CommandPrimitive.Group>
              </>
            )}
          </CommandPrimitive.List>

          <div className="text-muted-foreground hidden items-center gap-4 border-t px-4 py-2.5 text-xs sm:flex">
            <span className="flex items-center gap-1.5">
              {t("search.hintClose")}
              <Kbd>Esc</Kbd>
            </span>
            <span className="flex items-center gap-1.5">
              {t("search.hintNavigate")}
              <KbdGroup>
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
              </KbdGroup>
            </span>
            <span className="flex items-center gap-1.5">
              {t("search.hintOpen")}
              <Kbd>↵</Kbd>
            </span>
          </div>
        </CommandPrimitive>
      </DialogContent>
    </Dialog>
  );
}
