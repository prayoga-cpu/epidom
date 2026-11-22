"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { useOptionalI18n } from "@/components/lang/optional-i18n";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  /** Allow typing a value that isn't in `options` — shows a "Create ..." row. */
  creatable?: boolean;
  /** Label for the create row, e.g. (v) => `Create "${v}"`. */
  createLabel?: (value: string) => string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  className,
  disabled,
  creatable = false,
  createLabel,
}: ComboboxProps) {
  // Optional: the combobox can render outside an I18nProvider (tests, error fallbacks).
  const i18n = useOptionalI18n();
  const tr = (key: string, fallback: string) => (i18n ? i18n.t(key) : fallback);
  placeholder ??= tr("uiText.common.select", "Select...");
  searchPlaceholder ??= tr("common.actions.searchPlaceholder", "Search...");
  emptyText ??= tr("search.noResults", "No results found.");
  createLabel ??= (v) => tr("uiText.common.createValue", 'Create "{value}"').replace("{value}", v);
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const selected = options.find((o) => o.value === value);
  // In creatable mode `value` may not (yet) appear in `options` — still show it.
  const displayLabel = selected ? selected.label : creatable && value ? value : undefined;

  const trimmedSearch = search.trim();
  const hasExactMatch = options.some((o) => o.label.toLowerCase() === trimmedSearch.toLowerCase());
  const showCreateRow = creatable && trimmedSearch.length > 0 && !hasExactMatch;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">{displayLabel ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command shouldFilter={!creatable}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList className="overscroll-contain" style={{ maxHeight: 300, overflowY: "auto" }}>
            {!showCreateRow && <CommandEmpty>{emptyText}</CommandEmpty>}
            <CommandGroup>
              {(creatable
                ? options.filter((o) => o.label.toLowerCase().includes(trimmedSearch.toLowerCase()))
                : options
              ).map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value);
                    handleOpenChange(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      option.value === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
              {showCreateRow && (
                <CommandItem
                  value={`__create__${trimmedSearch}`}
                  onSelect={() => {
                    onChange(trimmedSearch);
                    handleOpenChange(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="truncate">{createLabel(trimmedSearch)}</span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
