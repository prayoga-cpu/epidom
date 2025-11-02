import { StoreInfoBadge } from "./store-info-badge";

interface PageHeaderProps {
  pageTitle: string;
  pageDescription: string;
}

export default function PageHeader({
  pageTitle,
  pageDescription,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-bold">{pageTitle}</h1>
        <StoreInfoBadge />
      </div>
      <p className="text-muted-foreground text-sm">{pageDescription}</p>
    </div>
  );
}
