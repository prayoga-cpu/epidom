import { subscriptionService } from "../src/lib/services/subscription.service";

async function main() {
  try {
    const session = await subscriptionService.createCheckoutSession(
      "user-id-here", // Need a real user ID
      "POS",
      "http://localhost:3000/success",
      "http://localhost:3000/cancel"
    );
    console.log(session);
  } catch (err) {
    console.error("ERROR:", err);
  }
}
main();
