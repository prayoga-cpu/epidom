"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Internal building block for <CountrySelect> and the "Other country" currency
 * picker: a searchable single-select combobox (Popover + cmdk Command) with
 * custom option rendering, accent-insensitive search over several names per
 * option, and 44 px rows. Not exported from the barrel.
 *
 * Why not the shared <Combobox>: it renders a plain label only, searches the
 * label only, and its non-modal popover can't be scrolled by wheel/touch when
 * it opens inside a Dialog (the Dialog's scroll lock swallows events outside
 * the dialog, and the popover is portalled out of it). A modal Popover takes
 * over the scroll lock while it is open, so the list scrolls on iPad too.
 */

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Rendered before the label (a flag, a code…), in the list and the trigger. */
  leading?: React.ReactNode;
  /** Extra names the search matches (English name, code, aliases). */
  keywords?: string[];
  /** Options are grouped by section in ascending order, with a divider between sections. */
  section?: number;
  /** Always listed, even when the search matches nothing (e.g. "Other country"). */
  pinned?: boolean;
}

export interface SearchSelectProps {
  options: SearchSelectOption[];
  value?: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  onBlur?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
}

/** Lowercase, accents stripped, typographic apostrophes folded: "Côte d’Ivoire" → "cote d'ivoire". */
export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[‘’ʼ]/g, "'").toLowerCase().trim();
}

/** Letters and digits only: "états-unis" → "étatsunis", "cote d'ivoire" → "cotedivoire". */
function compactSearchText(value: string): string {
  return value.replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * cmdk filter: 1 when a name starts with the query, 0.8 when one of its words
 * does, 0.5 when it merely contains it — or contains it once spaces, hyphens
 * and apostrophes are ignored on both sides, so "royaume uni" finds
 * "Royaume-Uni" and "cote divoire" finds "Côte d’Ivoire" — 0 otherwise. The
 * item's `value` (a code) only matches exactly, so typing "i" doesn't surface
 * every code with an I.
 */
export function searchSelectFilter(value: string, search: string, keywords?: string[]): number {
  const query = normalizeSearchText(search);
  if (!query) return 1;
  if (normalizeSearchText(value) === query) return 1;
  const names = (keywords ?? []).map(normalizeSearchText);
  if (names.some((name) => name.startsWith(query))) return 1;
  if (names.some((name) => name.split(/[\s'\-()]+/).some((word) => word.startsWith(query)))) {
    return 0.8;
  }
  if (names.some((name) => name.includes(query))) return 0.5;
  // Separator-insensitive fallback. The empty check keeps a query of only
  // punctuation ("-") from matching every option.
  const compactQuery = compactSearchText(query);
  if (compactQuery && names.some((name) => compactSearchText(name).includes(compactQuery))) {
    return 0.5;
  }
  return 0;
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  id,
  name,
  className,
  onBlur,
  ref,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-labelledby": ariaLabelledBy,
}: SearchSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const selected = options.find((option) => option.value === value);

  const sections = React.useMemo(() => {
    const bySection = new Map<number, SearchSelectOption[]>();
    for (const option of options) {
      const key = option.section ?? 0;
      const list = bySection.get(key);
      if (list) list.push(option);
      else bySection.set(key, [option]);
    }
    return [...bySection.entries()].sort(([a], [b]) => a - b).map(([, list]) => list);
  }, [options]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSearch("");
      onBlur?.();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          id={id}
          name={name}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-labelledby={ariaLabelledBy}
          disabled={disabled}
          className={cn("h-11 w-full min-w-0 justify-between px-3 font-normal", className)}
        >
          <span
            className={cn(
              "flex min-w-0 items-center gap-2 truncate",
              !selected && "text-muted-foreground"
            )}
          >
            {selected?.leading ? (
              <span aria-hidden className="shrink-0 text-base leading-none">
                {selected.leading}
              </span>
            ) : null}
            <span className="truncate">{selected ? selected.label : placeholder}</span>
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-[min(18rem,calc(100vw/var(--app-zoom,1)-2rem))] p-0"
        align="start"
      >
        <Command filter={searchSelectFilter}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
            className="h-11"
          />
          <CommandList
            className="max-h-[min(20rem,calc(45dvh/var(--app-zoom,1)))] overscroll-contain"
          >
            <CommandEmpty>{emptyText}</CommandEmpty>
            {sections.map((list, index) => (
              <React.Fragment key={index}>
                {index > 0 ? <CommandSeparator /> : null}
                {/* cmdk hides a group none of whose items match, even one holding a pinned item. */}
                <CommandGroup forceMount={list.some((option) => option.pinned) || undefined}>
                  {list.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      keywords={[option.label, ...(option.keywords ?? [])]}
                      // Explicit false: an item otherwise inherits its group's forceMount.
                      forceMount={option.pinned ?? false}
                      onSelect={() => {
                        onChange(option.value);
                        handleOpenChange(false);
                      }}
                      className="min-h-11 gap-2 py-2"
                    >
                      {option.leading ? (
                        <span
                          aria-hidden
                          className="w-5 shrink-0 text-center text-base leading-none"
                        >
                          {option.leading}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      <Check
                        className={cn(
                          "size-4 shrink-0",
                          option.value === value ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </React.Fragment>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
