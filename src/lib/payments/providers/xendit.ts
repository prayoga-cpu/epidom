import type { PaymentMethod } from "@prisma/client";

export interface XenditPaymentRequest {
  orderId: string;
  amount: number;
  currency?: string;
  customerName: string;
  customerPhone?: string;
  description: string;
  paymentMethod: PaymentMethod;
  callbackUrl: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
}

export interface XenditPaymentResponse {
  providerRef: string;
  paymentUrl: string;
  qrString?: string;
  expiresAt: Date;
}

export interface XenditWebhookPayload {
  id: string;
  external_id: string;
  status: "ACTIVE" | "COMPLETED" | "EXPIRED" | "FAILED";
  payment_method: string;
  amount: number;
  currency: string;
  created: string;
  updated: string;
}

const XENDIT_METHOD_MAP: Partial<Record<PaymentMethod, string>> = {
  QRIS: "QR_CODE",
  GOPAY: "EWALLET",
  OVO: "EWALLET",
  DANA: "EWALLET",
  SHOPEEPAY: "EWALLET",
  BANK_TRANSFER: "VIRTUAL_ACCOUNT",
};

const XENDIT_EWALLET_CHANNEL: Partial<Record<PaymentMethod, string>> = {
  GOPAY: "GOPAY",
  OVO: "OVO",
  DANA: "DANA",
  SHOPEEPAY: "SHOPEEPAY",
};

function getXenditApiKey(): string | null {
  return process.env.XENDIT_SECRET_KEY ?? null;
}

async function xenditRequest<T>(path: string, body: unknown): Promise<T> {
  const apiKey = getXenditApiKey();
  if (!apiKey) {
    throw new Error("XENDIT_SECRET_KEY is not configured");
  }

  const res = await fetch(`https://api.xendit.co${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Xendit API error ${res.status}: ${err}`);
  }

  return res.json() as Promise<T>;
}

export async function createXenditPayment(
  req: XenditPaymentRequest
): Promise<XenditPaymentResponse> {
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

  if (req.paymentMethod === "QRIS") {
    const payload = {
      external_id: req.orderId,
      type: "DYNAMIC",
      callback_url: req.callbackUrl,
      amount: req.amount,
      currency: req.currency ?? "IDR",
      expires_at: expiresAt.toISOString(),
    };

    const data = await xenditRequest<{ id: string; qr_string: string }>(
      "/qr_codes",
      payload
    );

    return {
      providerRef: data.id,
      paymentUrl: req.successRedirectUrl,
      qrString: data.qr_string,
      expiresAt,
    };
  }

  if (XENDIT_EWALLET_CHANNEL[req.paymentMethod]) {
    const payload = {
      reference_id: req.orderId,
      currency: req.currency ?? "IDR",
      amount: req.amount,
      checkout_method: "ONE_TIME_PAYMENT",
      channel_code: XENDIT_EWALLET_CHANNEL[req.paymentMethod],
      channel_properties: {
        success_redirect_url: req.successRedirectUrl,
        failure_redirect_url: req.failureRedirectUrl,
        mobile_number: req.customerPhone,
      },
    };

    const data = await xenditRequest<{
      id: string;
      actions: { desktop_web_checkout_url?: string; mobile_web_checkout_url?: string };
    }>("/ewallets/charges", payload);

    return {
      providerRef: data.id,
      paymentUrl:
        data.actions.desktop_web_checkout_url ??
        data.actions.mobile_web_checkout_url ??
        req.successRedirectUrl,
      expiresAt,
    };
  }

  if (req.paymentMethod === "BANK_TRANSFER") {
    const payload = {
      external_id: req.orderId,
      bank_code: "BNI",
      name: req.customerName,
      expected_amount: req.amount,
      expiration_date: expiresAt.toISOString(),
    };

    const data = await xenditRequest<{
      id: string;
      account_number: string;
    }>("/callback_virtual_accounts", payload);

    return {
      providerRef: data.id,
      paymentUrl: req.successRedirectUrl,
      expiresAt,
    };
  }

  throw new Error(`Unsupported Xendit payment method: ${req.paymentMethod}`);
}

export function isXenditAvailable(): boolean {
  return !!getXenditApiKey();
}

export function parseXenditWebhook(payload: XenditWebhookPayload): {
  orderId: string;
  paid: boolean;
  failed: boolean;
  expired: boolean;
} {
  return {
    orderId: payload.external_id,
    paid: payload.status === "COMPLETED",
    failed: payload.status === "FAILED",
    expired: payload.status === "EXPIRED",
  };
}
