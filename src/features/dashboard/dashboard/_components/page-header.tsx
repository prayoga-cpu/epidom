interface PageHeaderProps {
  pageTitle: string;
  pageDescription: string;
}

export default function PageHeader({ pageTitle, pageDescription }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-4xl font-bold">{pageTitle}</h1>
      <p className="text-muted-foreground text-sm">{pageDescription}</p>
    </div>
  );
}
