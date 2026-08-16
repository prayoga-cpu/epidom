"use client";

import { useState, useCallback, useEffect, type ReactNode } from "react";
import { Delete, Loader2, UserRound, ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { StaffRole } from "@prisma/client";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";
import { usePosSession, useClearStalePosSession } from "@/features/pos/hooks/use-pos-session";
import { useOwnerPinStatus } from "./hooks/use-owner-pin";
import { VerifyOwnerPinDialog } from "./verify-owner-pin-dialog";
import { SetOwnerPinDialog } from "./set-owner-pin-dialog";

interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  hasPin: boolean;
}

interface StoreAccessGateProps {
  storeId: string;
  /** Skip the gate entirely — plans without staff features have no persona to choose. */
  bypassGate?: boolean;
  children: ReactNode;
}

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

/**
 * First checkpoint entering a store each day — "who is using this device
 * right now?" Sits above every dashboard route (see the (dashboard)
 * layout), not just POS, because a device that's stayed logged into the
 * account owner's browser (or a staff persona left over from a previous
 * shift) should never silently hand over the Owner-only pages (Profile,
 * Billing, Staff) to whoever is physically at it next. Picking a staff
 * member reuses the same PIN as staff-switching elsewhere; picking "Owner"
 * requires the separate Owner PIN (or setting one, if this is the first
 * time) rather than trusting the Better Auth session alone, since that
 * session is exactly what a shared device leaves sitting unlocked.
 *
 * Once chosen, the choice lives in the same usePosSession store POS itself
 * reads — so /pos won't ask again on top of this (see PosStaffGate).
 */
