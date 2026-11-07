"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Lock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { useUser } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { useSetupProgress } from "@/features/guide/hooks/use-setup-progress";
import { useGuideState } from "@/features/guide/hooks/use-guide-state";
import { PLAN_LABELS } from "@/lib/plans/entitlements";
import { useSearchTargets } from "../hooks/use-search-targets";
import { ClaudeConnectHint, ClaudeSearchControls, useHomeClaude } from "./home-claude";
import { WelcomeTourAutoOpen } from "@/features/guide/components/welcome-tour";

interface HomeClientProps {
  storeId: string;
  showSetupGuide: boolean;
  /** The store's owner on their own persona: the welcome tour may open by itself. */
  isOwner: boolean;
  isNewStore: boolean;
}

function greetingKey(hour: number): "morning" | "afternoon" | "lateAfternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 15) return "afternoon";
  if (hour < 18) return "lateAfternoon";
  return "evening";
}

export function HomeClient({ storeId, showSetupGuide, isOwner, isNewStore }: HomeClientProps) {
  const { t, intlLocale } = useI18n();
  const { user } = useUser();
  const { store } = useCurrentStore();
  const { staffAllowed, examples, actions, visible, locked, search, open, recentCards, when } =
    useSearchTargets(storeId);
  const [query, setQuery] = useState("");
  const [hour, setHour] = useState<number | null>(null);
  const [showAllSetup, setShowAllSetup] = useState(false);

  // The greeting hour is device-local: read after mount so the server render and
  // the first client render agree.
  useEffect(() => {
    setHour(new Date().getHours());
  }, []);

  // The Claude connector belongs to the owner's account: no staff persona sees it.
  const claude = useHomeClaude({
    storeId,
    storeName: store?.name,
    enabled: staffAllowed === null,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickedMode, setPickedMode] = useState<"ask" | "search" | null>(null);
  // Connected: the bar is the Claude chat until the owner switches it to search.
  const asking = claude.state === "connected" && (pickedMode ?? "ask") === "ask";

  const results = search(query);

  const claudeExamples = [
    t("claudeConnector.promo.exampleDashboard"),
    t("claudeConnector.promo.exampleStock"),
    t("claudeConnector.promo.exampleSchedule"),
    ...(claude.canWrite ? [t("home.claude.exampleWrite")] : []),
  ];

  const name = user?.name?.split(" ")[0] ?? "";
  const greeting = hour === null ? "" : t(`home.greeting.${greetingKey(hour)}`);
  const heading = name
    ? t("home.greeting.withName").replace("{greeting}", greeting).replace("{name}", name)
    : greeting;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-2 md:py-6">
      <WelcomeTourAutoOpen isOwner={isOwner} isNewStore={isNewStore} />
      {recentCards.length > 0 && (
        <section aria-labelledby="home-recent" className="flex flex-col gap-3">
          <h2 id="home-recent" className="text-muted-foreground text-sm font-medium">
            {t("home.recent.title")}
          </h2>
          <ul className="scrollbar-thin -mx-2 flex snap-x gap-3 overflow-x-auto px-2 pb-2">
            {recentCards.map(({ visit, item }) => {
              const Icon = item.icon;
              return (
                <li key={visit.section} className="w-36 shrink-0 snap-start sm:w-40">
                  <Link
                    href={`/store/${storeId}${visit.section}`}
                    className="bg-card hover:bg-muted/50 flex h-full min-h-28 flex-col justify-between gap-4 rounded-xl border p-3 transition active:scale-[0.98]"
                  >
                    <Icon className="text-muted-foreground size-6" aria-hidden />
                    <span className="flex flex-col gap-0.5">
                      <span className="truncate text-sm font-medium">{t(item.labelKey)}</span>
                      <span className="text-muted-foreground text-xs">{when(visit.at)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="min-h-8 text-2xl font-semibold tracking-tight">{heading}</h1>
        {store?.name && (
          <span className="text-muted-foreground truncate text-sm">{store.name}</span>
        )}
      </header>

      <section aria-label={t("home.searchLabel")} className="flex flex-col gap-3">
        <div className="relative">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (asking) {
                claude.ask(query);
                return;
              }
              if (!results) return;
              const first = [...results.actions, ...results.pages][0];
              if (first) open(first);
            }}
            placeholder={asking ? t("home.claude.askPlaceholder") : t("home.searchPlaceholder")}
            aria-label={asking ? t("home.claude.askPlaceholder") : t("home.searchLabel")}
            className={cn(
              "h-12 rounded-xl pl-12 text-base",
              // Room for the Claude controls: the mark alone on phones, the labelled button from sm.
              claude.state !== "hidden" && (asking ? "pr-24" : "pr-14 sm:pr-36")
            )}
          />
          <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1">
            <ClaudeSearchControls
              claude={claude}
              asking={asking}
              hasText={query.trim().length > 0}
              onAsk={() => claude.ask(query)}
              onSwitch={setPickedMode}
            />
          </div>
        </div>

        {asking ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t("home.claude.ask")}</span>
              {claudeExamples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => {
                    setQuery(example);
                    inputRef.current?.focus();
                  }}
                  className="bg-muted/50 hover:bg-muted min-h-10 rounded-full border px-3.5"
                >
                  {example}
                </button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              {claude.canWrite ? t("home.claude.hintWrite") : t("home.claude.hintRead")}
            </p>
          </div>
        ) : results ? (
          <div className="bg-card rounded-xl border p-1">
            {results.actions.length + results.pages.length === 0 && (
              <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                {t("home.noResults")}
              </p>
            )}
            {(
              [
                ["actions", results.actions],
                ["pages", results.pages],
              ] as const
            ).map(([group, list]) =>
              list.length === 0 ? null : (
                <div key={group} className="py-1">
                  <p className="text-muted-foreground px-3 py-1 text-xs font-semibold tracking-wider uppercase">
                    {t(`home.groups.${group}`)}
                  </p>
                  {list.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => open(x)}
                      className="hover:bg-muted/60 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm"
                    >
                      <x.icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
                      <span className="flex-1 truncate">{x.label}</span>
                      {locked(x) && (
                        <Lock
                          className="size-3.5 shrink-0 text-amber-500"
                          aria-label={PLAN_LABELS[x.plan!]}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("home.try")}</span>
            {examples.filter(visible).map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => open(x)}
                className="bg-muted/50 hover:bg-muted min-h-10 rounded-full border px-3.5"
              >
                {x.label}
              </button>
            ))}
          </div>
        )}
        {!asking && <ClaudeConnectHint claude={claude} />}
      </section>

      <section aria-label={t("home.quickActions")}>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {actions.filter(visible).map((x) => (
            // The customer screen is a second display for a till: no use on a phone.
            <li key={x.id} className={cn(x.id === "customerScreen" && "hidden md:list-item")}>
              <button
                type="button"
                onClick={() => open(x)}
                title={x.newWindow ? t("home.opensNewWindow") : undefined}
                className={cn(
                  "bg-card hover:bg-muted/50 relative flex min-h-16 w-full flex-col items-start justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition active:scale-[0.98]",
                  locked(x) && "text-muted-foreground"
                )}
              >
                <x.icon className="size-5" aria-hidden />
                <span className="w-full truncate">{x.label}</span>
                {locked(x) && (
                  <Lock
                    className="absolute top-2.5 right-2.5 size-3.5 text-amber-500"
                    aria-label={PLAN_LABELS[x.plan!]}
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {showSetupGuide && (
        <SetupSection
          storeId={storeId}
          isNewStore={isNewStore}
          expanded={showAllSetup}
          onToggle={() => setShowAllSetup((s) => !s)}
        />
      )}
    </div>
  );
}

const SETUP_PREVIEW = 6;

function SetupSection({
  storeId,
  isNewStore,
  expanded,
  onToggle,
}: {
  storeId: string;
  isNewStore: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const guide = useGuideState();
  const hidden = guide.isChecklistDismissed(storeId);
  const { data } = useSetupProgress(storeId, { enabled: isNewStore && !hidden });
  if (!data || hidden || data.allDone || data.total === 0) return null;

  const items = data.items.filter((i) => !i.locked);
  const ordered = [...items.filter((i) => !i.done), ...items.filter((i) => i.done)];
  const shown = expanded ? ordered : ordered.slice(0, SETUP_PREVIEW);
  const pct = Math.round((data.completed / data.total) * 100);

  return (
    <section
      aria-labelledby="home-setup"
      className="bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="home-setup" className="text-sm font-semibold">
          {t("home.setup.title")}
        </h2>
        <span className="text-muted-foreground text-xs">
          {t("setupGuide.checklist.progress")
            .replace("{done}", String(data.completed))
            .replace("{total}", String(data.total))}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Progress value={pct} className="h-2" aria-label={`${pct}%`} />
        <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">{pct}%</span>
      </div>
      <ul>
        {shown.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="hover:bg-muted/60 flex min-h-11 items-center gap-3 rounded-lg px-2 text-sm"
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  item.done
                    ? "bg-epi-gold-500 border-epi-gold-500 text-epi-navy-900"
                    : "border-muted-foreground/40"
                )}
              >
                {item.done && <Check className="size-3" strokeWidth={3} aria-hidden />}
              </span>
              <span className={cn("flex-1 truncate", item.done && "text-muted-foreground")}>
                {t(`setupGuide.checklist.items.${item.id}.title`)}
              </span>
              <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {ordered.length > SETUP_PREVIEW && (
        <Button
          type="button"
          variant="ghost"
          className="h-10 self-start px-2 text-xs"
          onClick={onToggle}
        >
          {expanded
            ? t("home.setup.showLess")
            : t("home.setup.showAll").replace("{count}", String(ordered.length))}
        </Button>
      )}
    </section>
  );
}
