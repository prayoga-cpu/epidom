"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import type { LandingNavEntry } from "@/config/navigation.config";
import { PlanBadge } from "@/features/marketing/home/components/landing-ui";
import { cn } from "@/lib/utils";
import type { ResolvedMenu } from "../lib/landing-nav";

/** The header's top-level text: 14px, brighter than before (it sits on glass over photos). */
export const navTextClass = (active: boolean) =>
  cn(
    "transition-colors",
    active
      ? "font-semibold text-[var(--epi-cream-50)]"
      : "text-[var(--epi-cream-50)]/75 hover:text-[var(--epi-cream-50)]"
  );

export const navTextStyle = (active: boolean): React.CSSProperties => ({
  fontFamily: "var(--epi-font-body)",
  fontSize: 14,
  fontWeight: active ? 600 : 400,
  letterSpacing: "0.01em",
});

/** How long the menu waits to close after the pointer leaves, so a slip across the gap does not shut it. */
const CLOSE_DELAY_MS = 140;

/**
 * A header entry that opens a menu: Products (its label is a link to /products,
 * with a chevron beside it that opens the menu) and Resources (one button).
 *
 * A disclosure, not a hover-only menu: it opens on click or Enter on the
 * chevron, and also when the pointer rests on it on a device that has one;
 * Escape closes it and returns focus to the button, as does clicking
 * elsewhere, tabbing out, or choosing a link. The links stay in the page while
 * it is shut (the `hidden` attribute), so they are still there for crawlers.
 * Only one menu is open at a time: the header holds which, and closes it on
 * every page change.
 */
export function DesktopNavMenu({
  entry,
  menu,
  href,
  active,
  open,
  setOpen,
  closeMenu,
}: {
  entry: LandingNavEntry;
  menu: ResolvedMenu;
  /** The entry's own page, localized: present for Products, absent for Resources. */
  href?: string;
  active: boolean;
  open: boolean;
  setOpen: (id: string) => void;
  /** Closes this menu only if it is still the open one: a delayed close must not shut the menu the pointer moved on to. */
  closeMenu: (id: string) => void;
}) {
  const { t } = useI18n();
  const rootRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const panelId = useId();
  const label = t(entry.labelKey);
  const wide = menu.sections.length > 1;

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  // On a device with a hover, resting the pointer already opened the menu: the click that follows
  // (detail > 0 is a pointer click; a keyboard Enter or Space has detail 0) must not shut it again.
  const toggle = (event: React.MouseEvent) => {
    if (open && event.detail > 0 && window.matchMedia?.("(hover: hover)").matches) return;
    if (open) closeMenu(entry.id);
    else setOpen(entry.id);
  };
  const hovers = () => window.matchMedia?.("(hover: hover)").matches ?? false;

  useEffect(() => cancelClose, []);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu(entry.id);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, closeMenu, entry.id]);

  const chevron = (
    <ChevronDown
      aria-hidden="true"
      className={cn("size-3.5 shrink-0 transition-transform duration-200", open && "rotate-180")}
    />
  );
  const pill = cn("flex items-center rounded-full", active ? "bg-white/[0.08]" : "bg-transparent");

  return (
    <li
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        if (!hovers()) return;
        cancelClose();
        setOpen(entry.id);
      }}
      onMouseLeave={() => {
        if (!hovers()) return;
        cancelClose();
        closeTimer.current = window.setTimeout(() => closeMenu(entry.id), CLOSE_DELAY_MS);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          closeMenu(entry.id);
          triggerRef.current?.focus();
        }
      }}
      onBlur={(event) => {
        // Tabbing out of the menu closes it; a click elsewhere is the mousedown above.
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) {
          closeMenu(entry.id);
        }
      }}
    >
      <div className={pill} data-current={active ? "" : undefined}>
        {href ? (
          <>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(navTextClass(active), "py-1 pr-1 pl-3")}
              style={navTextStyle(active)}
            >
              {label}
            </Link>
            <button
              ref={triggerRef}
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={t("common.nav.openSubmenu").replace("{name}", label)}
              onClick={toggle}
              className={cn(navTextClass(active), "cursor-pointer py-1 pr-2.5 pl-0.5")}
            >
              {chevron}
            </button>
          </>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={toggle}
            className={cn(
              navTextClass(active),
              "inline-flex cursor-pointer items-center gap-1 py-1 pr-2.5 pl-3"
            )}
            style={navTextStyle(active)}
          >
            {label}
            {chevron}
          </button>
        )}
      </div>

      {/* The padding on top is a transparent bridge from the pill to the panel, so the pointer can cross the gap. */}
      <div
        id={panelId}
        hidden={!open}
        className="epi-nav-panel absolute top-full left-1/2 z-10 -translate-x-1/2 pt-4"
      >
        <div
          className={cn(
            "rounded-2xl border border-white/10 bg-[#0c1530]/95 p-2 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl",
            wide ? "grid w-[30rem] grid-cols-2 gap-x-2" : "w-[22rem]"
          )}
        >
          {menu.sections.map((section, i) => (
            <div key={i}>
              {section.headingKey ? (
                <p className="text-epi-cream-50/50 m-0 px-3 pt-2 pb-1 text-[11px] tracking-[0.14em] uppercase">
                  {t(section.headingKey)}
                </p>
              ) : null}
              <ul className="m-0 list-none p-0">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => closeMenu(entry.id)}
                      className="focus-visible:outline-epi-gold-300 block rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.06] focus-visible:outline-2"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-epi-cream-50 text-[14px] font-semibold">
                          {t(link.labelKey)}
                        </span>
                        {link.plan ? (
                          <PlanBadge plan={link.plan} className="px-2 py-0.5 text-[10px]" />
                        ) : null}
                      </span>
                      {link.descKey ? (
                        <span className="text-epi-cream-50/65 mt-0.5 block text-[13px] leading-snug">
                          {t(link.descKey)}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {menu.footer ? (
            <Link
              href={menu.footer.href}
              onClick={() => closeMenu(entry.id)}
              className="text-epi-gold-300 hover:text-epi-gold-400 focus-visible:outline-epi-gold-300 col-span-full mt-1 block rounded-xl border-t border-white/10 px-3 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-2"
            >
              {t(menu.footer.labelKey)}
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}
