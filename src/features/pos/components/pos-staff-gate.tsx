"use client";

import { useState, useCallback } from "react";
import { Delete, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePosSession } from "../hooks/use-pos-session";
import { cn } from "@/lib/utils";

interface PosStaffGateProps {
  storeId: string;
  children: React.ReactNode;
}

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

export function PosStaffGate({ storeId, children }: PosStaffGateProps) {
  const { isActive, storeId: sessionStoreId, login } = usePosSession();
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [shake, setShake] = useState(false);

  const verifyPin = async (enteredPin: string) => {
    setIsVerifying(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/staff/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: enteredPin }),
      });

      const json = await res.json();

      if (!res.ok) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setPin("");
        toast.error("Incorrect PIN. Try again.");
        return;
      }

      const { staff, shift } = json.data;
      login({
        storeId,
        staffId: staff.id,
        staffName: staff.name,
        staffRole: staff.role,
        shiftId: shift?.id ?? null,
      });

      if (!shift) {
        toast.info(`Welcome, ${staff.name}! No open shift — orders won't be linked to a shift until you open one.`);
      } else {
        toast.success(`Welcome, ${staff.name}!`);
      }
    } catch {
      toast.error("Failed to verify PIN. Check your connection.");
      setPin("");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKey = useCallback(
    (key: string) => {
      if (isVerifying) return;
      if (key === "del") {
        setPin((p) => p.slice(0, -1));
        return;
      }
      if (pin.length >= 4) return;
      const next = pin + key;
      setPin(next);
      if (next.length === 4) {
        verifyPin(next);
      }
    },
    [pin, isVerifying]
  );

  // If already logged in for this store, render POS directly
  if (isActive && sessionStoreId === storeId) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-muted/10">
      <div className="w-full max-w-xs space-y-8 rounded-2xl border bg-background p-8 shadow-2xl">
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight">Staff Login</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enter your 4-digit PIN</p>
        </div>

        {/* PIN dots */}
        <div className={cn("flex justify-center gap-4", shake && "animate-[shake_0.4s_ease]")}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "h-4 w-4 rounded-full border-2 transition-all",
                i < pin.length
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/30 bg-transparent"
              )}
            />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {PAD_KEYS.map((key, idx) => {
            if (key === "") return <div key={idx} />;
            return (
              <Button
                key={idx}
                variant={key === "del" ? "outline" : "secondary"}
                className="h-14 text-lg font-semibold"
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
