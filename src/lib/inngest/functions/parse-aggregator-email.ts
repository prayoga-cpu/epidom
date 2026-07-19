import { inngest } from "../client";
import { prisma } from "@/lib/prisma";
import { generateStructuredResponse } from "@/lib/ai/openai-client";
import { z } from "zod";
import {
  AggregatorPlatform,
  OrderSource,
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
} from "@prisma/client";
import { PLATFORM_TO_SOURCE } from "@/config/aggregator.config";
import { toDecimal } from "@/lib/utils/types.server";

export type AggregatorEmailEventData = {
  aggregatorEmailId: string;
  storeId: string;
};

const parsedOrderSchema = z.object({
  platform: z.enum(["GOFOOD", "GRABFOOD", "SHOPEEFOOD", "TOKOPEDIA"]).nullable(),
  orderNumber: z.string(),
  customerName: z.string(),
  customerPhone: z.string().nullable(),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().int().min(1),
      unitPrice: z.number().min(0),
    })
  ),
  subtotal: z.number().min(0),
  total: z.number().min(0),
  deliveryAddress: z.string().nullable(),
  notes: z.string().nullable(),
  orderDate: z.string().nullable(), // ISO string
});

export const parseAggregatorEmail = inngest.createFunction(
  {
    id: "parse-aggregator-email",
    retries: 2,
    triggers: [{ event: "aggregator/email.received" }],
  },
  async ({ event }) => {
    const { aggregatorEmailId, storeId } = event.data as AggregatorEmailEventData;

    const emailRecord = await prisma.aggregatorEmail.findUnique({
      where: { id: aggregatorEmailId },
    });
    if (!emailRecord) return { error: "Email record not found" };

    // Already processed
    if (emailRecord.parseStatus === "success") return { skipped: true };

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      await prisma.aggregatorEmail.update({
        where: { id: aggregatorEmailId },
        data: { parseStatus: "manual", parseError: "OPENAI_API_KEY not configured" },
      });
      return { skipped: true, reason: "No OPENAI_API_KEY — stored for manual review" };
    }

    let parsed: z.infer<typeof parsedOrderSchema>;
    try {
      const { data } = await generateStructuredResponse(
        `You are an order extraction assistant. Extract structured order data from Indonesian food delivery platform emails (GoFood, GrabFood, ShopeeFood, Tokopedia). Return null for fields you cannot find. Currency values must be numeric (no currency symbols). Date must be ISO 8601 if found.`,
        `From address: ${emailRecord.fromAddress}\nSubject: ${emailRecord.subject}\n\nEmail body:\n${emailRecord.bodyText.slice(0, 4000)}`,
        parsedOrderSchema,
        { temperature: 0 }
      );
      parsed = data;
    } catch (err) {
      await prisma.aggregatorEmail.update({
        where: { id: aggregatorEmailId },
        data: {
          parseStatus: "failed",
          parseError: err instanceof Error ? err.message : String(err),
        },
      });
      throw err; // let Inngest retry
    }

    // Create the Order
    const orderNumber = parsed.orderNumber || `AGG-${Date.now()}`;
    const source: OrderSource = parsed.platform
      ? PLATFORM_TO_SOURCE[parsed.platform as AggregatorPlatform]
      : "MANUAL";

    const subtotal =
      parsed.subtotal || parsed.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const total = parsed.total || subtotal;

    const order = await prisma.order.create({
      data: {
        storeId,
        orderNumber,
        customerName: parsed.customerName || "Unknown",
        customerPhone: parsed.customerPhone ?? undefined,
        deliveryAddress: parsed.deliveryAddress ?? undefined,
        notes: parsed.notes ?? undefined,
        status: OrderStatus.CONFIRMED,
        orderType: "DELIVERY",
        paymentMethod: PaymentMethod.CASH,
        paymentStatus: PaymentStatus.PAID,
        source,
        subtotal: toDecimal(subtotal),
        total: toDecimal(total),
        orderDate: parsed.orderDate ? new Date(parsed.orderDate) : new Date(),
        items: {
          create: parsed.items.map((item) => ({
            name: item.name,
            quantity: toDecimal(item.quantity),
            unit: "pcs",
            unitPrice: toDecimal(item.unitPrice),
            total: toDecimal(item.unitPrice * item.quantity),
          })),
        },
      },
    });

    await prisma.aggregatorEmail.update({
      where: { id: aggregatorEmailId },
      data: {
        parseStatus: "success",
        parsedOrderId: order.id,
        platform: (parsed.platform as AggregatorPlatform) ?? undefined,
      },
    });

    return { orderId: order.id, source };
  }
);
