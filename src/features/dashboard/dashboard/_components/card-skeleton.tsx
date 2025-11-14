import { Skeleton } from "@/components/ui/skeleton";
import DashboardCard from "./dashboard-card";

interface CardSkeletonProps {
  title?: string;
  description?: string;
  rows?: number;
}

export function CardSkeleton({ title, description, rows = 5 }: CardSkeletonProps) {
  const cardContent = (
    <div className="space-y-4 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center space-x-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <DashboardCard
      cardTitle={title || ""}
      cardDescription={description || ""}
      cardContent={cardContent}
    />
  );
}