export function StoreAccessGate({ storeId, bypassGate, children }: StoreAccessGateProps) {
  const { t } = useI18n();
  const [isMounted, setIsMounted] = useState(false);
  const { isActive, storeId: sessionStoreId, login } = usePosSession();
  useClearStalePosSession();
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [shake, setShake] = useState(false);
  const [verifyOwnerOpen, setVerifyOwnerOpen] = useState(false);
  const [setOwnerPinOpen, setSetOwnerPinOpen] = useState(false);

  const { data: pinStatus } = useOwnerPinStatus();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["staff", storeId],
    queryFn: () => apiClient.get<{ staff: StaffMember[] }>(`/stores/${storeId}/staff`),
    enabled: !bypassGate && !(isActive && sessionStoreId === storeId),
  });

  const activeStaff = data?.staff.filter((s) => s.isActive && s.role !== "OWNER") ?? [];

  const verifyPin = async (staffId: string, enteredPin: string) => {
    setIsVerifying(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/staff/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, pin: enteredPin }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (enteredPin) {
          setShake(true);
          setTimeout(() => setShake(false), 500);
          setPin("");
          toast.error(t("pages.staffAuthIncorrectPin"));
        }
        return;
      }

      const { staff, shift } = json.data;
      login({
        storeId,
        staffId: staff.id,
        staffName: staff.name,
        staffRole: staff.role,
        shiftId: shift?.id ?? null,
        allowedPages: staff.allowedPages ?? null,
      });
      toast.success(t("pages.storeAccessGateWelcome").replace("{name}", staff.name));
    } catch {
      toast.error(t("pages.staffAuthVerifyFailed"));
      setPin("");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleStaffClick = (member: StaffMember) => {
    setSelectedStaff(member);
    setPin("");
    verifyPin(member.id, "");
  };

  const handleKey = useCallback(
    (key: string) => {
      if (isVerifying || !selectedStaff) return;
      if (key === "del") {
        setPin((p) => p.slice(0, -1));
        return;
      }
      if (pin.length >= 4) return;
      const next = pin + key;
      setPin(next);
      if (next.length === 4) {
        verifyPin(selectedStaff.id, next);
      }
    },
    [pin, isVerifying, selectedStaff]
  );

  const handleContinueAsOwner = () => {
    if (pinStatus?.hasPin) setVerifyOwnerOpen(true);
    else setSetOwnerPinOpen(true);
  };

  const handleOwnerConfirmed = async () => {
    // A staff persona from earlier (or a different tab) may have left a real
    // server-side StaffSession cookie behind even though this component's
    // own client state shows nothing active — requireOwnerOnly reads that
    // cookie, not this store, so without clearing it the owner pages we just
    // unlocked client-side would still bounce the request straight back out.
    try {
      await apiClient.post(`/stores/${storeId}/staff/logout`, {});
    } catch {
      // Best-effort — proceed regardless, same as nav-user.tsx's equivalent switch-back.
    }
    login({
      storeId,
      staffId: "owner",
      staffName: "Owner",
      staffRole: "OWNER",
      shiftId: null,
      allowedPages: null,
    });
  };

  if (bypassGate) {
    return <>{children}</>;
  }

  // Prevent hydration mismatch: wait for Zustand to load from local storage.
  if (!isMounted) return null;

  if (isActive && sessionStoreId === storeId) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[calc((100dvh-120px)/var(--app-zoom,1))] w-full flex-col items-center justify-center p-4">
      <div
        className={cn(
          "bg-background relative w-full rounded-2xl border shadow-2xl",
          !selectedStaff
            ? "max-w-2xl space-y-8 p-6 md:p-8"
            : "flex max-w-xs flex-col items-center justify-center p-6"
        )}
      >
        {!selectedStaff ? (
          <>
            <div className="text-center">
              <ShieldCheck className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
              <h2 className="text-2xl font-bold tracking-tight">{t("pages.storeAccessGateTitle")}</h2>
              <p className="text-muted-foreground mt-1 text-sm">{t("pages.storeAccessGateDesc")}</p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
              </div>
            ) : activeStaff.length === 0 ? (
              <div className="space-y-2 py-6 text-center">
                <UserRound className="text-muted-foreground/50 mx-auto h-10 w-10" />
                <p className="text-muted-foreground text-sm">{t("pages.staffAuthNoActiveStaff")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {activeStaff.map((member) => (
                  <Button
                    key={member.id}
                    variant="outline"
                    className="hover:bg-muted/50 hover:border-primary/50 flex h-24 flex-col items-center justify-center gap-2 transition-colors"
                    onClick={() => handleStaffClick(member)}
                  >
                    <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full font-semibold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="w-full truncate px-2 text-center font-medium">
                      {member.name}
                    </span>
                  </Button>
                ))}
              </div>
            )}

            <div className="flex justify-center border-t pt-6">
              <Button type="button" variant="outline" size="sm" onClick={handleContinueAsOwner}>
                <KeyRound className="mr-2 h-3.5 w-3.5" />
                {t("pages.storeAccessGateContinueAsOwner")}
              </Button>
            </div>
          </>
        ) : (
          <div className="mx-auto flex w-full flex-col items-center">
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 left-2 sm:top-4 sm:left-4"
              onClick={() => {
                setSelectedStaff(null);
                setPin("");
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("common.actions.back")}
            </Button>

            <div className="mt-2 text-center sm:mt-4">
              <div className="bg-primary/10 text-primary mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold sm:mb-4 sm:h-16 sm:w-16">
                {selectedStaff.name.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-lg font-bold tracking-tight sm:text-xl">{selectedStaff.name}</h2>
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                {t("pages.staffAuthEnterPin")}
              </p>
            </div>

            <div
              className={cn(
                "mt-6 flex justify-center gap-4 sm:mt-8",
                shake && "animate-[shake_0.4s_ease]"
              )}
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "h-3 w-3 rounded-full border-2 transition-all sm:h-4 sm:w-4",
                    i < pin.length
                      ? "border-primary bg-primary"
                      : "border-muted-foreground/30 bg-transparent"
                  )}
                />
              ))}
            </div>

            <div className="mt-6 grid w-full max-w-[240px] grid-cols-3 gap-2 sm:mt-8 sm:gap-3">
              {PAD_KEYS.map((key, idx) => {
                if (key === "") return <div key={idx} />;
                return (
                  <Button
                    key={idx}
                    variant={key === "del" ? "outline" : "secondary"}
                    className="h-12 text-base font-semibold sm:h-14 sm:text-lg"
                    onClick={() => handleKey(key)}
                    disabled={isVerifying}
                  >
                    {key === "del" ? (
                      isVerifying ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Delete className="h-5 w-5" />
                      )
                    ) : (
                      key
                    )}
                  </Button>
                );
              })}
            </div>

            <p className="text-muted-foreground mt-4 text-center text-xs sm:mt-6">
              {t("pages.storeAccessGateForgotPinHint")}
            </p>
          </div>
        )}
      </div>

      <VerifyOwnerPinDialog
        open={verifyOwnerOpen}
        onOpenChange={setVerifyOwnerOpen}
        onVerified={handleOwnerConfirmed}
      />
      <SetOwnerPinDialog
        open={setOwnerPinOpen}
        onOpenChange={setSetOwnerPinOpen}
        title={t("pages.storeAccessGateSetOwnerPinTitle")}
        description={t("pages.storeAccessGateSetOwnerPinDesc")}
        onSuccess={handleOwnerConfirmed}
      />

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
