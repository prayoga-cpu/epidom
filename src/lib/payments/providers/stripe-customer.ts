import Stripe from "stripe";

export interface StripeCustomerPaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail?: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
}

export interface StripeCustomerPaymentResponse {
  providerRef: string;
  paymentUrl: string;
  expiresAt: Date;
}

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function createStripeCustomerPayment(
  req: StripeCustomerPaymentRequest
): Promise<StripeCustomerPaymentResponse> {
  const stripe = getStripe();
  if (!stripe) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: req.currency.toLowerCase(),
          unit_amount: Math.round(req.amount),
          product_data: {
            name: req.description,
          },
        },
        quantity: 1,
      },
    ],
    customer_email: req.customerEmail,
    metadata: { orderId: req.orderId },
    success_url: req.successUrl,
    cancel_url: req.cancelUrl,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });

  return {
    providerRef: session.id,
    paymentUrl: session.url!,
    expiresAt: new Date((session.expires_at ?? 0) * 1000),
  };
}

export function isStripeCustomerAvailable(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
