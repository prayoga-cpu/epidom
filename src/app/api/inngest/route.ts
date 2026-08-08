import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { sendOrderNotification } from "@/lib/inngest/functions/order-notification";
import { sendCustomerReceiptOnOrder } from "@/lib/inngest/functions/send-customer-receipt";
import { parseAggregatorEmail } from "@/lib/inngest/functions/parse-aggregator-email";
import { sendFeedbackNotification } from "@/lib/inngest/functions/feedback-notification";
import { sendCustomDevelopmentNotification } from "@/lib/inngest/functions/custom-development-notification";
import { purgeExpiredAccounts } from "@/lib/inngest/functions/purge-expired-accounts";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    sendOrderNotification,
    sendCustomerReceiptOnOrder,
    parseAggregatorEmail,
    sendFeedbackNotification,
    sendCustomDevelopmentNotification,
    purgeExpiredAccounts,
  ],
});
