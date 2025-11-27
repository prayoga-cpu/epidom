import { LoaderCircle } from "lucide-react";

export function LoadingPage({ size }: { size?: number }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <LoaderCircle size={size || 40} className="animate-spin" />
    </div>
  );
}
