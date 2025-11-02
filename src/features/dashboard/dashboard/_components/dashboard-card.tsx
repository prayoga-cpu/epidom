import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import React from "react";

interface DashboardCardProps {
  cardTitle: string;
  cardDescription?: string;
  cardOther?: React.ReactNode;
  cardContent: React.ReactNode;
  cardClassName?: string;
}

export default function DashboardCard({
  cardTitle,
  cardDescription,
  cardOther,
  cardContent,
  cardClassName,
}: DashboardCardProps) {
  return (
    <Card className={cardClassName}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{cardTitle}</CardTitle>
            <CardDescription className="text-xs">{cardDescription}</CardDescription>
          </div>
          {cardOther}
        </div>
      </CardHeader>
      <CardContent className="-mx-2 h-64 sm:mx-0 sm:h-72">{cardContent}</CardContent>
    </Card>
  );
}
