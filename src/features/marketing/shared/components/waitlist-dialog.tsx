"use client";

/**
 * Waitlist Dialog Component
 *
 * Lead generation form for users to join the EPIDOM waitlist.
 * Features:
 * - Client-side validation and rate limiting
 * - Three variants: default, home (larger button), sidebar (compact)
 * - Prevents navbar shift when dialog opens (scrollbar handling)
 * - Submits to external API endpoint
 * - Toast notifications for feedback
 *
 * @component
 */

import * as React from "react";
import { memo } from "react";
import {
  Dialog,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/components/lang/i18n-provider";
import { validateWaitlistForm, waitlistRateLimiter, type ValidationError } from "@/lib/validation";

/**
 * Props for WaitlistDialog component
 */
interface WaitlistDialogProps {
  /** Button variant: "default", "home" (larger), or "sidebar" (compact) */
  variant?: "default" | "home" | "sidebar";
}

export const WaitlistDialog = memo(function WaitlistDialog({
  variant = "default",
}: WaitlistDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<ValidationError[]>([]);
  const { toast } = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);
  const { t } = useI18n();

  // Fix for scrollbar issue - prevent navbar shift when dialog opens
  React.useEffect(() => {
    if (open) {
      // Calculate scrollbar width
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      // Set CSS custom property for scrollbar width
      document.documentElement.style.setProperty("--scrollbar-width", `${scrollbarWidth}px`);

      // Add class to body to apply our custom styles
      document.body.classList.add("dialog-open");

      return () => {
        // Clean up when dialog closes
        document.body.classList.remove("dialog-open");
        document.documentElement.style.removeProperty("--scrollbar-width");
      };
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors([]);

    const fd = new FormData(e.currentTarget);
    const fullName = String(fd.get("name") || "");
    const email = String(fd.get("email") || "");
    const company = String(fd.get("company") || "");

    // Validate form data
    const validation = validateWaitlistForm({
      name: fullName,
      email: email,
      company: company,
    });

    if (!validation.isValid) {
      setErrors(validation.errors);
      setIsSubmitting(false);
      toast({
        title: t("waitlist.errors.validationTitle") || t("common.validation.error"),
        description: t("waitlist.errors.validationDesc") || "Please check the form and try again.",
        variant: "destructive",
      });
      return;
    }

    // Check rate limiting
    const clientId = email; // Use email as identifier
    if (!waitlistRateLimiter.isAllowed(clientId)) {
      const remainingTime = Math.ceil(waitlistRateLimiter.getRemainingTime(clientId) / 60000);
      setIsSubmitting(false);
      toast({
        title: t("waitlist.errors.tooManyAttemptsTitle") || "Too Many Attempts",
        description:
          t("waitlist.errors.tooManyAttemptsDesc")?.replace("{minutes}", remainingTime.toString()) ||
          `Please wait ${remainingTime} minutes before trying again.`,
        variant: "destructive",
      });
      return;
    }

    const nameParts = fullName.split(" ");
    const formData = {
      name: fullName,
      email: email,
      company: company,
      timestamp: new Date().toLocaleString(),
    };

    try {
      // Send to external API that handles email + spreadsheet
      const response = await fetch("https://api.alphaomegamensgrooming.com/api/form-submissions", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          formData: {
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            company: formData.company,
            phone: "", // Waitlist form doesn't have phone
            email: formData.email,
          },
          spreadsheetUrl:
            "https://docs.google.com/spreadsheets/d/1yyI_EgH-MaQF6IRdtfWy5VZKcsdtiXWDAOIUbiQUftM/edit?gid=0#gid=0",
          emailReceiver: "mrcaoevan@gmail.com",
          metadata: {
            formType: "waitlist-form",
            subject: `New Waitlist Registration - ${formData.name}`,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit form");
      }

      toast({
        title: t("waitlist.successTitle"),
        description: t("waitlist.successDesc"),
      });

      // Track conversion for analytics
      const { trackConversion } = await import("@/lib/analytics");
      trackConversion("waitlist_signup", {
        event_category: "engagement",
        event_label: "pricing_cta",
        value: 1,
      });

      formRef.current?.reset();
      setOpen(false);
    } catch (error) {
      toast({
        title: t("waitlist.errors.submitErrorTitle") || "Error",
        description:
          error instanceof Error
            ? error.message
            : t("waitlist.errors.submitErrorDesc") || "Failed to submit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className={`h-10 rounded-full px-4 font-semibold transition-colors md:px-5 lg:px-6 ${
            variant === "home"
              ? "text-white hover:bg-gray-700"
              : variant === "sidebar"
                ? "text-white hover:opacity-80"
                : "bg-white hover:bg-gray-100"
          }`}
          style={
            variant === "home"
              ? { backgroundColor: "var(--color-brand-primary)" }
              : variant === "sidebar"
                ? { backgroundColor: "var(--color-brand-primary)" }
                : { color: "var(--color-brand-primary)" }
          }
          aria-label={t("waitlist.openButtonAria")}
        >
          <span className="text-sm md:text-sm lg:text-base">{t("waitlist.openButton")}</span>
        </Button>
      </DialogTrigger>
      <FormDialogLayout
        title={t("waitlist.title")}
        description={t("waitlist.description")}
        maxWidth="md"
        footer={
          <Button
            type="submit"
            form="waitlist-form"
            className="btn-smooth rounded-full px-6 font-semibold bg-brand-primary text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? t("waitlist.submitting") || "Submitting..." : t("waitlist.submit")}
          </Button>
        }
      >
        <form id="waitlist-form" ref={formRef} onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label
              htmlFor="name"
              className="font-semibold text-brand-primary"
            >
              {t("waitlist.fields.name")}
            </Label>
            <Input
              id="name"
              name="name"
              placeholder={t("waitlist.placeholders.name")}
              required
              autoComplete="name"
              className={`transition-colors focus:ring-2 ${
                errors.some((e) => e.field === "name") ? "border-red-500 focus:ring-red-500" : ""
              }`}
              disabled={isSubmitting}
            />
            {errors.some((e) => e.field === "name") && (
              <p className="text-sm text-red-500">
                {errors.find((e) => e.field === "name")?.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label
              htmlFor="email"
              className="font-semibold text-brand-primary"
            >
              {t("waitlist.fields.email")}
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder={t("waitlist.placeholders.email")}
              required
              autoComplete="email"
              className={`transition-colors focus:ring-2 ${
                errors.some((e) => e.field === "email") ? "border-red-500 focus:ring-red-500" : ""
              }`}
              disabled={isSubmitting}
            />
            {errors.some((e) => e.field === "email") && (
              <p className="text-sm text-red-500">
                {errors.find((e) => e.field === "email")?.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label
              htmlFor="company"
              className="font-semibold text-brand-primary"
            >
              {t("waitlist.fields.company")}
            </Label>
            <Input
              id="company"
              name="company"
              placeholder={t("waitlist.placeholders.company")}
              className={`transition-colors focus:ring-2 ${
                errors.some((e) => e.field === "company") ? "border-red-500 focus:ring-red-500" : ""
              }`}
              disabled={isSubmitting}
            />
            {errors.some((e) => e.field === "company") && (
              <p className="text-sm text-red-500">
                {errors.find((e) => e.field === "company")?.message}
              </p>
            )}
          </div>
        </form>
      </FormDialogLayout>
    </Dialog>
  );
});

