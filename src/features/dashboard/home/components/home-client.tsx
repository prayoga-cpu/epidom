"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Lock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { useUser } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { useSetupProgress } from "@/features/guide/hooks/use-setup-progress";
import { useGuideState } from "@/features/guide/hooks/use-guide-state";
import { Kbd } from "@/components/ui/kbd";
import { useAlertsCount } from "@/features/dashboard/alerts/hooks/use-alerts-count";
import { PLAN_LABELS } from "@/lib/plans/entitlements";
import { useSearchTargets } from "../hooks/use-search-targets";
import {
  ClaudeConnectCard,
  ClaudeConnectHint,
  ClaudeSearchControls,
  useHomeClaude,
} from "./home-claude";
import { WelcomeTourAutoOpen } from "@/features/guide/components/welcome-tour";

interface HomeClientProps {
  storeId: string;
  showSetupGuide: boolean;
  /** The store's owner on their own persona: the welcome tour may open by itself. */
  isOwner: boolean;
  isNewStore: boolean;
}

/** Quick actions kept off the phone grid (they are in the menu and in search). New order has its own big button there. */
const PHONE_HIDDEN_ACTIONS = new Set([
  "newOrder",
  "staff",
  "import",
  "settings",
  "customerScreen",
  "analytics",
  "alerts",
]);

/** Settings is in the sidebar and in search: not worth a tile. */
const GRID_HIDDEN_ACTIONS = new Set(["settings"]);

