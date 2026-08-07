import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getActiveStaffSession } from "@/lib/staff-session";
import { verifyStoreOwnership } from "@/lib/utils/store-verification";
import { getPusherServer, isRealtimeConfigured } from "@/lib/realtime/pusher-server";
import { storeDataChannel, storePresenceChannel } from "@/lib/realtime/channels";
import { pusherAuthSchema } from "@/lib/validation/realtime.schemas";
import { createErrorResponse, ApiErrorCode } from "@/types/api/responses";

/**
 * POST /api/pusher/auth
 *
 * Channel authorization endpoint Pusher's client SDK calls before letting a
 * browser subscribe to `private-store-*` / `presence-store-*`. A POS
 * terminal is as often logged in via staff PIN (`staff-session.ts`) as via
 * the owner/manager session (`auth.ts`), so this accepts either — mirrors
 * the dual-auth pattern already used for staff-gated POS routes.
 */
export async function POST(request: Request) {
  if (!isRealtimeConfigured()) {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Realtime is not configured"),
      { status: 503 }
    );
  }

  const form = await request.formData();
  const parsed = pusherAuthSchema.safeParse({
    socket_id: form.get("socket_id"),
    channel_name: form.get("channel_name"),
  });
  if (!parsed.success) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.INVALID_INPUT, "Invalid input"), {
      status: 400,
    });
  }
  const { socket_id: socketId, channel_name: channelName } = parsed.data;

  const storeId = extractStoreId(channelName);
  if (!storeId) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.FORBIDDEN, "Unknown channel"), {
      status: 403,
    });
  }

  const identity = await resolveIdentity(storeId);
  if (!identity) {
    return NextResponse.json(createErrorResponse(ApiErrorCode.UNAUTHORIZED, "Unauthorized"), {
      status: 401,
    });
  }

  const pusher = getPusherServer()!;

  if (channelName === storePresenceChannel(storeId)) {
    const auth = pusher.authorizeChannel(socketId, channelName, {
      user_id: identity.id,
      user_info: { name: identity.name, role: identity.role },
    });
    return NextResponse.json(auth);
  }

  if (channelName === storeDataChannel(storeId)) {
    const auth = pusher.authorizeChannel(socketId, channelName);
    return NextResponse.json(auth);
  }

  return NextResponse.json(createErrorResponse(ApiErrorCode.FORBIDDEN, "Unknown channel"), {
    status: 403,
  });
}

function extractStoreId(channelName: string): string | null {
  const match = channelName.match(/^(?:private|presence)-store-(.+)$/);
  return match ? match[1] : null;
}

async function resolveIdentity(
  storeId: string
): Promise<{ id: string; name: string; role: string } | null> {
  const staff = await getActiveStaffSession();
  if (staff && staff.storeId === storeId) {
    return { id: staff.staffMemberId, name: staff.name, role: staff.role };
  }

  const session = await getSession();
  if (session?.user?.id) {
    try {
      await verifyStoreOwnership(storeId, session.user.id);
      return { id: session.user.id, name: session.user.name, role: "owner" };
    } catch {
      return null;
    }
  }

  return null;
}
