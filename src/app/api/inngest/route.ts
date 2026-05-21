import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { sendOrderNotification } from "@/lib/inngest/functions/order-notification";
import { parseAggregatorEmail } from "@/lib/inngest/functions/parse-aggregator-email";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [sendOrderNotification, parseAggregatorEmail],
});
