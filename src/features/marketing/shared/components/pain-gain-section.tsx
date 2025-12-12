"use client";

/**
 * Pain & Gain Section Component
 *
 * Comparison section following EPIDOM brand guidelines:
 * - White/light background with brand-primary text
 * - Clean card layout with subtle shadows
 * - Full viewport height for snap scrolling
 *
 * @component
 */

import { X, Check } from "lucide-react";
import { Container } from "./container";

const features = [
  {
    pain: "Hours spent on manual spreadsheets",
    gain: "Real-time inventory tracking",
  },
  {
    pain: "Constant food waste and spoilage",
    gain: "Smart expiry alerts & waste reduction",
  },
  {
    pain: "Guessing order quantities",
    gain: "Data-driven purchasing decisions",
  },
  {
    pain: "Unclear food costs and margins",
    gain: "Precise cost calculation per dish",
  },
];

export function PainGainSection() {
  return (
    <section className="flex h-full w-full items-center justify-center bg-white">
      <Container maxWidth="7xl" className="px-4 py-12 sm:px-6 sm:py-0 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-brand-primary text-3xl leading-tight font-bold tracking-tight md:text-4xl lg:text-5xl">
            Stop Managing Your Kitchen the Hard Way
          </h2>
          <p className="text-brand-primary/80 mt-4 text-lg leading-relaxed md:text-xl">
            Compare how Epidom transforms your daily operations compared to traditional methods.
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8">
          {/* Pain Column - The Old Way */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 shadow-sm transition-all hover:shadow-md lg:p-8">
            <h3 className="text-brand-primary/70 mb-6 flex items-center gap-3 text-xl font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600">
                <X className="h-5 w-5" />
              </span>
              The Old Way
            </h3>
            <ul className="space-y-4">
              {features.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <X className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
                  <span className="text-brand-primary/80 text-base lg:text-lg">{item.pain}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Gain Column - The Epidom Way */}
          <div className="border-brand-primary/10 bg-brand-primary rounded-2xl border p-6 text-white shadow-lg transition-all hover:shadow-xl lg:p-8">
            <h3 className="mb-6 flex items-center gap-3 text-xl font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white">
                <Check className="h-5 w-5" />
              </span>
              The Epidom Way
            </h3>
            <ul className="space-y-4">
              {features.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-300" />
                  <span className="text-base text-white/90 lg:text-lg">{item.gain}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
