"use client";

/**
 * Contact Info Component
 *
 * Displays company contact information (address, phone, email).
 * Reusable ContactItem component for consistent layout.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import { MapPin, Phone, Mail, LucideIcon } from "lucide-react";

/**
 * Props for ContactItem component
 */
interface ContactItemProps {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}

/** Reusable contact item with icon and content */
function ContactItem({ icon: Icon, label, children }: ContactItemProps) {
  return (
    <div className="flex items-start gap-4 md:gap-6 lg:gap-4">
      <div className="mt-1 flex-shrink-0">
        <Icon className="text-brand-primary h-5 w-5 md:h-6 md:w-6 lg:h-5 lg:w-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-brand-primary/50 mb-2 text-xs font-bold tracking-widest uppercase md:mb-3">
          {label}
        </h3>
        {children}
      </div>
    </div>
  );
}

export function ContactInfo() {
  const { t } = useI18n();

  return (
    <div>
      <div className="space-y-6 md:space-y-8 lg:space-y-8">
        <ContactItem icon={MapPin} label={t("contact.labels.address")}>
          <div className="space-y-1">
            <p className="text-brand-primary text-lg leading-relaxed font-medium">
              {t("contact.info.address.line1")}
            </p>
            <p className="text-brand-primary text-lg leading-relaxed font-medium">
              {t("contact.info.address.line2")}
            </p>
          </div>
        </ContactItem>

        <ContactItem icon={Phone} label={t("contact.labels.phone")}>
          <a
            href={`tel:${t("contact.info.phone.number").replace(/[^\d+]/g, "")}`}
            className="text-brand-primary block text-lg leading-relaxed font-medium transition-opacity hover:opacity-70"
          >
            {t("contact.info.phone.number")}
          </a>
        </ContactItem>

        <ContactItem icon={Mail} label={t("contact.labels.email")}>
          <a
            href={`mailto:${t("contact.info.email.address")}`}
            className="text-brand-primary block text-lg leading-relaxed font-medium transition-opacity hover:opacity-70"
          >
            {t("contact.info.email.address")}
          </a>
        </ContactItem>
      </div>
    </div>
  );
}
