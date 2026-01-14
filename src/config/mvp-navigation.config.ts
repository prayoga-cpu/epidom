import {
  Upload,
  ShoppingCart,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";

/**
 * MVP Navigation Configuration
 *
 * ANTI-GRAVITY MODE: Only 3 routes allowed
 */

export interface MvpNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * MVP navigation items - LOCKED to 3 routes only
 */
export const mvpNavigation: MvpNavItem[] = [
  {
    href: "/import",
    label: "Import",
    icon: Upload,
  },
  {
    href: "/pos",
    label: "POS",
    icon: ShoppingCart,
  },
  {
    href: "/reports",
    label: "Reports",
    icon: FileSpreadsheet,
  },
];
