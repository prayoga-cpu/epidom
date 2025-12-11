"use client";

/**
 * CTA Section Component
 *
 * Call-to-action section following EPIDOM brand guidelines:
 * - Brand-primary background with white text (like navbar/footer)
 * - Clean, centered layout
 * - Full viewport height for snap scrolling
 *
 * @component
 */

import { WaitlistDialog } from "./waitlist-dialog";
import { Container } from "./container";
import Link from "next/link";

export function CtaSection() {
  return (
    <section className="bg-brand-primary flex h-full w-full items-center justify-center">
      <Container maxWidth="7xl" className="px-4 py-12 sm:px-6 sm:py-0 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* Heading */}
          <h2 className="text-3xl leading-tight font-bold tracking-tight text-white md:text-4xl lg:text-5xl">
            Ready to streamline your kitchen?
          </h2>

          {/* Description */}
          <p className="mt-6 text-lg leading-relaxed text-white/80 md:text-xl">
            Join thousands of food service professionals who are saving time and reducing waste with
            Epidom. Start your free trial today.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <WaitlistDialog variant="sidebar" />
            <Link
              href="/pricing"
              className="rounded-full border border-white/30 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              View Pricing →
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-white/60">
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
              <span>Secure & Private</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
                />
              </svg>
              <span>Cancel Anytime</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Quick Setup</span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
