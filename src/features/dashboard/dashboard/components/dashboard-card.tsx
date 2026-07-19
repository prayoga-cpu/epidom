import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import React from "react";

interface DashboardCardProps {
  cardTitle: string;
  cardDescription?: string;
  cardOther?: React.ReactNode;
  cardContent: React.ReactNode;
  cardClassName?: string;
}

export function DashboardCard({
  cardTitle,
  cardDescription,
  cardOther,
  cardContent,
  cardClassName,
}: DashboardCardProps) {
  return (
    <Card
      className={`flex h-full w-full max-w-full flex-col gap-0 overflow-hidden py-0 ${cardClassName || ""}`}
    >
      <CardHeader className="shrink-0 border-b px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-0.5">
            <CardTitle className="text-lg">{cardTitle}</CardTitle>
            {cardDescription && (
              <CardDescription className="text-xs">{cardDescription}</CardDescription>
            )}
          </div>
          {cardOther && <div className="shrink-0">{cardOther}</div>}
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4">
        {cardContent}
      </CardContent>
    </Card>
  );
}
