import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DemoWindow } from "@/components/demo-window";
import { I18nProvider } from "@/components/lang/i18n-provider";
import { DEMO_SLUG } from "@/lib/demo/demo-constants";

export const metadata: Metadata = {
  title: "Live demo - Epidom",
  robots: { index: false, follow: false },
};

const TITLES = {
  "phone-orders": "Phone Orders",
  pos: "POS Mode",
  dashboard: "Store Dashboard",
} as const;

/**
 * /demo/view/phone-orders | pos | dashboard?s=<demo store id>
 *
 * Where /demo/[target] sends a visitor once the demo session exists: the live
 * app inside the demo window. The store id comes from that route (it is the
 * public sample café's); anything that is not a plain id is refused.
 */
export default async function DemoViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ target: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { target } = await params;
  const { s } = await searchParams;
  if (!(target in TITLES)) notFound();
  const key = target as keyof typeof TITLES;

  let src: string;
  if (key === "phone-orders") {
    src = `/@${DEMO_SLUG}`;
  } else {
    if (!s || !/^[a-z0-9]{10,40}$/i.test(s)) notFound();
    src = `/store/${s}/${key === "pos" ? "pos" : "home"}`;
  }

  return (
    <I18nProvider>
      <DemoWindow src={src} title={TITLES[key]} />
    </I18nProvider>
  );
}
