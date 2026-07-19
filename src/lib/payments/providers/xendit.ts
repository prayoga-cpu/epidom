import type { PaymentMethod } from "@prisma/client";

export type XenditVABankCode = "BNI" | "BRI" | "MANDIRI" | "PERMATA";

export const XENDIT_VA_BANKS: { code: XenditVABankCode; label: string }[] = [
  { code: "BNI", label: "BNI" },
  { code: "BRI", label: "BRI" },
  { code: "MANDIRI", label: "Mandiri" },
  { code: "PERMATA", label: "Permata" },
];

export interface XenditPaymentRequest {
  orderId: string;
  amount: number;
  currency?: string;
  customerName: string;
  customerPhone?: string;
  description: string;
  paymentMethod: PaymentMethod;
  bankCode?: XenditVABankCode;
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
  // Generic / QRIS
  external_id?: string;
  status?: string;

  // E-Wallet (nested in data)
  event?: string;
  data?: {
    reference_id?: string;
    status?: string;
  };

  // VA
  bank_code?: string;
  amount?: number;
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

    const data = await xenditRequest<{ id: string; qr_string: string }>("/qr_codes", payload);

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
    const bankCode = req.bankCode ?? "BNI";
    const payload = {
      external_id: req.orderId,
      bank_code: bankCode,
      name: req.customerName,
      expected_amount: Math.round(req.amount),
      is_closed: true,
      expiration_date: expiresAt.toISOString(),
    };

    const data = await xenditRequest<{
      id: string;
      account_number: string;
      bank_code: string;
    }>("/callback_virtual_accounts", payload);

    return {
      providerRef: data.id,
      paymentUrl: req.successRedirectUrl,
      // Format: "BNI:8808999949742598" so UI can show bank name + number separately
      qrString: `${data.bank_code}:${data.account_number}`,
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
  // 1. E-Wallet Webhook (uses data.reference_id and data.status = SUCCEEDED)
  if (payload.data && payload.data.reference_id) {
    const status = payload.data.status;
    return {
      orderId: payload.data.reference_id,
      paid: status === "SUCCEEDED",
      failed: status === "FAILED",
      expired: status === "VOIDED",
    };
  }

  const orderId = payload.external_id;
  if (!orderId) {
    throw new Error("Invalid Webhook: missing external_id or reference_id");
  }

  // 2. VA Webhook (no status field, its presence means paid)
  if (payload.bank_code && payload.amount && !payload.status) {
    return {
      orderId,
      paid: true,
      failed: false,
      expired: false,
    };
  }

  // 3. QRIS Webhook (uses status = COMPLETED)
  return {
    orderId,
    paid: payload.status === "COMPLETED",
    failed: payload.status === "FAILED",
    expired: payload.status === "EXPIRED",
  };
}
