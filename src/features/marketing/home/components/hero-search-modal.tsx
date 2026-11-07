"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, useDragControls, type PanInfo } from "motion/react";
import { ArrowUpRight, Check, CircleSlash, Loader2, Search, Store, X } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/lang/i18n-provider";
import { Dialog, DialogClose, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { stashClaimedLink } from "../lib/claimed-link";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "./landing-ui";

type Store = { slug: string; displayName: string };
/** The store link the query would make, and whether it is still free (from the search route). */
type LinkCheck = { slug: string; available: boolean };
type Status = "idle" | "loading" | "done" | "error";

const PHONE_QUERY = "(max-width: 639px)";

/** True on a phone-width screen (below Tailwind's `sm`), where the search is a drawer. */
function useIsPhone() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(PHONE_QUERY);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false
  );
}

/** What a visitor types: "@my-cafe", "my-cafe" or a pasted "epidom.fr/@my-cafe". */
export function cleanQuery(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^[^/\s]*\/(?=@)/, "")
    .replace(/^@/, "")
    .replace(/[^\p{L}\p{N} '-]/gu, "")
    .trim();
}

/**
 * Keeps an "@handle" in copy on one line: "@pesan-lewat-hp" would otherwise
 * break at its hyphens on a phone ("@pesan-" / "lewat-hp").
 */
function keepHandlesWhole(text: string) {
  return text.split(/(@[\p{L}\p{N}-]+)/u).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    )
  );
}

/**
 * The hero's "claim your link" search, for owners first and diners second. As
 * the visitor types (debounced, only the latest answer kept) it says whether
 * epidom.fr/@<what they typed> is still free: free -> "create my store with
 * this link" (the link is handed to the setup wizard, see claimed-link.ts);
 * taken -> try another name. Under it, the cafés already on Epidom that match,
 * each opening its phone-orders page.
 *
 * Desktop: a centred modal that fades and scales in under the header. Phone: a
 * drawer that rises from the bottom; its handle and title bar can be dragged
 * down to dismiss (the list itself scrolls as usual, so a swipe in it never
 * closes the drawer by accident).
 */
