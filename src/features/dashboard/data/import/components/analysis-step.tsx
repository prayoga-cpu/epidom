/**
 * Analysis Step Component
 *
 * Shows AI analysis progress with animated indicators.
 */

"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, Check, Brain, Languages, Table, Database, Sparkles } from "lucide-react";
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

  // Stages configuration with i18n
  const ANALYSIS_STAGES = useMemo(() => [
    { id: "language", label: t("import.analysis.stages.language"), icon: Languages, duration: 2000 },
    { id: "structure", label: t("import.analysis.stages.structure"), icon: Table, duration: 3000 },
    { id: "mapping", label: t("import.analysis.stages.mapping"), icon: Database, duration: 4000 },
    { id: "healing", label: t("import.analysis.stages.healing"), icon: Sparkles, duration: 2000 },
    { id: "validation", label: t("import.analysis.stages.validation"), icon: Check, duration: 1500 },
  ], [t]);

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
        return prev;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isLoading, ANALYSIS_STAGES.length]);

  // Reset on new analysis
  useEffect(() => {
    if (isLoading) {
      setCurrentStage(0);
      setCompletedStages([]);
    }
  }, [isLoading]);

  return (
    <div className="flex flex-col items-center py-8">
      {/* Main animation */}
      <div className="relative mb-8">
        <div className="absolute inset-0 animate-ping bg-primary/20 rounded-full" />
        <div className="relative bg-primary text-primary-foreground rounded-full p-6">
          <Brain className="h-12 w-12" />
        </div>
      </div>

      <h3 className="text-xl font-semibold mb-2">{t("import.analysis.title")}</h3>
      <p className="text-muted-foreground mb-8">{fileName}</p>

      {/* Stages progress */}
      <div className="w-full max-w-md space-y-3">
        {ANALYSIS_STAGES.map((stage, index) => {
          const Icon = stage.icon;
          const isCompleted = completedStages.includes(index);
          const isCurrent = currentStage === index;

          return (
            <div
              key={stage.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-all duration-300",
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
                  <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  />
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info text */}
      <p className="text-xs text-muted-foreground mt-8 text-center max-w-md">
        {t("import.analysis.description")}
      </p>
    </div>
  );
}
