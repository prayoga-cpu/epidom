import { LoaderCircle } from "lucide-react";

export function LoadingPage({ size }: { size?: number }) {
  return (
    <div className="flex h-[calc(100vh/var(--app-zoom,1))] w-[calc(100vw/var(--app-zoom,1))] items-center justify-center">
      <LoaderCircle size={size || 40} className="animate-spin" />
    </div>
  );
}
