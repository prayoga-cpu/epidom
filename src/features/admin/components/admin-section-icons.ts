import {
  Activity,
  Bug,
  Gauge,
  Handshake,
  Link,
  Mail,
  Megaphone,
  Radar,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { AdminSection } from "@/config/admin-sections.config";

/** The icon each admin page uses in the nav, the /stores card and the grant dialog. */
export const ADMIN_SECTION_ICONS: Record<AdminSection["icon"], LucideIcon> = {
  Users,
  Activity,
  TrendingUp,
  Gauge,
  Megaphone,
  Radar,
  Handshake,
  Bug,
  Wrench,
  Link,
  Mail,
};
