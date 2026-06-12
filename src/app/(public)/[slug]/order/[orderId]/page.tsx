import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { storefrontService } from "@/lib/services";
import { OrderStatusClient } from "@/features/storefront/components/order-status-client";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string; orderId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderId } = await params;
  return {
    title: `Order Status ${orderId.slice(-6).toUpperCase()} | Epidom`,
  };
}

export default async function OrderStatusPage({ params }: PageProps) {
  const { slug, orderId } = await params;
  const cleanSlug = decodeURIComponent(slug).replace(/^@/, "");

  const [storefront, order] = await Promise.all([
    storefrontService.getStorefrontBySlug(cleanSlug),
    prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            menuItem: { select: { name: true, imageUrl: true } },
          },
        },
      },
    }),
  ]);

  if (!storefront || !storefront.isPublished) {
    notFound();
  }

  if (!order || order.storefrontId !== storefront.id) {
    notFound();
  }

  return (
    <OrderStatusClient
      storefront={{
        slug: storefront.slug,
        displayName: storefront.displayName,
        themeColor: storefront.themeColor,
        whatsappNumber: storefront.whatsappNumber,
      }}
      order={{
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        customerName: order.customerName,
        orderType: order.orderType,
        tableNumber: order.tableNumber,
        notes: order.notes,
        total: Number(order.total),
        currency: order.items[0]?.menuItem ? "IDR" : "IDR",
        createdAt: order.createdAt.toISOString(),
        paymentQrString: order.paymentQrString,
        items: order.items.map((i) => ({
          id: i.id,
          name: i.menuItem?.name ?? "Item",
          imageUrl: i.menuItem?.imageUrl ?? null,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          total: Number(i.total),
        })),
      }}
    />
  );
}
