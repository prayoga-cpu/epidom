"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/components/lang/i18n-provider";
import { apiClient } from "@/lib/api/client";
import { storeTransferEmailSchema } from "@/lib/validation/store-transfer.schemas";

interface StoreOwnershipTransferCardProps {
  storeId: string;
  storeName?: string;
}

interface PendingTransfer {
  toEmail: string;
  expiresAt: string;
}

/**
 * Hand THIS store to someone else. The recipient gets an emailed link and the
 * transfer only happens once they accept it signed in with a verified account
 * on that address (see src/lib/services/store-transfer.service.ts). Lives on
 * the store-scoped Profile page — the staff dialog's "Owner" row links here
 * (#transfer-ownership).
 */
export function StoreOwnershipTransferCard({ storeId, storeName }: StoreOwnershipTransferCardProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  const queryKey = ["store-transfer", storeId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      apiClient.get<{ pending: PendingTransfer | null }>(`/stores/${storeId}/transfer-ownership`),
  });
  const pending = data?.pending ?? null;

  const parsedEmail = storeTransferEmailSchema.safeParse(email);
  const emailValid = parsedEmail.success;
  const nameMatches = !storeName || confirmName.trim() === storeName;

  const sendMutation = useMutation({
    mutationFn: (toEmail: string) =>
      apiClient.post(`/stores/${storeId}/transfer-ownership`, { toEmail }),
    onSuccess: (_res, toEmail) => {
      toast.success(t("pages.storeTransferSent").replace("{email}", toEmail));
      setConfirmOpen(false);
      setConfirmName("");
      setEmail("");
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => toast.error(err.message || t("pages.storeTransferSendFailed")),
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiClient.delete(`/stores/${storeId}/transfer-ownership`),
    onSuccess: () => {
      toast.success(t("pages.storeTransferCanceled"));
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => toast.error(err.message || t("pages.storeTransferCancelFailed")),
  });

  return (
    <>
      <Card id="transfer-ownership" className="scroll-mt-24 border-2">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <ArrowRightLeft className="h-5 w-5" aria-hidden />
            {t("pages.storeTransferCardTitle")}
          </CardTitle>
          {storeName && <p className="text-muted-foreground text-sm">{storeName}</p>}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">{t("pages.storeTransferCardDesc")}</p>

          {isLoading ? (
            <div className="text-muted-foreground py-2 text-sm">{t("common.loading")}</div>
          ) : pending ? (
            <div className="bg-muted/30 flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-2">
                <Mail className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div className="min-w-0 text-sm">
                  <p className="font-medium break-words">
                    {t("pages.storeTransferPending").replace("{email}", pending.toEmail)}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t("pages.storeTransferPendingExpires").replace(
                      "{date}",
                      new Date(pending.expiresAt).toLocaleDateString()
                    )}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 sm:h-9"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("pages.storeTransferCancel")
                )}
              </Button>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (emailValid) setConfirmOpen(true);
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="store-transfer-email">{t("pages.storeTransferEmailLabel")}</Label>
                <Input
                  id="store-transfer-email"
                  type="email"
                  autoComplete="off"
                  autoCapitalize="none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.replace(/\s/g, ""))}
                  placeholder="new.owner@example.com"
                  className="h-11 sm:h-9"
                />
                {email.length > 0 && !emailValid && (
                  <p className="text-destructive text-xs">
                    {parsedEmail.error?.issues[0]?.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="h-11 w-full sm:h-9 sm:w-auto" disabled={!emailValid}>
                {t("pages.storeTransferSend")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) setConfirmName("");
        }}
      >
        <FormDialogLayout
          maxWidth="sm"
          title={t("pages.storeTransferConfirmTitle")}
          description={t("pages.storeTransferConfirmDesc")
            .replace("{email}", parsedEmail.success ? parsedEmail.data : email)
            .replace("{store}", storeName ?? "")}
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                {t("common.actions.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => parsedEmail.success && sendMutation.mutate(parsedEmail.data)}
                disabled={!emailValid || !nameMatches || sendMutation.isPending}
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("pages.storeTransferSend")
                )}
              </Button>
            </>
          }
        >
          {storeName && (
            <div className="space-y-2">
              <Label htmlFor="store-transfer-confirm-name">
                {t("pages.storeTransferConfirmLabel").replace("{store}", storeName)}
              </Label>
              <Input
                id="store-transfer-confirm-name"
                autoComplete="off"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder={storeName}
              />
            </div>
          )}
        </FormDialogLayout>
      </Dialog>
    </>
  );
}
