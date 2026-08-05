"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Delete, Loader2, UserRound, ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePosSession } from "../hooks/use-pos-session";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { StaffRole } from "@prisma/client";
import { useI18n } from "@/components/lang/i18n-provider";

interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  hasPin: boolean;
}

interface PosStaffGateProps {
  storeId: string;
  bypassGate?: boolean;
  children: React.ReactNode;
}

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

export function PosStaffGate({ storeId, bypassGate, children }: PosStaffGateProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const { isActive, storeId: sessionStoreId, login, checkStale } = usePosSession();
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [shake, setShake] = useState(false);

  React.useEffect(() => {
    // A persona left logged in from a previous day must be cleared before
    // anything below reads isActive, or it'd trust a session that should
    // already be gone (real enforcement is the server-side StaffSession
    // expiry — this just keeps this gate's own render honest immediately).
    checkStale();
    setIsMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (bypassGate && !(isActive && sessionStoreId === storeId)) {
      login({
        storeId,
        staffId: "owner",
        staffName: "Owner",
        staffRole: "OWNER",
        shiftId: null,
      });
    }
  }, [bypassGate, isActive, sessionStoreId, storeId, login]);

  const { data, isLoading } = useQuery({
    queryKey: ["staff", storeId],
    queryFn: () => apiClient.get<{ staff: StaffMember[] }>(`/stores/${storeId}/staff`),
    enabled: !(isActive && sessionStoreId === storeId),
  });

  // Exclude role OWNER — that persona is functionally the account owner
  // already (e.g. seeded rows), not a restrictable sub-account to pick.
  const activeStaff = data?.staff.filter((s) => s.isActive && s.role !== "OWNER") ?? [];
  const autoLoginAttempted = React.useRef(false);

  React.useEffect(() => {
    if (
      activeStaff.length === 1 &&
      !activeStaff[0].hasPin &&
      !isActive &&
      !isVerifying &&
      !autoLoginAttempted.current
    ) {
      autoLoginAttempted.current = true;
      setSelectedStaff(activeStaff[0]);
      verifyPin(activeStaff[0].id, "");
    }
  }, [activeStaff, isActive, isVerifying]);

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

      if (!shift) {
        toast.info(t("pages.posStaffGateWelcomeNoShift").replace("{name}", staff.name));
      } else {
        toast.success(t("pages.posStaffGateWelcome").replace("{name}", staff.name));
      }
    } catch {
      toast.error(t("pages.staffAuthVerifyFailed"));
      setPin("");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleEditPin = () => {
    if (!selectedStaff) return;
    router.push(`/store/${storeId}/staff?editStaffId=${selectedStaff.id}`);
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

  // BEST PERFORMANCE: If bypassed, render immediately. Server and Client match exactly, so no hydration error!
  if (bypassGate) {
    return <>{children}</>;
  }

  // Prevent hydration mismatch: wait for Zustand to load from local storage
  if (!isMounted) return null;

  // If already logged in for this store, render POS directly
  if (isActive && sessionStoreId === storeId) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] w-full flex-col items-center justify-center p-4">
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
              <h2 className="text-2xl font-bold tracking-tight">{t("pages.posStaffGateTitle")}</h2>
              <p className="text-muted-foreground mt-1 text-sm">{t("pages.posStaffGateDesc")}</p>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
              </div>
            ) : activeStaff.length === 0 ? (
              <div className="space-y-2 py-12 text-center">
                <UserRound className="text-muted-foreground/50 mx-auto h-12 w-12" />
                <p className="text-muted-foreground">{t("pages.staffAuthNoActiveStaff")}</p>
                <p className="text-muted-foreground text-sm">{t("pages.posStaffGateCreateHint")}</p>
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

            {/* The account owner should never be stuck behind a staff PIN
                pick just to use POS themselves. */}
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground text-xs"
                onClick={() =>
                  login({
                    storeId,
                    staffId: "owner",
                    staffName: "Owner",
                    staffRole: "OWNER",
                    shiftId: null,
                    allowedPages: null,
                  })
                }
              >
                {t("pages.posStaffGateContinueAsOwner")}
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

            {/* PIN dots */}
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

            {/* Numpad */}
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

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground mt-4 gap-1.5 sm:mt-6"
              onClick={handleEditPin}
            >
              <KeyRound className="h-3.5 w-3.5" />
              {t("pages.staffAuthForgotPin")}
            </Button>
          </div>
        )}
      </div>

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
