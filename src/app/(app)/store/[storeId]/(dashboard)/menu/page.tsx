import { MenuManager } from "@/features/storefront/editor/components/menu-manager";

export default async function MenuPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  return <MenuManager storeId={storeId} />;
}
