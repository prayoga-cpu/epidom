"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { MapPin, Phone, Mail, LucideIcon } from "lucide-react";

interface ContactItemProps {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}

function ContactItem({ icon: Icon, label, children }: ContactItemProps) {
  return (
    <div className="flex items-start gap-4 md:gap-6 lg:gap-4">
      <div className="mt-1 flex-shrink-0">
        <Icon className="h-5 w-5 md:h-6 md:w-6 lg:h-5 lg:w-5" style={{ color: "#444444" }} />
      </div>
      <div className="flex-1">
        <h3 className="text-muted-foreground mb-2 text-sm font-semibold tracking-wider uppercase md:mb-3 md:text-base lg:mb-2 lg:text-sm">
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
      <div className="space-y-6 md:space-y-8 lg:space-y-5">
          <ContactItem icon={MapPin} label={t("contact.labels.address")}>
            <div className="space-y-1 md:space-y-1.5 lg:space-y-1">
              <p className="text-sm leading-relaxed md:text-lg lg:text-base" style={{ color: "#444444" }}>
                {t("contact.info.address.line1")}
              </p>
              <p className="text-sm leading-relaxed md:text-lg lg:text-base" style={{ color: "#444444" }}>
                {t("contact.info.address.line2")}
              </p>
            </div>
          </ContactItem>

          <ContactItem icon={Phone} label={t("contact.labels.phone")}>
            <a
              href={`tel:${t("contact.info.phone.number").replace(/[^\d+]/g, "")}`}
              className="block text-sm leading-relaxed transition-opacity hover:opacity-70 md:text-lg lg:text-base"
              style={{ color: "var(--color-brand-primary)" }}
            >
              {t("contact.info.phone.number")}
            </a>
          </ContactItem>

          <ContactItem icon={Mail} label={t("contact.labels.email")}>
            <a
              href={`mailto:${t("contact.info.email.address")}`}
              className="block text-sm leading-relaxed transition-opacity hover:opacity-70 md:text-lg lg:text-base"
              style={{ color: "var(--color-brand-primary)" }}
            >
              {t("contact.info.email.address")}
            </a>
          </ContactItem>
        </div>
    </div>
  );
}
