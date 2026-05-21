"use client";

import { useI18n } from "@/components/lang/i18n-provider";
import { MapPin, MessageCircle, Mail, LucideIcon } from "lucide-react";

interface ContactItemProps {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}

function ContactItem({ icon: Icon, label, children }: ContactItemProps) {
  return (
    <div className="flex items-start gap-4">
      <div className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-primary/10">
        <Icon className="text-brand-primary h-5 w-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-brand-primary/50 mb-1.5 text-xs font-bold tracking-widest uppercase">
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
    <div className="space-y-8">
      <ContactItem icon={MapPin} label={t("contact.labels.address")}>
        <p className="text-brand-primary text-lg font-medium leading-relaxed">
          {t("contact.info.address.line1")}
        </p>
      </ContactItem>

      <ContactItem icon={MessageCircle} label="WhatsApp">
        <a
          href="https://wa.me/6281234567890"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-primary block text-lg font-medium leading-relaxed transition-opacity hover:opacity-70"
        >
          {t("contact.info.phone.number")}
        </a>
      </ContactItem>

      <ContactItem icon={Mail} label={t("contact.labels.email")}>
        <a
          href={`mailto:${t("contact.info.email.address")}`}
          className="text-brand-primary block text-lg font-medium leading-relaxed transition-opacity hover:opacity-70"
        >
          {t("contact.info.email.address")}
        </a>
      </ContactItem>
    </div>
  );
}
