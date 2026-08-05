"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  UserRound,
  Boxes,
  Database,
  AlertTriangle,
  Package,
  UtensilsCrossed,
  ShoppingCart,
  Store,
  FileText,
  Settings,
} from "lucide-react";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrentStore } from "./hooks/use-current-store";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";

interface SearchItem {
  id: string;
  title: string;
  description?: string;
  href: string;
  icon: React.ReactNode;
  category: string;
  /** Nav-config href (e.g. "/management") this item's visibility is gated
   * on for a staff persona — defaults to always visible when omitted. */
  gateHref?: string;
}

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({ open, onOpenChange }: GlobalSearchDialogProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { storeId } = useCurrentStore();
  const posSession = usePosSession();
  const [searchQuery, setSearchQuery] = React.useState("");

  const actingAsStaff =
    posSession.isActive && posSession.storeId === storeId && posSession.staffRole !== "OWNER";
  const staffAllowedPages = actingAsStaff ? (posSession.allowedPages ?? []) : null;

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

  // Define all searchable items
  const searchItems: SearchItem[] = React.useMemo(() => {
    if (!storeId) return [];

    return [
      // Main Navigation
      {
        id: "dashboard",
        title: t("nav.dashboard"),
        description: t("dashboard.description"),
        href: `/store/${storeId}/dashboard`,
        icon: <LayoutDashboard className="size-4" />,
        category: t("search.categories.navigation"),
        gateHref: "/dashboard",
      },
      {
        id: "profile",
        title: t("nav.profile"),
        description: t("profile.title"),
        href: `/store/${storeId}/profile`,
        icon: <UserRound className="size-4" />,
        category: t("search.categories.navigation"),
        gateHref: "/profile",
      },
      {
        id: "management",
        title: t("nav.management"),
        description: t("management.supplierOrders.title"),
        href: `/store/${storeId}/management`,
        icon: <Boxes className="size-4" />,
        category: t("search.categories.navigation"),
        gateHref: "/management",
      },
      {
        id: "data",
        title: t("nav.data"),
        description: t("data.materials.pageTitle"),
        href: `/store/${storeId}/data`,
        icon: <Database className="size-4" />,
        category: t("search.categories.navigation"),
        gateHref: "/data",
      },
      {
        id: "alerts",
        title: t("nav.alerts"),
        description: t("alerts.title"),
        href: `/store/${storeId}/alerts`,
        icon: <AlertTriangle className="size-4" />,
        category: t("search.categories.navigation"),
        gateHref: "/alerts",
      },

      // Management Section
      {
        id: "supplier-orders",
        title: t("management.supplierOrders.title"),
        description: t("management.supplierOrders.description"),
        href: `/store/${storeId}/management/supplier-orders`,
        icon: <FileText className="size-4" />,
        category: t("search.categories.management"),
        gateHref: "/management",
      },
      {
        id: "recipe-production",
        title: t("management.recipeProduction.title"),
        description: t("management.recipeProduction.description"),
        href: `/store/${storeId}/management/recipe-production`,
        icon: <UtensilsCrossed className="size-4" />,
        category: t("search.categories.management"),
        gateHref: "/management",
      },
    ];
  }, [t, storeId]);

  // Filter items based on search query
  const filteredItems = React.useMemo(() => {
    // Filter out items with undefined/invalid translations, and any page a
    // staff persona isn't granted access to.
    const validItems = searchItems.filter(
      (item) =>
        item.title &&
        item.category &&
        typeof item.title === "string" &&
        typeof item.category === "string" &&
        (!staffAllowedPages || !item.gateHref || staffAllowedPages.includes(item.gateHref))
    );

    if (!searchQuery) return validItems;

    const query = searchQuery.toLowerCase();
    return validItems.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        item.category.toLowerCase().includes(query)
    );
  }, [searchQuery, searchItems, staffAllowedPages]);

  // Group filtered items by category
  const groupedItems = React.useMemo(() => {
    const groups = new Map<string, SearchItem[]>();

    filteredItems.forEach((item) => {
      const existing = groups.get(item.category) || [];
      groups.set(item.category, [...existing, item]);
    });

    return Array.from(groups.entries());
  }, [filteredItems]);

  const handleSelect = (href: string) => {
    onOpenChange(false);
    router.push(href);
    setSearchQuery("");
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("search.title")}
      description={t("search.description")}
    >
      <CommandInput
        placeholder={t("search.placeholder")}
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>{t("search.noResults")}</CommandEmpty>
        {groupedItems.map(([category, items], index) => (
          <React.Fragment key={category}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={category}>
              {items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.title}
                  onSelect={() => handleSelect(item.href)}
                >
                  {item.icon}
                  <div className="flex flex-col">
                    <span className="font-medium">{item.title}</span>
                    {item.description && (
                      <span className="text-muted-foreground text-xs">{item.description}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
