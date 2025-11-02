"use client";

/**
 * Contact Sales Form Component
 *
 * Lead form for Enterprise plan inquiries.
 * Collects company information and custom requirements.
 * Simulates form submission (TODO: integrate with CRM/email).
 *
 * @component
 */

import { useState } from "react";
import { useI18n } from "@/components/lang/i18n-provider";
import { logger } from "@/lib/logger";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Check, Mail, Phone, Building, User, MessageSquare } from "lucide-react";

export function ContactSalesForm() {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Simulate form submission
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Handle success here
      logger.info("Form submitted successfully");
    } catch (error) {
      logger.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Plan Summary */}
      <Card className="border-primary rounded-xl border-2 sm:rounded-2xl">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg sm:text-xl">
              {t("pricing.plans.enterprise.title")}
            </CardTitle>
            <Badge className="bg-primary text-primary-foreground w-fit">
              {t("pricing.plans.enterprise.billing")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-600 sm:text-base">
            {t("pricing.plans.enterprise.description")}
          </p>
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">{t("payments.enterprise.included")}</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-xs text-gray-600 sm:text-sm">
                  {t("pricing.plans.enterprise.f1")}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-xs text-gray-600 sm:text-sm">
                  {t("pricing.plans.enterprise.f2")}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                <span className="text-xs text-gray-600 sm:text-sm">
                  {t("pricing.plans.enterprise.f3")}
                </span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Contact Form */}
      <Card className="rounded-xl border-2 sm:rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
            {t("payments.enterprise.form.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                <User className="h-4 w-4 sm:h-5 sm:w-5" />
                {t("payments.enterprise.form.personalInfo")}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium">
                    {t("payments.billing.firstName")}
                  </Label>
                  <Input
                    id="firstName"
                    placeholder={t("payments.billing.firstNamePlaceholder")}
                    className="h-10 sm:h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-sm font-medium">
                    {t("payments.billing.lastName")}
                  </Label>
                  <Input
                    id="lastName"
                    placeholder={t("payments.billing.lastNamePlaceholder")}
                    className="h-10 sm:h-11"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  {t("payments.billing.email")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("payments.billing.emailPlaceholder")}
                  className="h-10 sm:h-11"
                  required
                />
              </div>
            </div>

            <Separator />

            {/* Company Information */}
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                <Building className="h-4 w-4 sm:h-5 sm:w-5" />
                {t("payments.enterprise.form.companyInfo")}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="company" className="text-sm font-medium">
                  {t("payments.billing.company")}
                </Label>
                <Input
                  id="company"
                  placeholder={t("payments.billing.companyPlaceholder")}
                  className="h-10 sm:h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">
                  {t("payments.enterprise.form.phone")}
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder={t("payments.enterprise.form.phonePlaceholder")}
                  className="h-10 sm:h-11"
                  required
                />
              </div>
            </div>

            <Separator />

            {/* Requirements */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold sm:text-lg">
                {t("payments.enterprise.form.requirements")}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="requirements" className="text-sm font-medium">
                  {t("payments.enterprise.form.requirementsDesc")}
                </Label>
                <Textarea
                  id="requirements"
                  placeholder={t("payments.enterprise.form.requirementsPlaceholder")}
                  rows={4}
                  className="resize-none"
                  required
                />
              </div>
            </div>

            <Separator />

            {/* Submit Button */}
            <div className="flex justify-center sm:justify-end">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-6 py-2.5 text-base sm:w-auto sm:px-8 sm:py-3 sm:text-lg"
              >
                {isSubmitting
                  ? t("payments.enterprise.form.submitting")
                  : t("payments.enterprise.form.submit")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card className="rounded-xl border-2 sm:rounded-2xl">
        <CardContent className="pt-4 sm:pt-6">
          <div className="space-y-3 text-center sm:space-y-4">
            <h3 className="text-base font-semibold sm:text-lg">
              {t("payments.enterprise.contact.title")}
            </h3>
            <p className="text-sm text-gray-600 sm:text-base">
              {t("payments.enterprise.contact.description")}
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
              <a
                href={`mailto:${t("contact.info.email.address")}`}
                className="text-primary hover:text-primary/80 hover:bg-primary/5 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors sm:text-base"
              >
                <Mail className="h-4 w-4" />
                {t("contact.info.email.address")}
              </a>
              <a
                href={`tel:${t("contact.info.phone.number").replace(/[^\d+]/g, "")}`}
                className="text-primary hover:text-primary/80 hover:bg-primary/5 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors sm:text-base"
              >
                <Phone className="h-4 w-4" />
                {t("contact.info.phone.number")}
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
