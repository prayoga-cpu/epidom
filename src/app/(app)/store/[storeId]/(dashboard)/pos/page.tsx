/**
 * MVP POS Page
 *
 * Point of Sale: Execute transactions that reduce stock
 */

import { getProductsForPOS, getTransactionCount } from "@/features/mvp/pos/actions";
import { PosClient } from "./pos-client";

interface PosPageProps {
  params: Promise<{ storeId: string }>;
}

export default async function PosPage({ params }: PosPageProps) {
  const { storeId } = await params;

  // Fetch products server-side
  const products = await getProductsForPOS(storeId);
  const transactionCount = await getTransactionCount(storeId);

  return <PosClient products={products} transactionCount={transactionCount} />;
}
