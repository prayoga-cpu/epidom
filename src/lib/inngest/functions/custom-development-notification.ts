import { inngest, type CustomDevelopmentSubmittedEventData } from "../client";
import { sendCustomDevelopmentNotificationEmail } from "@/lib/services/email.service";

export const sendCustomDevelopmentNotification = inngest.createFunction(
  {
    id: "send-custom-development-notification",
    retries: 3,
    triggers: [{ event: "custom-development/submitted" }],
  },
  async ({ event }) => {
    const result = await sendCustomDevelopmentNotificationEmail(
      event.data as CustomDevelopmentSubmittedEventData
    );

    // Throw so Inngest retries failed sends (the email service returns instead of throwing)
    if (!result.success) {
      throw new Error(`Failed to send custom development notification for ${event.data.requestId}`);
    }

    return { sent: true, requestId: event.data.requestId };
  }
);
