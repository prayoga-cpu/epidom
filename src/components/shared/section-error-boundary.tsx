"use client";

/**
 * Section Error Boundary
 *
 * Catches errors in marketing sections and displays a fallback UI.
 * Prevents entire page from crashing if one section fails.
 *
 * @component
 */

import { Component, ReactNode } from "react";
import { useStatusText } from "./status-copy";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  sectionName?: string;
}

interface State {
  hasError: boolean;
}

/**
 * The default fallback: a quiet strip in the place of the section, in the
 * visitor's language. It inherits the text colour (sections sit on navy or on
 * the cream panel) and only adds the gold hairline and a pill to reload.
 * `sectionName` is an internal English label: it goes in a data attribute for
 * debugging, never in the visible copy.
 */
function SectionErrorFallback({ sectionName }: { sectionName?: string }) {
  const { t, locale } = useStatusText();
  const thai = locale === "th";

  return (
    <section
      role="status"
      data-section-error={sectionName || undefined}
      className="px-5 py-14 sm:py-20"
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
        <div aria-hidden="true" className="epi-gold-rule mb-2 w-40" />
        <p className={thai ? "m-0 text-base leading-[1.6] font-medium" : "m-0 text-base font-medium"}>
          {t("statusPages.section.title")}
        </p>
        <p
          className={
            thai ? "m-0 text-sm leading-[1.7] opacity-70" : "m-0 text-sm leading-relaxed opacity-70"
          }
        >
          {t("statusPages.section.description")}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="focus-visible:outline-epi-gold-500 mt-2 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border border-current/30 bg-transparent px-5 text-sm font-medium transition-colors duration-150 hover:border-current/60 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t("statusPages.error.reload")}
        </button>
      </div>
    </section>
  );
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error(`Error in ${this.props.sectionName || "section"}:`, error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback or default minimal UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <SectionErrorFallback sectionName={this.props.sectionName} />;
    }

    return this.props.children;
  }
}
