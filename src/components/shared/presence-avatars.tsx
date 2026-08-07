"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useStorePresence, type PresenceMember } from "@/hooks/use-store-presence";
import { useI18n } from "@/components/lang/i18n-provider";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * Small avatar stack showing who else is currently on this store's
 * dashboard/POS right now — the live-presence signal, distinct from the
 * data-push channel. Renders nothing when nobody else is connected or
 * Pusher isn't configured, so it's safe to drop into any shared layout
 * (topbar, POS shell) without a loading/empty state to design around.
 */
export function PresenceAvatars({ storeId, max = 4 }: { storeId: string; max?: number }) {
  const members = useStorePresence(storeId);
  const { t } = useI18n();

  if (members.length === 0) return null;

  const visible = members.slice(0, max);
  const overflow = members.length - visible.length;

  return (
    <div className="flex items-center" aria-label={t("common.presence.onlineNow")}>
      <div className="-space-x-2 flex items-center">
        {visible.map((member) => (
          <PresenceAvatar key={member.id} member={member} />
        ))}
        {overflow > 0 && (
          <div
            className="border-background bg-muted text-muted-foreground relative flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium"
            title={t("common.presence.andMore").replace("{count}", String(overflow))}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}

function PresenceAvatar({ member }: { member: PresenceMember }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar className={cn("border-background size-8 border-2")}>
          <AvatarFallback className={cn(colorFor(member.id), "text-xs font-medium text-white")}>
            {initials(member.name)}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>{member.name}</TooltipContent>
    </Tooltip>
  );
}
