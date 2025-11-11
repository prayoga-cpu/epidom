"use client";

/**
 * Services Section Component
 *
 * Reusable section component for services page that displays images and text
 * in various layout configurations. Supports multiple layout variants and
 * lazy loading with intersection observer.
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import Image from "next/image";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { ReactNode } from "react";

interface ImageConfig {
  src: string;
  alt: string;
  quality?: number;
  priority?: boolean;
  sizes?: string;
  placeholder?: "blur";
  blurDataURL?: string;
  loading?: "lazy" | "eager";
}

interface TextContent {
  titleKey?: string;
  subtitleKey?: string;
  descriptionKey?: string;
  description2Key?: string;
}

type LayoutVariant =
  | "text-left-image-right" // Text left column, images right column
  | "image-left-text-right" // Images left column, text right column
  | "images-only"; // No text, only images

interface ServicesSectionProps {
  /** Layout variant */
  variant: LayoutVariant;
  /** Text content configuration */
  textContent?: TextContent;
  /** Left column images */
  leftImages: ImageConfig[];
  /** Right column images */
  rightImages: ImageConfig[];
  /** Grid columns for desktop (e.g., 10, 12) */
  gridCols?: 10 | 12;
  /** Left column span (e.g., 4, 6, 7, 9) */
  leftSpan?: number;
  /** Right column span (e.g., 3, 4, 6, 9) */
  rightSpan?: number;
  /** Mobile order: left first (1) or right first (2) */
  mobileOrder?: "left-first" | "right-first";
  /** Enable intersection observer for lazy loading */
  useIntersectionObserver?: boolean;
  /** Section wrapper class (for flex items-center, etc.) */
  sectionClassName?: string;
}

export function ServicesSection({
  variant,
  textContent,
  leftImages,
  rightImages,
  gridCols = 10,
  leftSpan,
  rightSpan,
  mobileOrder = "left-first",
  useIntersectionObserver: enableObserver = false,
  sectionClassName = "",
}: ServicesSectionProps) {
  const { t } = useI18n();
  const { ref, hasIntersected } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: "50px",
    triggerOnce: true,
  });

  // Calculate column spans if not provided
  const leftColSpan = leftSpan || (gridCols === 10 ? 4 : 3);
  const rightColSpan = rightSpan || (gridCols === 10 ? 6 : 9);

  // Determine order classes
  const leftOrder = mobileOrder === "left-first" ? "lg:order-1" : "order-2 lg:order-1";
  const rightOrder = mobileOrder === "left-first" ? "order-2 lg:order-2" : "order-1 lg:order-2";

  // Grid column classes (must be static for Tailwind)
  const gridColsClass = gridCols === 10 ? "lg:grid-cols-10" : "lg:grid-cols-12";

  // Column span classes (must be static for Tailwind)
  const leftColSpanClass =
    leftColSpan === 3
      ? "lg:col-span-3"
      : leftColSpan === 4
        ? "lg:col-span-4"
        : leftColSpan === 6
          ? "lg:col-span-6"
          : leftColSpan === 7
            ? "lg:col-span-7"
            : leftColSpan === 9
              ? "lg:col-span-9"
              : "lg:col-span-4";

  const rightColSpanClass =
    rightColSpan === 3
      ? "lg:col-span-3"
      : rightColSpan === 4
        ? "lg:col-span-4"
        : rightColSpan === 6
          ? "lg:col-span-6"
          : rightColSpan === 7
            ? "lg:col-span-7"
            : rightColSpan === 9
              ? "lg:col-span-9"
              : "lg:col-span-6";

  // Section ref for intersection observer
  const sectionRef = enableObserver ? ref : undefined;

  // Render image
  const renderImage = (image: ImageConfig, index: number) => {
    const shouldRender = !enableObserver || hasIntersected;
    const hasPriority = image.priority === true;

    return (
      <div key={index} className="relative aspect-video w-full overflow-hidden rounded-lg">
        {shouldRender && (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            className="object-cover scale-[1.01]"
            quality={image.quality ?? 85}
            priority={hasPriority}
            sizes={image.sizes}
            placeholder={image.placeholder}
            blurDataURL={image.blurDataURL}
            {...(hasPriority ? {} : { loading: image.loading ?? "lazy" })}
          />
        )}
      </div>
    );
  };

  // Render text content
  const renderTextContent = (): ReactNode => {
    if (!textContent || variant === "images-only") return null;

    return (
      <div className="space-y-3 md:space-y-5">
        {textContent.titleKey && (
          <h2 className="text-section-title text-brand-primary">{t(textContent.titleKey)}</h2>
        )}
        {textContent.subtitleKey && (
          <h3 className="text-subtitle text-brand-primary">{t(textContent.subtitleKey)}</h3>
        )}
        {textContent.descriptionKey && (
          <p className="text-description text-brand-primary">{t(textContent.descriptionKey)}</p>
        )}
        {textContent.description2Key && (
          <p className="text-description text-brand-primary">{t(textContent.description2Key)}</p>
        )}
      </div>
    );
  };

  return (
    <section
      ref={sectionRef}
      className={`relative z-10 overflow-visible bg-white py-8 md:py-4 lg:py-16 ${sectionClassName}`}
    >
      <div className="services-narrow-container">
        <div
          className={`grid grid-cols-1 items-start gap-4 md:gap-6 ${gridColsClass} lg:items-center lg:gap-8`}
        >
          {/* Left Column */}
          <div className={`${leftOrder} space-y-3 ${leftColSpanClass}`}>
            {variant === "text-left-image-right" && renderTextContent()}
            {variant === "image-left-text-right" && leftImages.map((image, index) => renderImage(image, index))}
            {variant === "images-only" && leftImages.map((image, index) => renderImage(image, index))}
          </div>

          {/* Right Column */}
          <div className={`${rightOrder} space-y-3 md:space-y-5 ${rightColSpanClass}`}>
            {variant === "image-left-text-right" && renderTextContent()}
            {variant === "text-left-image-right" && rightImages.map((image, index) => renderImage(image, index))}
            {variant === "image-left-text-right" && rightImages.map((image, index) => renderImage(image, index))}
            {variant === "images-only" && rightImages.map((image, index) => renderImage(image, index))}
          </div>
        </div>
      </div>
    </section>
  );
}

