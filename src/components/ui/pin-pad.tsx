"use client";

import { Delete, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"] as const;

interface PinPadProps {
  value: string;
  onKey: (key: string) => void;
  disabled?: boolean;
  shake?: boolean;
  length?: number;
}

/** Digit dots + numeric keypad shared by every PIN-entry flow (staff login, owner PIN). */
export function PinPad({ value, onKey, disabled, shake, length = 4 }: PinPadProps) {
  return (
    <div>
      <div className={cn("flex justify-center gap-4", shake && "animate-[shake_0.4s_ease]")}>
        {Array.from({ length }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-3 w-3 rounded-full border-2 transition-all sm:h-4 sm:w-4",
              i < value.length
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
              type="button"
              variant={key === "del" ? "outline" : "secondary"}
              className="h-12 text-base font-semibold sm:h-14 sm:text-lg"
              onClick={() => onKey(key)}
              disabled={disabled}
            >
              {key === "del" ? (
                disabled ? (
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
