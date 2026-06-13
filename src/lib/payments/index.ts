import type { PaymentMethod } from "@prisma/client";
import {
  createXenditPayment,
  isXenditAvailable,
  type XenditPaymentRequest,
  type XenditPaymentResponse,
  type XenditVABankCode,
  XENDIT_VA_BANKS,
} from "./providers/xendit";
import {
  createStripeCustomerPayment,
  isStripeCustomerAvailable,
  type StripeCustomerPaymentRequest,
  type StripeCustomerPaymentResponse,
} from "./providers/stripe-customer";

export type { XenditPaymentResponse, StripeCustomerPaymentResponse };
export type { XenditVABankCode };
export { XENDIT_VA_BANKS };

const XENDIT_METHODS: PaymentMethod[] = [
  "QRIS",
  "GOPAY",
  "OVO",
  "DANA",
  "SHOPEEPAY",
  "BANK_TRANSFER",
];

const STRIPE_METHODS: PaymentMethod[] = ["STRIPE_CARD"];

export function isIndonesianPayment(method: PaymentMethod): boolean {
  return XENDIT_METHODS.includes(method);
}

export interface PaymentInitRequest {
  orderId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  description: string;
  paymentMethod: PaymentMethod;
  bankCode?: XenditVABankCode;
  successUrl: string;
  cancelUrl: string;
  callbackUrl: string;
}

export interface PaymentInitResponse {
  provider: "xendit" | "stripe" | "none";
  providerRef: string;
  paymentUrl: string;
  qrString?: string;
  expiresAt: Date;
}

export async function initiatePayment(
  req: PaymentInitRequest
): Promise<PaymentInitResponse> {
  if (req.paymentMethod === "CASH") {
    return {
      provider: "none",
      providerRef: "",
      paymentUrl: req.successUrl,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  if (XENDIT_METHODS.includes(req.paymentMethod)) {
    if (!isXenditAvailable()) {
      return {
        provider: "none",
        providerRef: "",
        paymentUrl: req.successUrl,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };
    }

    const xenditReq: XenditPaymentRequest = {
      orderId: req.orderId,
      amount: req.amount,
      currency: req.currency,
      customerName: req.customerName,
      customerPhone: req.customerPhone,
      description: req.description,
      paymentMethod: req.paymentMethod,
      bankCode: req.bankCode,
      callbackUrl: req.callbackUrl,
      successRedirectUrl: req.successUrl,
      failureRedirectUrl: req.cancelUrl,
    };

    const result = await createXenditPayment(xenditReq);
    return {
      provider: "xendit",
      providerRef: result.providerRef,
      paymentUrl: result.paymentUrl,
      qrString: result.qrString,
      expiresAt: result.expiresAt,
    };
  }

  if (STRIPE_METHODS.includes(req.paymentMethod)) {
    if (!isStripeCustomerAvailable()) {
      return {
        provider: "none",
        providerRef: "",
        paymentUrl: req.successUrl,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };
    }

    const stripeReq: StripeCustomerPaymentRequest = {
      orderId: req.orderId,
      amount: req.amount,
      currency: req.currency,
      customerName: req.customerName,
      customerEmail: req.customerEmail,
      description: req.description,
      successUrl: req.successUrl,
      cancelUrl: req.cancelUrl,
    };

    const result = await createStripeCustomerPayment(stripeReq);
    return {
      provider: "stripe",
      providerRef: result.providerRef,
      paymentUrl: result.paymentUrl,
      expiresAt: result.expiresAt,
    };
  }

  throw new Error(`Unhandled payment method: ${req.paymentMethod}`);
}
