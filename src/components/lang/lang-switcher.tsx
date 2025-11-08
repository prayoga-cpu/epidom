"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "./i18n-provider";
import { cn } from "@/lib/utils";
import { Languages } from "lucide-react";

const opts = [
  { label: "English", value: "en", short: "EN" },
  { label: "Français", value: "fr", short: "FR" },
  { label: "Indonesia", value: "id", short: "ID" },
] as const;

export default function LangSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useI18n();
  const currentLang = opts.find((opt) => opt.value === locale);

  return (
    <Select value={locale} onValueChange={setLocale}>
      <SelectTrigger
        size="default"
        className={cn(
          "bg-background text-foreground h-9 rounded-full px-3 font-semibold",
          className
        )}
      >
        <Languages className="h-4 w-4 shrink-0" />
        <SelectValue>{currentLang?.short || "EN"}</SelectValue>
      </SelectTrigger>
      <SelectContent align="center">
        {opts.map(({ label, value, short }) => (
          <SelectItem key={value} value={value}>
            <span className="flex items-center gap-2">
              <span className="font-semibold">{short}</span>
              <span className="text-muted-foreground">·</span>
              <span>{label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
