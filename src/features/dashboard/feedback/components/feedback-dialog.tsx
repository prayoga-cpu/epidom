"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFeedbackSchema, CreateFeedbackInput } from "@/lib/validation/feedback.schemas";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { useCurrentStore } from "@/features/dashboard/shared/hooks/use-current-store";
import { getAllDashboardNavItems } from "@/config/navigation.config";
import { compressImage, isValidImage, isValidImageSize } from "@/lib/utils/image-compression";
import {
  FeedbackItem,
  FeedbackStatus,
  FeedbackType,
  useDeleteFeedback,
  useMyFeedback,
  useSubmitFeedback,
  useUpdateFeedback,
} from "../hooks/use-feedback";
import { ApiSuccessResponse } from "@/types/api/responses";
import { applyServerFieldErrors } from "@/lib/utils/form-server-errors";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FEEDBACK_FORM_ID = "feedback-form";

// Badge variant + label key per feedback type
const TYPE_BADGES: Record<
  FeedbackType,
  { variant: "destructive" | "default" | "secondary"; labelKey: string }
> = {
  BUG: { variant: "destructive", labelKey: "feedback.typeBug" },
  FEATURE_SUGGESTION: { variant: "default", labelKey: "feedback.typeFeature" },
  GENERAL_FEEDBACK: { variant: "secondary", labelKey: "feedback.typeGeneral" },
};

// Badge variant + label key per ticket status
const STATUS_BADGES: Record<
  FeedbackStatus,
  { variant: "secondary" | "default" | "outline"; labelKey: string; className?: string }
> = {
  OPEN: { variant: "secondary", labelKey: "feedback.history.statusOpen" },
  IN_PROGRESS: { variant: "default", labelKey: "feedback.history.statusInProgress" },
  RESOLVED: { variant: "outline", labelKey: "feedback.history.statusResolved" },
  ARCHIVED: {
    variant: "outline",
    labelKey: "feedback.history.statusArchived",
    className: "text-muted-foreground",
  },
};

// Short human-friendly reference derived from the ticket id
const ticketRefOf = (id: string) => "#" + id.slice(-8).toUpperCase();

/**
 * Dialog for submitting feedback (bug report, feature suggestion, or general feedback)
 * Tabbed: "New feedback" (form, doubles as edit mode for own tickets) and
 * "My tickets" (list of the user's tickets with edit/delete)
 * Shows a success step with the ticket reference and community CTAs after submission
 */
