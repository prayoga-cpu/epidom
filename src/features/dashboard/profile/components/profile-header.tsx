"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { Camera } from "lucide-react";
import { EditAvatarDialog } from "@/features/dashboard/profile/components/edit-avatar-dialog";
import {
  getStatusColor,
  getStatusLabel,
  getPlanBadgeColor,
  getPlanLabel,
} from "@/lib/utils/subscription-helpers";
import { formatDate } from "@/lib/utils/format-date";

interface ProfileHeaderProps {
  user: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
    createdAt: Date;
  };
  subscription?: {
    plan: string;
    status: string;
  } | null;
  onUpdate?: () => void;
}

export function ProfileHeader({ user, subscription, onUpdate }: ProfileHeaderProps) {
  const { t } = useI18n();
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);

  const getInitials = () => {
    if (user.name && user.name.trim().length > 0) {
      return user.name
        .trim()
        .split(" ")
        .map((n) => n?.[0] || "")
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email?.[0]?.toUpperCase() || "U";
  };

  return (
    <>
      <Card className="border-2">
        <CardContent className="p-4 sm:p-5 md:p-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="relative shrink-0">
              <Avatar className="ring-primary/10 h-20 w-20 ring-2 sm:h-24 sm:w-24 sm:ring-4">
                <AvatarImage src={user.image || undefined} alt={user.name || user.email} />
                <AvatarFallback className="from-primary to-primary/60 text-primary-foreground bg-gradient-to-br text-xl font-bold sm:text-2xl">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute -right-1 -bottom-1 h-7 w-7 rounded-full shadow-lg sm:-right-2 sm:-bottom-2 sm:h-8 sm:w-8"
                onClick={() => setAvatarDialogOpen(true)}
              >
                <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </div>

            <div className="w-full flex-1 space-y-2 text-center sm:text-left">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <h1 className="text-xl font-bold sm:text-2xl">{user.name || t("profile.user")}</h1>
                <Badge className="bg-violet-500/15 text-violet-600 border-violet-400/40 border font-semibold tracking-wide text-[10px] px-2 py-0.5 uppercase">
                  Beta
                </Badge>
                {subscription && (
                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <Badge className={getPlanBadgeColor(subscription.plan)}>
                      {getPlanLabel(subscription.plan, t)}
                    </Badge>
                    <Badge className={getStatusColor(subscription.status)}>
                      {getStatusLabel(subscription.status, t)}
                    </Badge>
                  </div>
                )}
              </div>
              <p className="text-muted-foreground text-sm break-words sm:text-base">{user.email}</p>
              <p className="text-muted-foreground text-xs sm:text-sm">
                {t("profile.personal.memberSince")} {formatDate(user.createdAt)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <EditAvatarDialog
        open={avatarDialogOpen}
        onOpenChange={setAvatarDialogOpen}
        user={user}
        onUpdate={onUpdate}
      />
    </>
  );
}
