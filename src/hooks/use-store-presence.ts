"use client";

import { useEffect, useState } from "react";
import type { PresenceChannel } from "pusher-js";
import { getPusherClient, isRealtimeConfiguredClient } from "@/lib/realtime/pusher-client";
import { storePresenceChannel } from "@/lib/realtime/channels";

export interface PresenceMember {
  id: string;
  name: string;
  role: string;
}

interface PresenceMemberInfo {
  name: string;
  role: string;
}

/**
 * Who else is currently connected to this store's dashboard/POS right now —
 * the actual Notion/Figma-style signal. Returns `[]` when Pusher isn't
 * configured. Unlike `useRealtimeChannel`, nothing else shares this channel
 * (presence has its own per-store channel, see channels.ts), so no
 * refcounting is needed — each hook instance owns its own subscription.
 */
export function useStorePresence(storeId: string | undefined | null): PresenceMember[] {
  const [members, setMembers] = useState<PresenceMember[]>([]);

  useEffect(() => {
    if (!storeId || !isRealtimeConfiguredClient()) {
      setMembers([]);
      return;
    }
    const client = getPusherClient();
    if (!client) return;

    const channelName = storePresenceChannel(storeId);
    const channel = client.subscribe(channelName) as PresenceChannel;

    const syncMembers = () => {
      const list: PresenceMember[] = [];
      channel.members.each((member: { id: string; info: PresenceMemberInfo }) => {
        list.push({ id: member.id, name: member.info.name, role: member.info.role });
      });
      setMembers(list);
    };

    channel.bind("pusher:subscription_succeeded", syncMembers);
    channel.bind("pusher:member_added", syncMembers);
    channel.bind("pusher:member_removed", syncMembers);

    return () => {
      channel.unbind("pusher:subscription_succeeded", syncMembers);
      channel.unbind("pusher:member_added", syncMembers);
      channel.unbind("pusher:member_removed", syncMembers);
      client.unsubscribe(channelName);
      setMembers([]);
    };
  }, [storeId]);

  return members;
}
