import { Inngest } from "inngest";

// Event payload types (used by callers of inngest.send)
export type OrderPlacedEventData = {
  orderId: string;
  storeId: string;
  storefrontSlug: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  currency: string;
  paymentMethod: string;
  items: Array<{ name: string; quantity: number }>;
  merchantPhone: string | null;
  storeName: string;
};

export type OrderPaymentEventData = {
  orderId: string;
  storeId: string;
  providerRef: string;
};

export type FeedbackSubmittedEventData = {
  feedbackId: string;
  type: string;
  page: string;
  description: string;
  screenshotUrl: string | null;
  userName: string;
  userEmail: string;
  storeId: string | null;
  storeName: string | null;
};

export type CustomDevelopmentSubmittedEventData = {
  requestId: string;
  description: string;
  company: string | null;
  phone: string | null;
  budget: string | null;
  timeline: string | null;
  userName: string;
  userEmail: string;
  storeId: string | null;
  storeName: string | null;
};

export const inngest = new Inngest({ id: "epidom" });