export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { storeId } = useCurrentStore();
  const submitFeedback = useSubmitFeedback();
  const updateFeedback = useUpdateFeedback();
  const deleteFeedback = useDeleteFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"form" | "success">("form");
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [editingTicket, setEditingTicket] = useState<FeedbackItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeedbackItem | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  // Cache the uploaded URL per file so a failed submit doesn't re-upload the screenshot
  const uploadedRef = useRef<{ file: File; url: string } | null>(null);

  // Only fetch the ticket list while it's actually visible
  const myFeedback = useMyFeedback(open && activeTab === "history");

  // Page options from the dashboard navigation, plus a catch-all "Other"
  const pageOptions = useMemo(
    () => [
      ...getAllDashboardNavItems().map((item) => ({
        value: item.href,
        label: t(item.labelKey),
      })),
      { value: "other", label: t("feedback.pageOther") },
    ],
    [t]
  );

  // Pre-select the current page by matching the pathname (minus the store prefix)
  // against the longest nav item href
  const defaultPage = useMemo(() => {
    const path = (pathname ?? "").replace(/^\/store\/[^/]+/, "");
    const match = [...getAllDashboardNavItems()]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => path.startsWith(item.href));
    return match?.href ?? "other";
  }, [pathname]);

  // Blank form values, reused for the initial state and every reset
  const blankValues = useMemo(
    () => ({
      type: "BUG" as const,
      page: defaultPage,
      description: "",
      screenshotUrl: "",
    }),
    [defaultPage]
  );

  const form = useForm<CreateFeedbackInput>({
    resolver: zodResolver(createFeedbackSchema),
    defaultValues: blankValues,
  });

  // Revoke object URL when the preview changes or on unmount
  useEffect(() => {
    return () => {
      if (screenshotPreview) {
        URL.revokeObjectURL(screenshotPreview);
      }
    };
  }, [screenshotPreview]);

  // Reset everything when the dialog closes
  useEffect(() => {
    if (!open) {
      setStep("form");
      setActiveTab("new");
      setEditingTicket(null);
      setDeleteTarget(null);
      setSubmittedId(null);
      setScreenshotFile(null);
      setScreenshotPreview(null);
      setIsUploading(false);
      uploadedRef.current = null;
      form.reset(blankValues);
    }
  }, [open, form, blankValues]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!isValidImage(file)) {
        toast.error(t("feedback.screenshotInvalidType"));
      } else if (!isValidImageSize(file, 5)) {
        toast.error(t("feedback.screenshotTooLarge"));
      } else {
        setScreenshotFile(file);
        setScreenshotPreview(URL.createObjectURL(file));
      }
    }
    // Reset input
    e.target.value = "";
  };

  // Prefill the form with a ticket's data and switch to the form tab
  const startEditing = (ticket: FeedbackItem) => {
    setEditingTicket(ticket);
    // Drop any pending screenshot selection; edits never touch the screenshot
    setScreenshotFile(null);
    setScreenshotPreview(null);
    form.reset({
      type: ticket.type,
      page: ticket.page,
      description: ticket.description,
      screenshotUrl: "",
    });
    setActiveTab("new");
  };

  const cancelEditing = () => {
    setEditingTicket(null);
    form.reset(blankValues);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    deleteFeedback.mutate(id, {
      onSuccess: () => {
        toast.success(t("feedback.history.deleteSuccess"));
        // If the deleted ticket was being edited, drop the stale edit state
        if (editingTicket?.id === id) {
          cancelEditing();
        }
      },
      onError: () => {
        toast.error(t("feedback.history.deleteError"));
      },
    });
  };

  const handleFormSubmit = async (data: CreateFeedbackInput) => {
    // Edit mode: PATCH the existing ticket (screenshot stays unchanged server-side)
    if (editingTicket) {
      updateFeedback.mutate(
        {
          id: editingTicket.id,
          input: { type: data.type, page: data.page, description: data.description },
        },
        {
          onSuccess: () => {
            toast.success(t("feedback.history.updateSuccess"));
            setEditingTicket(null);
            form.reset(blankValues);
            setActiveTab("history");
          },
          onError: (error) => {
            const fieldSummary = applyServerFieldErrors(form, error);
            toast.error(fieldSummary || t("feedback.history.updateError"));
          },
        }
      );
      return;
    }

    let screenshotUrl = "";

    // If there's a pending screenshot, upload it first (reusing an already-uploaded URL on retry)
    if (screenshotFile) {
      if (uploadedRef.current?.file === screenshotFile) {
        screenshotUrl = uploadedRef.current.url;
      } else {
        setIsUploading(true);
        try {
          const compressedFile = await compressImage(screenshotFile);

          const formData = new FormData();
          formData.append("file", compressedFile);

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error("Upload failed");
          }

          const uploadData: ApiSuccessResponse<{ url: string }> = await response.json();
          screenshotUrl = uploadData.data.url;
          uploadedRef.current = { file: screenshotFile, url: screenshotUrl };
        } catch {
          setIsUploading(false);
          toast.error(t("feedback.screenshotUploadFailed"));
          return;
        }
        setIsUploading(false);
      }
    }

    submitFeedback.mutate(
      {
        type: data.type,
        page: data.page,
        description: data.description,
        screenshotUrl,
        storeId: storeId || undefined,
      },
      {
        onSuccess: (result) => {
          setSubmittedId(result.id);
          setStep("success");
        },
        onError: (error) => {
          if (error.status === 429) {
            toast.error(t("feedback.rateLimited"));
            return;
          }
          const fieldSummary = applyServerFieldErrors(form, error);
          toast.error(fieldSummary || t("feedback.submitError"));
        },
      }
    );
  };

  const isSubmitting = isUploading || submitFeedback.isPending || updateFeedback.isPending;

  // Block Escape / overlay / X dismissal while a submission is in flight,
  // otherwise the close-reset races the mutation and leaves a stale success step
  const handleOpenChange = (next: boolean) => {
    if (!next && isSubmitting) return;
    onOpenChange(next);
  };

  const ticketRef = submittedId ? submittedId.slice(-8).toUpperCase() : "";
  const whatsappHref =
    "https://wa.me/33781732386?text=" +
    encodeURIComponent(t("feedback.whatsappPrefill") + " #" + ticketRef);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <FormDialogLayout
        title={t("feedback.title")}
        description={t("feedback.description")}
        maxWidth="md"
        footer={
          step === "form" ? (
            // History tab never shows a submit button — the form is unmounted there,
            // so a form-targeting submit would be a silent no-op even mid-edit
            activeTab === "history" ? (
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => handleOpenChange(false)}
              >
                {t("feedback.cancel")}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                >
                  {t("feedback.cancel")}
                </Button>
                <Button type="submit" form={FEEDBACK_FORM_ID} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  {editingTicket
                    ? isSubmitting
                      ? t("feedback.history.saving")
                      : t("feedback.history.saveChanges")
                    : isSubmitting
                      ? t("feedback.submitting")
                      : t("feedback.submit")}
                </Button>
              </>
            )
          ) : (
            <Button type="button" onClick={() => onOpenChange(false)}>
              {t("feedback.done")}
            </Button>
          )
        }
      >
        {step === "form" ? (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "new" | "history")}
          >
            <TabsList className="w-full">
              <TabsTrigger value="new">{t("feedback.tabNew")}</TabsTrigger>
              <TabsTrigger value="history">{t("feedback.tabHistory")}</TabsTrigger>
            </TabsList>

            {/* New feedback / edit form */}
            <TabsContent value="new" className="mt-2">
              {/* Edit-mode banner with the ticket reference and a way out */}
              {editingTicket && (
                <div className="bg-muted/50 mb-3 flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("feedback.history.editingRef").replace(
                      "{ref}",
                      ticketRefOf(editingTicket.id)
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cancelEditing}
                    disabled={isSubmitting}
                  >
                    {t("feedback.history.cancelEdit")}
                  </Button>
                </div>
              )}

              <Form {...form}>
                <form
                  id={FEEDBACK_FORM_ID}
                  onSubmit={form.handleSubmit(handleFormSubmit)}
                  className="space-y-3 sm:space-y-4"
                >
                  {/* Feedback Type */}
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("feedback.typeLabel")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="BUG">{t("feedback.typeBug")}</SelectItem>
                            <SelectItem value="FEATURE_SUGGESTION">
                              {t("feedback.typeFeature")}
                            </SelectItem>
                            <SelectItem value="GENERAL_FEEDBACK">
                              {t("feedback.typeGeneral")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Page */}
                  <FormField
                    control={form.control}
                    name="page"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("feedback.pageLabel")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {pageOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Description */}
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("feedback.descriptionLabel")}</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            maxLength={2000}
                            rows={5}
                            placeholder={t("feedback.descriptionPlaceholder")}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Screenshot - Optional, uploaded on submit.
                      Hidden in edit mode (screenshot stays unchanged server-side) */}
                  {editingTicket ? (
                    editingTicket.screenshotUrl ? (
                      <a
                        href={editingTicket.screenshotUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground inline-block text-xs underline"
                      >
                        {t("feedback.history.screenshot")}
                      </a>
                    ) : null
                  ) : (
                    <div className="space-y-2">
                      {screenshotPreview ? (
                        <div className="relative overflow-hidden rounded-lg border">
                          <img
                            src={screenshotPreview}
                            alt="Preview"
                            className="h-40 w-full object-cover"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1.5 right-1.5 h-7 w-7 sm:top-2 sm:right-2"
                            onClick={() => {
                              setScreenshotFile(null);
                              setScreenshotPreview(null);
                            }}
                            disabled={isSubmitting}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className="hover:border-primary hover:bg-muted/50 bg-muted/30 cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors sm:p-6"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <div className="flex flex-col items-center justify-center">
                            <div className="bg-primary/10 mb-2 rounded-full p-2.5">
                              <Upload className="text-primary h-5 w-5" />
                            </div>
                            <p className="text-foreground mb-1 text-sm font-medium">
                              {t("feedback.screenshotLabel")}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {t("feedback.screenshotHint")}
                            </p>
                          </div>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleFileSelect}
                        disabled={isSubmitting}
                        className="hidden"
                      />
                    </div>
                  )}
                </form>
              </Form>
            </TabsContent>

            {/* My tickets list */}
            <TabsContent value="history" className="mt-2">
              {myFeedback.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                </div>
              ) : myFeedback.isError ? (
                <div className="py-8 text-center">
                  <p className="text-destructive text-sm font-medium">
                    {t("feedback.history.loadError")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => myFeedback.refetch()}
                  >
                    {t("feedback.history.retry")}
                  </Button>
                </div>
              ) : !myFeedback.data || myFeedback.data.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-medium">{t("feedback.history.empty")}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t("feedback.history.emptyDesc")}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myFeedback.data.map((ticket) => {
                    const typeBadge = TYPE_BADGES[ticket.type];
                    const statusBadge = STATUS_BADGES[ticket.status];
                    return (
                      <div key={ticket.id} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={typeBadge.variant}>{t(typeBadge.labelKey)}</Badge>
                          <Badge variant={statusBadge.variant} className={statusBadge.className}>
                            {t(statusBadge.labelKey)}
                          </Badge>
                          <span className="text-muted-foreground ml-auto font-mono text-xs">
                            {ticketRefOf(ticket.id)}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm">{ticket.description}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <span className="text-muted-foreground text-xs">
                            {new Date(ticket.createdAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {ticket.screenshotUrl && (
                            <a
                              href={ticket.screenshotUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground text-xs underline"
                            >
                              {t("feedback.history.screenshot")}
                            </a>
                          )}
                          <div className="ml-auto flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("feedback.history.edit")}
                              onClick={() => startEditing(ticket)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive"
                              aria-label={t("feedback.history.delete")}
                              onClick={() => setDeleteTarget(ticket)}
                              disabled={deleteFeedback.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h3 className="text-lg font-semibold">{t("feedback.successTitle")}</h3>
            <p className="text-muted-foreground text-sm">{t("feedback.successMessage")}</p>
            <p className="text-muted-foreground text-xs font-medium">
              {t("feedback.ticketRef")}: #{ticketRef}
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline">
                <a
                  href="https://discord.com/invite/FYB5HmYtg9"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessagesSquare className="mr-1.5 h-4 w-4" />
                  {t("feedback.joinDiscord")}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-1.5 h-4 w-4" />
                  {t("feedback.chatWhatsApp")}
                </a>
              </Button>
            </div>
          </div>
        )}
      </FormDialogLayout>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("feedback.history.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("feedback.history.deleteConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFeedback.isPending}>
              {t("feedback.history.deleteCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteFeedback.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("feedback.history.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
