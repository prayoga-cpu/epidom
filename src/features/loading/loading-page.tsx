import { LoaderCircle } from "lucide-react";

export default function LoadingPage({ size }: { size?: number }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <LoaderCircle size={size || 40} className="animate-spin" />
    </div>
  );
}
