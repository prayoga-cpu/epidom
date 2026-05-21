import type { Metadata } from "next";
import { StorefrontEditorClient } from "@/features/storefront/editor/components/storefront-editor-client";

export const metadata: Metadata = {
  title: "Storefront - Epidom",
  description: "Manage your public storefront and menu",
};

export default async function StorefrontPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  return <StorefrontEditorClient storeId={storeId} />;
}
