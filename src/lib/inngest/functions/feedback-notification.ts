import { inngest, type FeedbackSubmittedEventData } from "../client";
import { sendFeedbackNotificationEmail } from "@/lib/services/email.service";

export const sendFeedbackNotification = inngest.createFunction(
  {
    id: "send-feedback-notification",
    retries: 3,
    triggers: [{ event: "feedback/submitted" }],
  },
  async ({ event }) => {
    const result = await sendFeedbackNotificationEmail(event.data as FeedbackSubmittedEventData);

    // Throw so Inngest retries failed sends (the email service returns instead of throwing)
    if (!result.success) {
      throw new Error(`Failed to send feedback notification for ${event.data.feedbackId}`);
    }

    return { sent: true, feedbackId: event.data.feedbackId };
  }
);
