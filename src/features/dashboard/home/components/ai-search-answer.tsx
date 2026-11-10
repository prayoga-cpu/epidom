"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import type { SearchTarget } from "../hooks/use-search-targets";
import type { AiSearchState } from "../hooks/use-ai-search";

interface Props {
  state: AiSearchState;
  /** The assistant's matches as openable targets (staff and plan rules already applied). */
  targets: SearchTarget[];
  onOpen: (x: SearchTarget) => void;
}

/** What the search shows when the dropdown found nothing: the assistant's answer and where to go. */
export function AiSearchAnswer({ state, targets, onOpen }: Props) {
  const { t } = useI18n();
  if (state.status === "idle") return null;
  return (
    <div className="space-y-2 px-3 py-3" aria-live="polite">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
        <Sparkles className="size-3.5" aria-hidden />
        {t("home.ai.badge")}
      </p>
      {state.status === "loading" && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("home.ai.thinking")}
        </p>
      )}
      {state.status === "error" && (
        <p className="text-muted-foreground text-sm">{t("home.ai.error")}</p>
      )}
      {state.status === "done" && (
        <>
          <p className="text-sm">{state.answer}</p>
          {targets.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => onOpen(x)}
              className="hover:bg-muted/60 flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 text-left text-sm"
            >
              <x.icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{x.label}</span>
            </button>
          ))}
          <p className="text-muted-foreground text-xs">{t("home.ai.disclaimer")}</p>
        </>
      )}
    </div>
  );
}
