"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Plus, CheckSquare } from "lucide-react";
import { SectionHeader, ActionButtons, ActionButton } from "./section-header";
import { responsive } from "@/lib/utils/responsive";

interface SectionLoadingStateProps {
  title: string;
  exportLabel?: string;
  addLabel?: string;
  selectLabel?: string;
}

/**
 * SectionLoadingState Component
 *
 * Reusable loading state for data sections.
 * Displays a card with disabled header buttons and a centered spinner.
 * Follows DRY principle by centralizing the loading state pattern.
 */
export function SectionLoadingState({
  title,
  exportLabel,
  addLabel,
  selectLabel,
}: SectionLoadingStateProps) {
  return (
    <Card className={responsive.cardWrapper}>
      <CardHeader className={responsive.cardHeader}>
        <div className={responsive.header}>
          <CardTitle className="text-lg font-bold">{title}</CardTitle>
          <div className={responsive.buttonGroup}>
            {exportLabel && (
              <ActionButton variant="outline" size="sm" disabled>
                <Download className="mr-1 hidden h-4 w-4 sm:inline" />
                {exportLabel}
              </ActionButton>
            )}
            {addLabel && (
              <ActionButton size="sm" disabled>
                <Plus className="mr-1 hidden h-4 w-4 sm:inline" />
                {addLabel}
              </ActionButton>
            )}
            {selectLabel && (
              <ActionButton variant="outline" size="sm" disabled>
                <CheckSquare className="mr-1 hidden h-4 w-4 sm:inline" />
                {selectLabel}
              </ActionButton>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </CardContent>
    </Card>
  );
}
