"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/components/lang/i18n-provider";

interface ProfileHeaderProps {
  user: {
    name?: string | null;
    email: string;
    image?: string | null;
    createdAt: Date;
  };
  subscription?: {
    plan: string;
    status: string;
  } | null;
}

export function ProfileHeader({ user, subscription }: ProfileHeaderProps) {
  const { t } = useI18n();

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

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "CANCELED":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "PAST_DUE":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "ACTIVE":
        return t("profile.subscription.status.active") || status;
      case "CANCELED":
        return t("profile.subscription.status.canceled") || status;
      case "PAST_DUE":
        return t("profile.subscription.status.pastDue") || status;
      default:
        return status || "";
    }
  };

  const getPlanBadge = (plan?: string) => {
    switch (plan) {
      case "PRO":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "ENTERPRISE":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getPlanLabel = (plan?: string) => {
    switch (plan) {
      case "PRO":
        return t("profile.subscription.plans.pro") || plan;
      case "ENTERPRISE":
        return t("profile.subscription.plans.enterprise") || plan;
      default:
        return t("profile.subscription.plans.starter") || plan || "";
    }
  };

  return (
    <Card className="border-2">
      <CardContent className="p-6">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <Avatar className="ring-primary/10 h-24 w-24 ring-4">
            <AvatarImage src={user.image || undefined} alt={user.name || user.email} />
            <AvatarFallback className="from-primary to-primary/60 text-primary-foreground bg-gradient-to-br text-2xl font-bold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <h1 className="text-2xl font-bold">{user.name || t("profile.user")}</h1>
              {subscription && (
                <div className="flex gap-2">
                  <Badge className={getPlanBadge(subscription.plan)}>{getPlanLabel(subscription.plan)}</Badge>
                  <Badge className={getStatusColor(subscription.status)}>
                    {getStatusLabel(subscription.status)}
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
  );
}
