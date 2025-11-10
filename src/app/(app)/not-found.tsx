import { AlertTriangle, Home, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * 404 Not Found Page (App Group Level)
 *
 * Shown when user navigates to a page that doesn't exist within the (app) route group
 * This is a Server Component (not "use client")
 */
export const metadata = {
  title: "Page Not Found - EPIDOM",
  description: "The page you're looking for doesn't exist",
};

export default function NotFound() {
  return (
    <div className="from-background to-muted/20 flex min-h-screen w-full items-center justify-center bg-gradient-to-b px-4 py-12">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* 404 Icon */}
        <div className="bg-destructive/10 mx-auto flex h-20 w-20 items-center justify-center rounded-full">
          <AlertTriangle className="text-destructive h-10 w-10" />
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-6xl font-bold tracking-tight">404</h1>
          <h2 className="text-2xl font-semibold">Page Not Found</h2>
          <p className="text-muted-foreground">
            Sorry, we couldn't find the page you're looking for.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/dashboard" className="flex-1 sm:flex-auto">
            <Button variant="outline" className="w-full gap-2">
              <Home className="h-4 w-4" />
              Go to Dashboard
            </Button>
          </Link>
          <Link href="/" className="flex-1 sm:flex-auto">
            <Button className="w-full gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>

        {/* Additional Help */}
        <div className="border-muted bg-muted/50 rounded-lg border p-4 text-sm">
          <p className="text-muted-foreground">
            If you believe this is a mistake, please{" "}
            <Link href="/contact" className="text-primary font-medium hover:underline">
              contact support
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
