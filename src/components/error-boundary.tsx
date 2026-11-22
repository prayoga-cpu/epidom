"use client";

import React from "react";
import { logger } from "@/lib/logger";
import { AlertTriangle, RefreshCw, RotateCw } from "lucide-react";
import { StatusScreen } from "@/components/shared/status-screen";
import { useStatusText } from "@/components/shared/status-copy";
import { isStaleChunkError, reloadForStaleChunk } from "@/lib/utils/stale-chunk-reload";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * The default fallback. A function component so it can translate, and it uses
 * useStatusText() rather than useI18n(): this boundary usually wraps the
 * I18nProvider (<ErrorBoundary><I18nProvider>…), so the fallback renders with
 * no provider above it and useI18n() would throw inside the error screen.
 *
 * It replaces the whole tree it guards, so it is the navy full-page surface
 * (its own background: readable in the app's light and dark themes and on the
 * marketing site alike).
 */
function DefaultErrorFallback({ error, resetError }: { error?: Error; resetError: () => void }) {
  const { t, locale } = useStatusText();

  return (
    <StatusScreen
      tone="brand"
      layout="page"
      locale={locale}
      announce
      icon={<AlertTriangle />}
      eyebrow={t("statusPages.error.eyebrow")}
      title={t("statusPages.error.title")}
      description={t("statusPages.error.description")}
      details={
        process.env.NODE_ENV === "development" && error ? (
          <>
            <p className="text-epi-gold-400 m-0 mb-2 text-xs font-medium">
              {t("statusPages.error.details")}
            </p>
            <pre className="m-0 max-h-48 overflow-auto text-xs break-words whitespace-pre-wrap">
              {error.toString()}
            </pre>
          </>
        ) : undefined
      }
      actions={[
        { label: t("statusPages.error.tryAgain"), icon: <RefreshCw />, onClick: resetError },
        {
          label: t("statusPages.error.reload"),
          icon: <RotateCw />,
          onClick: () => window.location.reload(),
        },
      ]}
    />
  );
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("ErrorBoundary caught an error:", error);

    // A React.lazy() import failing (stale chunk hash from an older deploy)
    // throws during render, landing here rather than in ChunkErrorReloader's
    // global listeners — recover the same way instead of showing the
    // "Something went wrong" screen for what's really just a stale tab.
    if ((error.name === "ChunkLoadError" || isStaleChunkError(error.message)) && reloadForStaleChunk()) {
      return;
    }

    this.setState({
      error,
      errorInfo,
    });

    // Error logged via logger (no external service integration)

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error!} resetError={this.resetError} />;
      }

      return <DefaultErrorFallback error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

// Note: useErrorHandler hook is now in src/hooks/use-error-handler.ts
// That version is designed for TanStack Query error handling
//
// REMOVED: withErrorBoundary HOC (YAGNI - not used anywhere in the codebase)
// If you need to wrap a component with ErrorBoundary, use <ErrorBoundary> directly:
//
// Example:
// <ErrorBoundary>
//   <YourComponent />
// </ErrorBoundary>
