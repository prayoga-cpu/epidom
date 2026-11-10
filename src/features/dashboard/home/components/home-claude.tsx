"use client";

import Link from "next/link";
import { ArrowUp, Search } from "lucide-react";
import { ClaudeMark } from "@/components/claude-mark";
import { useI18n } from "@/components/lang/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  useClaudeConnectorAccess,
  useClaudeConnectorWriteAccess,
} from "@/features/claude-connector/hooks/use-claude-connector-access";
import { useConnectedApps } from "@/features/claude-connector/hooks/use-connected-apps";
import { useSubscriptionStatus } from "@/features/stores/stores/hooks/use-subscription-status";
import { trackEvent } from "@/lib/analytics";
import { upgradeHrefFor } from "@/lib/plans/entitlements";
import { cn } from "@/lib/utils";

/**
 * - hidden: not decided yet (plan or connections still loading), or a viewer who
 *   isn't the owner account (a staff persona).
 * - upgrade: the plan has no Claude connector (it starts at Operations).
 * - connect: the plan has it and no Claude app is connected yet.
 * - connected: at least one Claude app is connected: the search bar can ask it.
 */
export type HomeClaudeState = "hidden" | "upgrade" | "connect" | "connected";

export function useHomeClaude({
  storeId,
  storeName,
  enabled,
}: {
  storeId: string;
  storeName: string | undefined;
  enabled: boolean;
}) {
  const { t } = useI18n();
  const { data: subData } = useSubscriptionStatus();
  const canRead = useClaudeConnectorAccess();
  const canWrite = useClaudeConnectorWriteAccess();
  const { data: connections } = useConnectedApps({ enabled: enabled && canRead });

  let state: HomeClaudeState = "hidden";
  if (enabled && subData?.subscription) {
    if (!canRead) state = "upgrade";
    else if (connections) state = connections.apps.length > 0 ? "connected" : "connect";
  }

  /**
   * Hands the question to the owner's own Claude (claude.ai, on their plan,
   * with the Epidom connector). Epidom runs no model here and pays for none.
   */
  function ask(question: string) {
    const text = question.trim();
    if (!text) return;
    const prompt = t("home.claude.promptPrefix")
      .replace("{store}", storeName ?? "")
      .replace("{question}", text);
    trackEvent("home_claude_ask", { event_category: "claude_connector", canWrite });
    window.open(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`, "_blank", "noopener");
  }

  return {
    state,
    canWrite,
    ask,
    connectHref: `/store/${storeId}/profile#claude`,
    upgradeHref: upgradeHrefFor("OPERATIONS"),
  };
}

const PILL =
  "group focus-visible:ring-ring flex h-10 min-w-10 justify-center items-center gap-1.5 rounded-lg border px-2.5 sm:px-3 text-sm font-medium outline-none transition hover:bg-muted/60 focus-visible:ring-2";

/** "Claude" that turns into "Connect →" (or "Upgrade →") on hover and focus, in the same footprint. */
function MorphLabel({ rest, hover }: { rest: string; hover: string }) {
  return (
    // Hidden on phones (the button is just the mark there, see ClaudeConnectHint).
    // A touchscreen has no hover, so there the hover label is simply always shown.
    <span className="hidden sm:inline-grid">
      <span className="col-start-1 row-start-1 transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0 [@media(hover:none)]:opacity-0">
        {rest}
      </span>
      <span
        className="col-start-1 row-start-1 whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        aria-hidden
      >
        {hover}
      </span>
    </span>
  );
}

interface ClaudeSearchControlsProps {
  claude: ReturnType<typeof useHomeClaude>;
  /** True while the bar is the Claude chat (connected and not switched to search). */
  asking: boolean;
  hasText: boolean;
  onAsk: () => void;
  onSwitch: (mode: "ask" | "search") => void;
  /** Called when the connect / upgrade link is followed (the dialog closes itself). */
  onNavigate?: () => void;
}

/** The right-hand end of the Home search bar. Renders nothing while hidden. */
export function ClaudeSearchControls({
  claude,
  asking,
  hasText,
  onAsk,
  onSwitch,
  onNavigate,
}: ClaudeSearchControlsProps) {
  const { t } = useI18n();
  const label = t("home.claude.label");

  if (claude.state === "hidden") return null;

  if (claude.state === "connect" || claude.state === "upgrade") {
    const connect = claude.state === "connect";
    return (
      <Link
        href={connect ? claude.connectHref : claude.upgradeHref}
        onClick={() => {
          trackEvent("home_claude_connect_click", {
            event_category: "claude_connector",
            state: claude.state,
          });
          onNavigate?.();
        }}
        className={PILL}
      >
        <ClaudeMark className="size-4" />
        <MorphLabel
          rest={label}
          hover={t(connect ? "home.claude.connect" : "home.claude.upgrade")}
        />
        <span className="sr-only">
          {t(connect ? "home.claude.connect" : "home.claude.upgrade")}
        </span>
      </Link>
    );
  }

  // Connected: the bar is the chat. Search stays one tap away.
  if (!asking) {
    return (
      <button
        type="button"
        className={PILL}
        onClick={() => onSwitch("ask")}
        title={t("home.claude.switchToAsk")}
        aria-label={t("home.claude.switchToAsk")}
      >
        <ClaudeMark className="size-4" />
        <span className="hidden sm:inline">{label}</span>
        <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
      </button>
    );
  }
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10"
        onClick={() => onSwitch("search")}
        title={t("home.claude.switchToSearch")}
        aria-label={t("home.claude.switchToSearch")}
      >
        <Search className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon"
        className={cn("size-10 rounded-lg", !hasText && "opacity-50")}
        disabled={!hasText}
        onClick={onAsk}
        title={t("home.claude.send")}
        aria-label={t("home.claude.send")}
      >
        <ArrowUp className="size-4" aria-hidden />
      </Button>
    </>
  );
}

