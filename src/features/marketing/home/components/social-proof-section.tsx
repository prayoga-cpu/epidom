"use client";

/**
 * Social Proof Section - PREMIUM Edition
 *
 * Features:
 * - Infinite scrolling logo marquee
 * - Premium testimonial cards with hover effects
 * - Animated elements
 *
 * @component
 */

import { useI18n } from "@/components/lang/i18n-provider";
import { Container } from "@/features/marketing/shared/components/container";
import { useEffect, useState } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react"; // Updated icons
import { SSRPlaceholder } from "@/components/shared";
import Image from "next/image";
import pepiteLogo from "../assets/brands/pepite-cookie.jpg";
import lafabriqueLogo from "../assets/brands/lafabrique.jpg";
import lauratoddLogo from "../assets/brands/laura-todd.jpg";
import holycookieLogo from "../assets/brands/holy-cookie.jpg";
import mommacookiesLogo from "../assets/brands/momma-cookies.jpg";

// Map testimonials to brands for authentic content
const INSTAGRAM_POSTS = [
  {
    id: 1,
    handle: "pepite.cookie",
    name: "Pépite Cookie",
    image: pepiteLogo,
    likes: "1,245",
    contentKey: "testimonial1", // Uses translation key
    timeAgo: "2d",
  },
  {
    id: 2,
    handle: "lafabriquecookies",
    name: "La Fabrique Cookies",
    image: lafabriqueLogo,
    likes: "3,892",
    contentKey: "testimonial2",
    timeAgo: "5d",
  },
  {
    id: 3,
    handle: "holycookie_paris",
    name: "Holy Cookie Paris",
    image: holycookieLogo,
    likes: "856",
    contentKey: "testimonial3",
    timeAgo: "1w",
  },
];

const BRANDS = [
  { name: "Pépite Cookie", logo: pepiteLogo, url: "https://www.instagram.com/pepite.cookie/" },
  {
    name: "La Fabrique Cookies",
    logo: lafabriqueLogo,
    url: "https://www.instagram.com/lafabriquecookies/",
  },
  {
    name: "Holy Cookie Paris",
    logo: holycookieLogo,
    url: "https://www.instagram.com/holycookie_paris/",
  },
  { name: "Laura Todd", logo: lauratoddLogo, url: "https://www.instagram.com/laura_todd_1933/" },
  {
    name: "Momma Cookies Bali",
    logo: mommacookiesLogo,
    url: "https://www.instagram.com/mommacookiesbali/",
  },
];

export function SocialProofSection() {
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Return placeholder during SSR
  if (!mounted) {
    return (
      <SSRPlaceholder
        height="500px"
        className="bg-gradient-to-b from-white to-gray-50/50 py-20 md:py-28"
      />
    );
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-gray-50/50 py-20 md:py-28">
      <Container maxWidth="7xl" className="px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-16 text-center">
          <p className="text-brand-primary/50 mb-4 text-sm font-semibold tracking-widest uppercase">
            {t("home.socialProof.trustedBy")}
          </p>
        </div>

        {/* Brand Logos Grid with "Your Brand" Slot */}
        <div className="mb-24">
          <div className="flex flex-wrap justify-center gap-8 md:gap-14">
            {BRANDS.map((brand, i) => (
              <a
                key={`brand-${i}`}
                href={brand.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg md:h-24 md:w-24"
              >
                <div className="relative h-full w-full p-1.5">
                  <Image
                    src={brand.logo}
                    alt={`${brand.name} Logo`}
                    fill
                    className="rounded-full object-cover transition-all duration-500 group-hover:scale-110"
                  />
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Instagram Feed Mockup Section */}
        <div className="mt-8">
          <div className="mb-12 text-center">
            <h3 className="text-brand-primary mb-4 text-3xl font-bold sm:text-4xl md:text-5xl">
              {t("home.socialProof.instagramTitle")}
            </h3>
            <p className="text-brand-primary/60 text-lg">
              {t("home.socialProof.instagramSubtitle")}
            </p>
          </div>

          {/* Instagram Cards Grid (3 Columns) */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {INSTAGRAM_POSTS.map((post) => (
              <article
                key={post.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-8 w-8 overflow-hidden rounded-full border border-gray-100">
                      <Image src={post.image} alt={post.name} fill className="object-cover" />
                    </div>
                    <div>
                      <p className="text-sm leading-none font-semibold text-gray-900">
                        {post.handle}
                      </p>
                      <p className="text-[10px] text-gray-500">Original Audio</p>
                    </div>
                  </div>
                  <MoreHorizontal className="h-5 w-5 text-gray-600" />
                </div>

                {/* Main Content Image */}
                <div className="relative aspect-square w-full bg-gray-100">
                  <Image
                    src={post.image}
                    alt={`Post by ${post.name}`}
                    fill
                    className="object-cover"
                  />
                  {/* Overlay vignette */}
                  <div className="absolute inset-0 bg-black/5" />
                </div>

                {/* Action Bar */}
                <div className="px-3 pt-3 pb-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Heart className="h-6 w-6 cursor-pointer text-gray-900 transition-colors hover:text-red-500" />
                      <MessageCircle className="h-6 w-6 cursor-pointer text-gray-900 hover:text-gray-600" />
                      <Send className="h-6 w-6 cursor-pointer text-gray-900 hover:text-gray-600" />
                    </div>
                    <Bookmark className="h-6 w-6 cursor-pointer text-gray-900 hover:text-gray-600" />
                  </div>
                  <p className="mb-1 text-sm font-semibold text-gray-900">{post.likes} likes</p>
                  <p className="text-sm text-gray-900">
                    <span className="mr-2 font-semibold">{post.handle}</span>
                    {t(`home.socialProof.${post.contentKey}`)}
                  </p>
                  <p className="mt-1 text-[10px] tracking-wide text-gray-400 uppercase">
                    {post.timeAgo}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
