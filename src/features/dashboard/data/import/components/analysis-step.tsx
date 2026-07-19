/**
 * Analysis Step Component
 *
 * Shows AI analysis progress with animated indicators.
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, Check, Brain, Languages, Table, Database, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/lang/i18n-provider";

interface AnalysisStepProps {
  fileName: string;
  isLoading: boolean;
}

export function AnalysisStep({ fileName, isLoading }: AnalysisStepProps) {
  const { t } = useI18n();
  const [currentStage, setCurrentStage] = useState(0);
  const [completedStages, setCompletedStages] = useState<number[]>([]);
  // Once we pass the last simulated stage, the real backend is usually still
  // working. Instead of parking the spinner on "Validation" (which looks frozen),
  // switch to an honest "Finalizing…" row with a live elapsed-time counter.
  const [finalizing, setFinalizing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Stages configuration with i18n
  const ANALYSIS_STAGES = useMemo(
    () => [
      {
        id: "language",
        label: t("import.analysis.stages.language"),
        icon: Languages,
        duration: 2000,
      },
      {
        id: "structure",
        label: t("import.analysis.stages.structure"),
        icon: Table,
        duration: 3000,
      },
      { id: "mapping", label: t("import.analysis.stages.mapping"), icon: Database, duration: 4000 },
      { id: "healing", label: t("import.analysis.stages.healing"), icon: Wand2, duration: 2000 },
      {
        id: "validation",
        label: t("import.analysis.stages.validation"),
        icon: Check,
        duration: 1500,
      },
    ],
    [t]
  );

  // Simulate stage progression for visual feedback
  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setCurrentStage((prev) => {
        const next = prev + 1;
        if (next < ANALYSIS_STAGES.length) {
          setCompletedStages((completed) => [...completed, prev]);
          return next;
        }
        // Reached the last simulated stage: mark it done and enter the
        // "finalizing" loop so the UI keeps signalling real progress.
        setCompletedStages((completed) =>
          completed.includes(prev) ? completed : [...completed, prev]
        );
        setFinalizing(true);
        return prev;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isLoading, ANALYSIS_STAGES.length]);

  // Live elapsed-time counter while analysing
  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, [isLoading]);

  // Reset on new analysis
  useEffect(() => {
    if (isLoading) {
      setCurrentStage(0);
      setCompletedStages([]);
      setFinalizing(false);
      setElapsed(0);
    }
  }, [isLoading]);

  return (
    <div className="flex flex-col items-center py-8">
      {/* Main animation */}
      <div className="relative mb-8">
        <div className="bg-primary/20 absolute inset-0 animate-ping rounded-full" />
        <div className="bg-primary text-primary-foreground relative rounded-full p-6">
          <Brain className="h-12 w-12" />
        </div>
      </div>

      <h3 className="mb-2 text-xl font-semibold">{t("import.analysis.title")}</h3>
      <p className="text-muted-foreground mb-8">{fileName}</p>

      {/* Stages progress */}
      <div className="w-full max-w-md space-y-3">
        {ANALYSIS_STAGES.map((stage, index) => {
          const Icon = stage.icon;
          // When finalizing, every simulated stage is shown as complete.
          const isCompleted = completedStages.includes(index) || finalizing;
          const isCurrent = !finalizing && currentStage === index;

          return (
            <div
              key={stage.id}
              className={cn(
                "flex items-center gap-3 rounded-lg p-3 transition-all duration-300",
                isCompleted && "bg-green-500/10 text-green-600 dark:text-green-400",
                isCurrent && "bg-primary/10 text-primary",
                !isCompleted && !isCurrent && "text-muted-foreground"
              )}
            >
              <div className="relative">
                {isCurrent ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span className={cn("text-sm", (isCompleted || isCurrent) && "font-medium")}>
                {stage.label}
              </span>
              {isCurrent && (
                <div className="ml-auto flex gap-1">
                  <div className="bg-primary h-1.5 w-1.5 animate-bounce rounded-full" />
                  <div
                    className="bg-primary h-1.5 w-1.5 animate-bounce rounded-full"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <div
                    className="bg-primary h-1.5 w-1.5 animate-bounce rounded-full"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Finalizing row — shown once the simulated stages complete but the
            backend is still working, with a live elapsed-time counter. */}
        {finalizing && (
          <div className="bg-primary/10 text-primary flex items-center gap-3 rounded-lg p-3 transition-all duration-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">{t("import.analysis.finalizing")}</span>
            <span className="text-muted-foreground ml-auto text-xs tabular-nums">{elapsed}s</span>
          </div>
        )}
      </div>

      {/* Info text */}
      <p className="text-muted-foreground mt-8 max-w-md text-center text-xs">
        {t("import.analysis.description")}
      </p>
    </div>
  );
}
