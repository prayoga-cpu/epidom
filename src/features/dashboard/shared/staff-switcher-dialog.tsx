"use client";

import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, UserRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PinPad } from "@/components/ui/pin-pad";
import { apiClient } from "@/lib/api/client";
import { usePosSession } from "@/features/pos/hooks/use-pos-session";
import { toast } from "sonner";
import type { StaffRole } from "@prisma/client";

interface StaffOption {
  id: string;
  name: string;
  role: StaffRole;
  isActive: boolean;
  hasPin: boolean;
}

interface StaffSwitcherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
}

/** Dropdown-triggered "Switch Staff" flow — select a staff member, enter their PIN. */
export function StaffSwitcherDialog({ open, onOpenChange, storeId }: StaffSwitcherDialogProps) {
  const { login } = usePosSession();
  const [selected, setSelected] = useState<StaffOption | null>(null);
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [shake, setShake] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["staff", storeId],
    queryFn: () => apiClient.get<{ staff: StaffOption[] }>(`/stores/${storeId}/staff`),
    enabled: open,
  });

  const activeStaff = (data?.staff ?? []).filter((s) => s.isActive && s.role !== "OWNER");

  const reset = () => {
    setSelected(null);
    setPin("");
    setIsVerifying(false);
  };

  const verifyPin = useCallback(
    async (staffId: string, enteredPin: string) => {
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
            toast.error("Incorrect PIN. Try again.");
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
        toast.success(`Switched to ${staff.name}`);
        reset();
        onOpenChange(false);
        // Hard navigation, not router.push: the page currently on screen may
        // have rendered as the Owner (e.g. Staff Management) before this
        // switch — only a fresh server request re-runs requireOwnerOnly /
        // requireStaffPageAccess against the new session, so staying on a
        // client-rendered owner-only page would otherwise leave it fully
        // visible until the next unrelated navigation.
        const landingPage = staff.allowedPages?.[0] ?? "/pos";
        window.location.href = `/store/${storeId}${landingPage}`;
      } catch {
        toast.error("Failed to verify PIN. Check your connection.");
        setPin("");
      } finally {
        setIsVerifying(false);
      }
    },
    [storeId, login, onOpenChange]
  );

  const handleSelect = (member: StaffOption) => {
    setSelected(member);
    setPin("");
    if (!member.hasPin) verifyPin(member.id, "");
  };

  const handleKey = (key: string) => {
    if (isVerifying || !selected) return;
    if (key === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) verifyPin(selected.id, next);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-sm">
        {!selected ? (
          <>
            <DialogHeader className="text-center">
              <DialogTitle>Switch Staff</DialogTitle>
              <DialogDescription>Choose your account to continue</DialogDescription>
            </DialogHeader>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : activeStaff.length === 0 ? (
              <div className="space-y-2 py-8 text-center">
                <UserRound className="text-muted-foreground/50 mx-auto h-10 w-10" />
                <p className="text-muted-foreground text-sm">No active staff members found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 py-2">
                {activeStaff.map((member) => (
                  <Button
                    key={member.id}
                    type="button"
                    variant="outline"
                    className="hover:bg-muted/50 hover:border-primary/50 flex h-20 flex-col items-center justify-center gap-1.5"
                    onClick={() => handleSelect(member)}
                  >
                    <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="w-full truncate px-1 text-center text-xs font-medium">
                      {member.name}
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => {
                setSelected(null);
                setPin("");
              }}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div className="mt-2 text-center">
              <div className="bg-primary/10 text-primary mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold">
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <p className="text-lg font-bold tracking-tight">{selected.name}</p>
              <p className="text-muted-foreground mt-1 text-xs">Enter your 4-digit PIN</p>
            </div>
            <div className="mt-6">
              <PinPad value={pin} onKey={handleKey} disabled={isVerifying} shake={shake} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
