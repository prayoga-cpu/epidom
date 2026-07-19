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

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  sectionName?: string;
}

interface State {
  hasError: boolean;
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

      return (
        <section className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-sm text-gray-400">
              Unable to load {this.props.sectionName || "this section"}
            </p>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}
