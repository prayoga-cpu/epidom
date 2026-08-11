import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAllDashboardNavItems } from "@/config/navigation.config";
import { LAST_VISITED_COOKIE, normalizeDefaultLanding } from "@/lib/last-visited";

/**
 * Store launcher. Every entry point that has to name a destination *before*
 * knowing which store it belongs to points here: the PWA manifest's
 * `start_url` and its long-press shortcuts, and anything else that needs a
 * stable, store-agnostic deep link.
 *
 * The problem it solves: real dashboard URLs are `/store/{storeId}/pos`, but
 * a manifest is a static file — it cannot contain a store id, and the
 * root-level `/pos` it used to point at has never been a route. So the
 * launcher takes the section (`/go/pos`), resolves the store server-side from
 * the session, and redirects to the URL that actually exists.
 */
export const metadata: Metadata = {
  // A pure redirect hop with no content of its own; keeping it out of the
  // index also keeps it out of sitemaps and AI crawlers' link graphs.
  robots: { index: false, follow: false },
};

/**
 * The sections the launcher is willing to build a URL for — the dashboard nav
 * items themselves, so a page added to (or removed from) the sidebar can
 * never leave `/go/*` pointing at a route that doesn't exist. Anything else
 * (`/go/junk`, a section deleted in a refactor, a shortcut from an old
 * installed manifest) falls back to the user's default landing rather than
 * assembling a 404.
 */
const LAUNCHABLE_SECTIONS = new Set(getAllDashboardNavItems().map((item) => item.href));

/** Pulls `{storeId}` out of a `/store/{storeId}/...` path, if that's what this is. */
function storeIdFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  return segments[0] === "store" && segments[1] ? segments[1] : null;
}

export default async function StoreLauncherPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  const requestedSection = `/${(path ?? []).join("/")}`;

  const session = await getSession();
  if (!session?.user?.id) {
    // Carrying the launcher URL through login means a cold PWA launch on a
    // logged-out device still lands on the shortcut that was tapped, instead
    // of dumping the cashier on a generic dashboard afterwards.
    redirect(`/login?callbackUrl=${encodeURIComponent(`/go${requestedSection}`)}`);
  }

  // One round trip for both halves of the answer: which stores this user
  // owns, and where they've asked to land inside one.
  const owner = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      defaultLanding: true,
      business: {
        select: {
          stores: {
            select: { id: true },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });

  const stores = owner?.business?.stores ?? [];
  if (stores.length === 0) {
    // No business yet, or a business with no outlets — /stores is the create
    // flow, and it's also where a support-recovered account starts over.
    redirect("/stores");
  }

  // Prefer the store they were last actually inside: on a multi-outlet
  // account, "open the POS shortcut" means the outlet they're standing in,
  // not whichever one happens to be newest. Only honoured if it's still one
  // of their stores — the cookie outlives a store being sold or deleted.
  const cookieStore = await cookies();
  const rawLastVisited = cookieStore.get(LAST_VISITED_COOKIE)?.value;
  let preferredStoreId: string | null = null;
  if (rawLastVisited) {
    try {
      preferredStoreId = storeIdFromPath(decodeURIComponent(rawLastVisited));
    } catch {
      // Malformed percent-encoding in a cookie we don't control — fall
      // through to the most-recent store below.
      preferredStoreId = null;
    }
  }
  const storeId =
    (preferredStoreId && stores.some((store) => store.id === preferredStoreId)
      ? preferredStoreId
      : null) ?? stores[0].id;

  const section = LAUNCHABLE_SECTIONS.has(requestedSection)
    ? requestedSection
    : `/${normalizeDefaultLanding(owner?.defaultLanding)}`;

  redirect(`/store/${storeId}${section}`);
}