export function HeroSearchModal({
  open,
  onOpenChange,
  registerHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registerHref: string;
}) {
  const { t } = useI18n();
  const isPhone = useIsPhone();
  const dragControls = useDragControls();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [stores, setStores] = useState<Store[]>([]);
  const [link, setLink] = useState<LinkCheck | null>(null);
  const query = cleanQuery(value);
  const debounced = useDebounce(query, 200);
  const searched = useRef("");

  // A fresh search each time it opens.
  useEffect(() => {
    if (!open) {
      setValue("");
      setStores([]);
      setLink(null);
      setStatus("idle");
      searched.current = "";
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debounced.length < 2) {
      setStores([]);
      setLink(null);
      setStatus("idle");
      searched.current = "";
      return;
    }
    const controller = new AbortController();
    setStatus("loading");
    fetch(`/api/public/storefront-search?q=${encodeURIComponent(debounced)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      })
      .then((json) => {
        setStores(json?.data?.stores ?? []);
        setLink(json?.data?.link ?? null);
        setStatus("done");
        searched.current = debounced;
        trackEvent("hero_store_search", { cta: "search" });
      })
      .catch((error) => {
        if (error?.name !== "AbortError") setStatus("error");
      });
    return () => controller.abort();
  }, [debounced, open]);

  // The typed text is ahead of the answer for a moment: only call it "not
  // found" once the answer is for what is on screen.
  const settled = status === "done" && searched.current === query;
  // Nothing to claim (too short to be a link) and no café found.
  const notFound = settled && stores.length === 0 && !link;

  function claim(slug: string) {
    stashClaimedLink(slug);
    trackEvent("hero_store_search", { cta: "claim" });
  }

  function onDragEnd(_: PointerEvent, info: PanInfo) {
    if (info.offset.y > 120 || info.velocity.y > 600) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Above the site's floating header (z-index 60). */}
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" />
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-end justify-center sm:items-start sm:pt-[clamp(4rem,14svh,9rem)]">
          <DialogPrimitive.Content
            asChild
            aria-describedby={undefined}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <motion.div
              drag={isPhone ? "y" : false}
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={onDragEnd}
              className={cn(
                "bg-epi-navy-900 text-epi-cream-50 pointer-events-auto flex w-full flex-col overflow-hidden outline-none",
                "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
                // Phone: a drawer that rises from the bottom edge.
                "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom h-[min(85dvh,640px)] rounded-t-3xl border-t border-white/10 duration-300",
                // Desktop: a modal that scales in, sized to its content.
                "sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0 sm:h-auto sm:max-h-[min(70dvh,560px)] sm:max-w-xl sm:rounded-3xl sm:border sm:border-white/10 sm:shadow-2xl"
              )}
            >
              {/* Drag handle: the only place a drag starts, so the list can scroll. */}
              <div
                onPointerDown={(e) => isPhone && dragControls.start(e)}
                className="flex touch-none justify-center pt-3 pb-1 sm:hidden"
              >
                <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-white/25" />
              </div>

              <div
                onPointerDown={(e) => isPhone && dragControls.start(e)}
                className="flex touch-none items-center justify-between gap-3 px-5 pt-2 pb-3 sm:touch-auto sm:pt-5"
              >
                <DialogTitle className="text-epi-cream-50 m-0 text-base font-medium">
                  {keepHandlesWhole(t("redesign.landing.hero.searchLabel"))}
                </DialogTitle>
                <DialogClose asChild>
                  <button
                    type="button"
                    aria-label={t("redesign.landing.hero.searchClose")}
                    className="text-epi-cream-50/70 hover:text-epi-cream-50 focus-visible:outline-epi-gold-300 -mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </DialogClose>
              </div>

              <div className="px-5 pb-3">
                <div className="focus-within:border-epi-gold-400 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4">
                  {status === "loading" ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-5 shrink-0 animate-spin opacity-60"
                    />
                  ) : (
                    <Search aria-hidden="true" className="size-5 shrink-0 opacity-60" />
                  )}
                  <span aria-hidden="true" className="text-epi-cream-50/50 select-none">
                    <span className="hidden sm:inline">epidom.fr/</span>@
                  </span>
                  <input
                    autoFocus
                    type="text"
                    role="combobox"
                    aria-expanded={stores.length > 0}
                    aria-controls="hero-store-results"
                    aria-label={t("redesign.landing.hero.searchLabel")}
                    autoComplete="off"
                    inputMode="search"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={t("redesign.landing.hero.searchPlaceholder")}
                    // 16px: anything smaller makes iOS zoom the page on focus.
                    className="text-epi-cream-50 placeholder:text-epi-cream-50/35 min-h-14 min-w-0 flex-1 bg-transparent text-base outline-none"
                  />
                </div>
              </div>

              <div
                id="hero-store-results"
                aria-live="polite"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
              >
                {/* The owner's question first: is this link still free? */}
                {link && settled ? (
                  <div
                    className={cn(
                      "mx-2 mb-3 flex flex-col gap-3 rounded-2xl border p-4",
                      link.available
                        ? "border-epi-gold-500/40 bg-epi-gold-500/[0.08]"
                        : "border-white/10 bg-white/[0.03]"
                    )}
                  >
                    <p className="text-epi-cream-50 m-0 flex items-center gap-2 text-[15px] font-medium">
                      {link.available ? (
                        <Check aria-hidden="true" className="text-epi-gold-300 size-5 shrink-0" />
                      ) : (
                        <CircleSlash aria-hidden="true" className="size-5 shrink-0 opacity-60" />
                      )}
                      <span className="min-w-0 break-all">
                        {t(
                          link.available
                            ? "redesign.landing.hero.linkFree"
                            : "redesign.landing.hero.linkTaken"
                        ).replace("{slug}", link.slug)}
                      </span>
                    </p>
                    {link.available ? (
                      <>
                        <Link
                          href={registerHref}
                          onClick={() => claim(link.slug)}
                          className={cn(
                            PRIMARY_BUTTON,
                            "min-h-12 w-full px-6 sm:w-auto sm:self-start"
                          )}
                        >
                          {t("redesign.landing.hero.linkClaim")}
                        </Link>
                        <p className="text-epi-cream-50/60 m-0 text-xs">
                          {t("redesign.landing.hero.linkNote")}
                        </p>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {stores.length > 0 && (settled || status === "loading") ? (
                  <p className="text-epi-cream-50/55 m-0 px-3 pt-1 pb-1 text-[11px] tracking-[0.16em] uppercase">
                    {t("redesign.landing.hero.storesHeading")}
                  </p>
                ) : null}
                {stores.length > 0 && (settled || status === "loading") ? (
                  <ul role="listbox" className="m-0 list-none p-0">
                    {stores.map((store) => (
                      <li key={store.slug} role="option" aria-selected={false}>
                        <div className="flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2 hover:bg-white/[0.05]">
                          <span className="bg-epi-gold-500/15 text-epi-gold-300 inline-flex size-10 shrink-0 items-center justify-center rounded-full">
                            <Store aria-hidden="true" className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="text-epi-cream-50 block truncate text-[15px]">
                              {store.displayName}
                            </span>
                            <span className="text-epi-cream-50/55 block truncate text-sm">
                              epidom.fr/@{store.slug}
                            </span>
                          </span>
                          {/* To the store's phone-ordering page (its link in bio). */}
                          <a
                            href={`/@${store.slug}`}
                            onClick={() => trackEvent("hero_store_search", { cta: "open" })}
                            className={cn(SECONDARY_BUTTON, "min-h-10 shrink-0 px-4 text-xs")}
                          >
                            {t("redesign.landing.hero.searchOpen")}
                            <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {notFound ? (
                  <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
                    <p className="text-epi-cream-50/85 m-0 text-sm">
                      {t("redesign.landing.hero.searchNotFound").replace("{slug}", `@${query}`)}
                    </p>
                    <Link
                      href={registerHref}
                      onClick={() => trackEvent("hero_store_search", { cta: "register" })}
                      className={cn(PRIMARY_BUTTON, "min-h-12 px-6")}
                    >
                      {t("redesign.landing.hero.searchRegister")}
                    </Link>
                  </div>
                ) : null}

                {status === "error" ? (
                  <p className="text-epi-cream-50/85 m-0 px-4 py-8 text-center text-sm">
                    {t("redesign.landing.hero.searchError")}
                  </p>
                ) : null}

                {status === "idle" && query.length < 2 ? (
                  <p className="text-epi-cream-50/50 m-0 px-4 py-6 text-center text-sm">
                    {keepHandlesWhole(t("redesign.landing.hero.searchHint"))}
                  </p>
                ) : null}
              </div>
            </motion.div>
          </DialogPrimitive.Content>
        </div>
      </DialogPortal>
    </Dialog>
  );
}
