import { redirect } from "next/navigation";

/**
 * The page that used to live here is Analytics now (3.44.0). Bookmarks, the
 * installed app's old start URL, resume cookies and shared links still arrive
 * at /dashboard, so it forwards them — with the query string, which carries
 * ?tour= and ?checklist= for Help's links.
 */
export default async function LegacyDashboardRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ storeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { storeId } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, v);
    }
  }
  const qs = query.toString();
  redirect(`/store/${storeId}/analytics${qs ? `?${qs}` : ""}`);
}