/**
 * Phones only: the search bar's Claude button is just the mark there (no room
 * for a label, and no hover to reveal "Connect →"), so this line under the bar
 * says what it does. Renders nothing once Claude is connected.
 */
export function ClaudeConnectHint({
  claude,
  onNavigate,
  className,
}: {
  claude: ReturnType<typeof useHomeClaude>;
  onNavigate?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  if (claude.state !== "connect" && claude.state !== "upgrade") return null;
  const connect = claude.state === "connect";
  return (
    <Link
      href={connect ? claude.connectHref : claude.upgradeHref}
      onClick={() => {
        trackEvent("home_claude_connect_click", {
          event_category: "claude_connector",
          state: claude.state,
          surface: "mobile_hint",
        });
        onNavigate?.();
      }}
      className={cn(
        "text-muted-foreground hover:text-foreground flex min-h-10 items-center gap-2 text-sm sm:hidden",
        className
      )}
    >
      <ClaudeMark className="size-4" />
      <span className="text-foreground font-medium">{t("home.claude.label")}</span>
      <span>{t(connect ? "home.claude.connect" : "home.claude.upgrade")}</span>
    </Link>
  );
}

/**
 * Wide screens: the Claude MCP invitation as a small card in Home's side
 * column (phones have the line under the greeting, and the button inside the
 * search bar). Only while Claude is not connected and the plan includes it.
 */
export function ClaudeConnectCard({
  claude,
  className,
}: {
  claude: ReturnType<typeof useHomeClaude>;
  className?: string;
}) {
  const { t } = useI18n();
  if (claude.state !== "connect") return null;
  return (
    <Link
      href={claude.connectHref}
      onClick={() =>
        trackEvent("home_claude_connect_click", {
          event_category: "claude_connector",
          state: claude.state,
          surface: "side_card",
        })
      }
      className={cn(
        "bg-card hover:bg-muted/50 group flex flex-col gap-2 rounded-xl border p-4 transition",
        className
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        <ClaudeMark className="size-5" />
        {t("home.claude.label")}
        <span className="text-muted-foreground ml-auto text-xs font-medium transition-transform group-hover:translate-x-0.5">
          {t("home.claude.connect")}
        </span>
      </span>
      <span className="text-muted-foreground text-xs leading-snug">
        {t("home.claude.hintRead")}
      </span>
    </Link>
  );
}