/** The wide-screen tiles, grouped by what you are doing: selling, managing, reviewing. */
const TILE_GROUPS = [
  { key: "sell", ids: ["newOrder", "phoneOrders", "customerScreen"] },
  { key: "manage", ids: ["products", "import", "staff", "alerts"] },
  { key: "review", ids: ["reports", "analytics"] },
] as const;

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

  // "/" jumps to the search bar from anywhere on the page (not while typing elsewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      )
        return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const results = search(query);
  const newOrder = actions.find((a) => a.id === "newOrder");
  const alertsCount = useAlertsCount();

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

  const tile = (x: (typeof actions)[number]) => {
    const primary = x.id === "newOrder" && !locked(x);
    const badge = x.id === "alerts" && alertsCount > 0 ? alertsCount : null;
    return (
      <button
        type="button"
        onClick={() => open(x)}
        title={x.newWindow ? t("home.opensNewWindow") : undefined}
        className={cn(
          "relative flex min-h-20 w-full cursor-pointer flex-col items-start justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition active:scale-[0.98] md:min-h-16 md:text-sm",
          primary
            ? "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent"
            : "bg-card hover:bg-muted/50",
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
        {badge !== null && !locked(x) && (
          <span
            className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[10px] font-semibold text-white shadow-sm"
            aria-label={`${badge} alerts`}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
    );
  };

  const recentRows = recentCards.length > 0 && (
    <section
      aria-labelledby="home-recent-list"
      className="lg:bg-card flex flex-col gap-1 lg:rounded-xl lg:border lg:p-3"
    >
      <h2 id="home-recent-list" className="text-muted-foreground px-1 pb-1 text-sm font-medium">
        {t("home.recent.title")}
      </h2>
      <ul>
        {recentCards.slice(0, 6).map(({ visit, item }) => {
          const Icon = item.icon;
          return (
            <li key={visit.section}>
              <Link
                href={`/store/${storeId}${visit.section}`}
                className="hover:bg-muted/60 flex min-h-12 items-center gap-3 rounded-lg px-1 transition"
              >
                <Icon className="text-muted-foreground size-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {t(item.labelKey)}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">{when(visit.at)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 py-2 md:flex-none md:gap-8 md:py-6 lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-10">
      {/* Main column. On phones and tablets `contents` lets its children sit
          straight in the page's flex column (the search bar needs that to pin
          to the bottom); from lg it is the left column of a two-column page. */}
      <div className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-8">
        <WelcomeTourAutoOpen isOwner={isOwner} isNewStore={isNewStore} />

        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="min-h-8 text-2xl font-semibold tracking-tight">{heading}</h1>
          {store?.name && (
            <span className="text-muted-foreground truncate text-sm">{store.name}</span>
          )}
        </header>

        {!asking && <ClaudeConnectHint claude={claude} className="-mt-3" />}

        {/* Phones: the search / Claude bar is the hero, pinned to the bottom where a
          thumb reaches it (suggestions and results open above it). From md it is
          the plain in-flow search under the greeting. */}
        <section
          aria-label={t("home.searchLabel")}
          className={cn(
            "order-last flex flex-col-reverse gap-3 md:order-none md:flex-col",
            "bg-card/95 sticky bottom-0 z-10 -mx-2 mt-auto border-t px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur",
            "md:static md:mx-0 md:mt-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
          )}
        >
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
                "h-14 rounded-2xl pl-12 text-base md:h-12 md:rounded-xl",
                // Room for the Claude controls: the mark alone on phones, the labelled button from sm.
                claude.state !== "hidden"
                  ? asking
                    ? "pr-24 lg:pr-32"
                    : "pr-14 sm:pr-36 lg:pr-44"
                  : "lg:pr-12"
              )}
            />
            <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1">
              {!query && (
                <Kbd className="hidden lg:inline-flex" aria-hidden>
                  /
                </Kbd>
              )}
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
              <div className="scrollbar-thin -mx-3 flex flex-nowrap items-center gap-2 overflow-x-auto px-3 text-sm md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
                <span className="text-muted-foreground shrink-0">{t("home.claude.ask")}</span>
                {claudeExamples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setQuery(example);
                      inputRef.current?.focus();
                    }}
                    className="bg-muted/50 hover:bg-muted min-h-10 shrink-0 rounded-full border px-3.5"
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
            <div className="bg-card max-h-[calc(50dvh/var(--app-zoom,1))] overflow-y-auto rounded-xl border p-1 md:max-h-none md:overflow-visible">
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
            <div className="scrollbar-thin -mx-3 flex flex-nowrap items-center gap-2 overflow-x-auto px-3 text-sm md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
              <span className="text-muted-foreground shrink-0">{t("home.try")}</span>
              {examples.filter(visible).map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => open(x)}
                  className="bg-muted/50 hover:bg-muted min-h-10 shrink-0 rounded-full border px-3.5"
                >
                  {x.label}
                </button>
              ))}
            </div>
          )}
        </section>

        <section aria-label={t("home.quickActions")} className="flex flex-col gap-3">
          {/* Phones: the one primary action, big, like a "New session" pill. */}
          {newOrder && visible(newOrder) && (
            <button
              type="button"
              onClick={() => open(newOrder)}
              className={cn(
                "flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold transition active:scale-[0.98] md:hidden",
                locked(newOrder)
                  ? "bg-card text-muted-foreground border"
                  : "bg-primary text-primary-foreground"
              )}
            >
              <newOrder.icon className="size-5" aria-hidden />
              {newOrder.label}
              {locked(newOrder) && (
                <Lock className="size-4 text-amber-500" aria-label={PLAN_LABELS[newOrder.plan!]} />
              )}
            </button>
          )}
          {/* Phones: three tiles; the rest are in the menu and in search. */}
          <ul className="grid grid-cols-3 gap-2 md:hidden">
            {actions
              .filter((x) => visible(x) && !PHONE_HIDDEN_ACTIONS.has(x.id))
              .map((x) => (
                <li key={x.id}>{tile(x)}</li>
              ))}
          </ul>
          {/* Tablet and up: every tile, grouped by what you are doing. */}
          <div className="hidden flex-col gap-5 md:flex">
            {TILE_GROUPS.map((group) => {
              const items = group.ids
                .map((id) => actions.find((a) => a.id === id))
                .filter((x): x is NonNullable<typeof x> => !!x && visible(x))
                .filter((x) => !GRID_HIDDEN_ACTIONS.has(x.id));
              if (items.length === 0) return null;
              return (
                <div key={group.key} className="flex flex-col gap-2">
                  <h2 className="text-muted-foreground px-1 text-xs font-semibold tracking-wider uppercase">
                    {t(`home.tileGroups.${group.key}`)}
                  </h2>
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {items.map((x) => (
                      <li key={x.id}>{tile(x)}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Side column (from lg): recents, the Claude MCP card, setup. Below lg
          its children join the page's flex column in this order. */}
      <aside className="contents lg:flex lg:min-w-0 lg:flex-col lg:gap-5">
        {recentRows}
        <ClaudeConnectCard claude={claude} className="hidden lg:flex" />

        {showSetupGuide && (
          <SetupSection
            storeId={storeId}
            isNewStore={isNewStore}
            expanded={showAllSetup}
            onToggle={() => setShowAllSetup((s) => !s)}
          />
        )}
      </aside>
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
  // Phones: a slim progress row that opens the list; from md the list is always shown.
  const [listOpen, setListOpen] = useState(false);
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
      className="bg-card flex flex-col gap-3 rounded-xl border p-3 md:p-4"
    >
      <button
        type="button"
        aria-expanded={listOpen}
        aria-controls="home-setup-list"
        onClick={() => setListOpen((o) => !o)}
        className="flex min-h-10 items-baseline justify-between gap-3 text-left md:pointer-events-none"
      >
        <h2 id="home-setup" className="text-sm font-semibold">
          {t("home.setup.title")}
        </h2>
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          {t("setupGuide.checklist.progress")
            .replace("{done}", String(data.completed))
            .replace("{total}", String(data.total))}
          <ChevronDown
            className={cn("size-4 transition-transform md:hidden", listOpen && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>
      <div className="flex items-center gap-3">
        <Progress value={pct} className="h-2" aria-label={`${pct}%`} />
        <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">{pct}%</span>
      </div>
      <ul id="home-setup-list" className={cn(listOpen ? "block" : "hidden md:block")}>
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
          className={cn("h-10 self-start px-2 text-xs", listOpen ? "flex" : "hidden md:flex")}
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
