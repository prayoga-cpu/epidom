/**
 * Security Features Constants
 *
 * Reusable security feature definitions for payment pages.
 * Used to display trust signals and security information.
 *
 * Note: Titles and descriptions are now loaded from translation files via i18n.
 * This file only provides the icon mapping.
 */

import { Shield, CreditCard, Lock, LucideIcon } from "lucide-react";

export interface SecurityFeature {
  icon: LucideIcon;
  translationKey: string; // Key for translation (e.g., "payments.security.feature1")
}

/**
 * Security features displayed in payment form
 * These features build trust with users about payment security
 *
 * Titles and descriptions are loaded from translation files using the translationKey
 */
export const PAYMENT_SECURITY_FEATURES: SecurityFeature[] = [
  {
    icon: Shield,
    translationKey: "payments.security.feature1",
  },
  {
    icon: CreditCard,
    translationKey: "payments.security.feature2",
  },
  {
    icon: Lock,
    translationKey: "payments.security.feature3",
  },
];

