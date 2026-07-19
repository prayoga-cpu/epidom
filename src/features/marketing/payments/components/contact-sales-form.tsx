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
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Check, Mail, Phone, Building, User, MessageSquare, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ContactSalesForm() {
  const { t } = useI18n();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [phone, setPhone] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData(e.currentTarget);
      const formValues = {
        firstName: (formData.get("firstName") as string)?.trim() || "",
        lastName: (formData.get("lastName") as string)?.trim() || "",
        email: (formData.get("email") as string)?.trim() || "",
        company: (formData.get("company") as string)?.trim() || "",
        phone: phone?.trim() || "",
        requirements: (formData.get("requirements") as string)?.trim() || "",
      };

      // Basic validation
      if (!formValues.email || !formValues.email.includes("@")) {
        setError(t("payments.enterprise.form.validation.email"));
        setIsSubmitting(false);
        return;
      }

      if (!formValues.firstName || !formValues.lastName) {
        setError(t("payments.enterprise.form.validation.name"));
        setIsSubmitting(false);
        return;
      }

      // TODO: Integrate with API endpoint for form submission
      // Simulate form submission
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Handle success
      setSuccess(true);
      logger.info("Enterprise form submitted successfully", { email: formValues.email });

      // Reset form after success
      e.currentTarget.reset();
      setPhone("");
    } catch (err: unknown) {
      logger.error("Form submission error:", err);
      setError(t("payments.enterprise.form.error"));
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
            <CardTitle className="text-brand-primary text-lg sm:text-xl">
              {t("pricing.plans.enterprise.title")}
            </CardTitle>
            <Badge className="bg-brand-primary border-brand-primary w-fit border text-white">
              {t("pricing.plans.enterprise.billing")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-600 sm:text-base">
            {t("pricing.plans.enterprise.description")}
          </p>
          <div className="space-y-2">
            <h4 className="text-brand-primary text-sm font-semibold">
              {t("payments.enterprise.included")}
            </h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Check className="text-brand-primary mt-0.5 h-4 w-4 flex-shrink-0" />
                <span className="text-xs text-gray-600 sm:text-sm">
                  {t("pricing.plans.enterprise.f1")}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="text-brand-primary mt-0.5 h-4 w-4 flex-shrink-0" />
                <span className="text-xs text-gray-600 sm:text-sm">
                  {t("pricing.plans.enterprise.f2")}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="text-brand-primary mt-0.5 h-4 w-4 flex-shrink-0" />
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
          <CardTitle className="text-brand-primary flex items-center gap-2 text-lg sm:text-xl">
            <MessageSquare className="text-brand-primary h-4 w-4 sm:h-5 sm:w-5" />
            {t("payments.enterprise.form.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Error Message */}
          {error && (
            <Alert
              variant="destructive"
              className="mb-4 rounded-lg border-red-200 bg-red-50 text-red-800"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {success && (
            <Alert className="mb-4 rounded-lg border-green-200 bg-green-50 text-green-800">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t("payments.enterprise.form.success")}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-brand-primary flex items-center gap-2 text-base font-semibold sm:text-lg">
                <User className="text-brand-primary h-4 w-4 sm:h-5 sm:w-5" />
                {t("payments.enterprise.form.personalInfo")}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-sm font-medium">
                    {t("payments.billing.firstName")}
                  </Label>
                  <Input
                    id="firstName"
                    name="firstName"
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
                    name="lastName"
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
                  name="email"
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
              <h3 className="text-brand-primary flex items-center gap-2 text-base font-semibold sm:text-lg">
                <Building className="text-brand-primary h-4 w-4 sm:h-5 sm:w-5" />
                {t("payments.enterprise.form.companyInfo")}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="company" className="text-sm font-medium">
                  {t("payments.billing.company")}
                </Label>
                <Input
                  id="company"
                  name="company"
                  placeholder={t("payments.billing.companyPlaceholder")}
                  className="h-10 sm:h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">
                  {t("payments.enterprise.form.phone")}
                </Label>
                <PhoneInput
                  value={phone}
                  onChange={(value) => setPhone(value || "")}
                  placeholder={t("payments.enterprise.form.phonePlaceholder")}
                  defaultCountry="FR"
                  className="h-10 sm:h-11"
                  required
                />
                {/* Hidden input for form submission */}
                <input type="hidden" name="phone" value={phone} />
              </div>
            </div>

            <Separator />

            {/* Requirements */}
            <div className="space-y-4">
              <h3 className="text-brand-primary text-base font-semibold sm:text-lg">
                {t("payments.enterprise.form.requirements")}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="requirements" className="text-sm font-medium">
                  {t("payments.enterprise.form.requirementsDesc")}
                </Label>
                <Textarea
                  id="requirements"
                  name="requirements"
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
            <h3 className="text-brand-primary text-base font-semibold sm:text-lg">
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
