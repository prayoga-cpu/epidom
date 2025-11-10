"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/lang/i18n-provider";
import { Camera } from "lucide-react";
import { EditAvatarDialog } from "@/features/dashboard/profile/components/edit-avatar-dialog";
import { getStatusColor, getStatusLabel, getPlanBadgeColor, getPlanLabel } from "@/lib/utils/subscription-helpers";

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
    if (user.name) {
      return user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email[0].toUpperCase();
  };


  return (
    <>
      <Card className="border-2">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <div className="relative">
              <Avatar className="ring-primary/10 h-24 w-24 ring-4">
                <AvatarImage src={user.image || undefined} alt={user.name || user.email} />
                <AvatarFallback className="from-primary to-primary/60 text-primary-foreground bg-gradient-to-br text-2xl font-bold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute -right-2 -bottom-2 h-8 w-8 rounded-full shadow-lg"
                onClick={() => setAvatarDialogOpen(true)}
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center">
                <h1 className="text-2xl font-bold">{user.name || t("profile.user")}</h1>
                {subscription && (
                  <div className="flex gap-2">
                    <Badge className={getPlanBadgeColor(subscription.plan)}>
                      {getPlanLabel(subscription.plan, t)}
                    </Badge>
                    <Badge className={getStatusColor(subscription.status)}>
                      {getStatusLabel(subscription.status, t)}
                    </Badge>
                  </div>
                )}
              </div>
              <p className="text-muted-foreground">{user.email}</p>
              <p className="text-muted-foreground text-sm">
                {t("profile.memberSince")} {new Date(user.createdAt).toLocaleDateString()}
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
