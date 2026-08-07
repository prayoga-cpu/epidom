import { z } from "zod";

/**
 * Body Pusher's client SDK posts to a custom authEndpoint — always
 * `application/x-www-form-urlencoded`, so the route parses it into this
 * shape before validating (see AGENTS.md "never skip a Zod schema").
 */
export const pusherAuthSchema = z.object({
  socket_id: z.string().min(1, "socket_id is required"),
  channel_name: z.string().min(1, "channel_name is required"),
});

export type PusherAuthInput = z.infer<typeof pusherAuthSchema>;
