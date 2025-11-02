"use client";

import { useState } from "react";
import { Activity, LogIn, LogOut, Edit, Plus, Trash2, Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/components/lang/i18n-provider";
import { formatDistanceToNow } from "date-fns";

interface ActivityEntry {
  id: string;
  action: string;
  entity?: string;
  field?: string;
  timestamp: Date;
  type: "login" | "logout" | "update" | "create" | "delete";
}

// Mock activity data - TODO: Replace with actual API data
const MOCK_ACTIVITY: ActivityEntry[] = [
  {
    id: "1",
    action: "login",
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    type: "login",
  },
  {
    id: "2",
    action: "updateMaterial",
    entity: "Flour",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    type: "update",
  },
  {
    id: "3",
    action: "createRecipe",
    entity: "Croissant",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    type: "create",
  },
  {
    id: "4",
    action: "updateProfile",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    type: "update",
  },
  {
    id: "5",
    action: "createOrder",
    entity: "ORD-001",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
    type: "create",
  },
  {
    id: "6",
    action: "createProduction",
    entity: "Batch #42",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    type: "create",
  },
  {
    id: "7",
    action: "updateBusiness",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 1 week ago
    type: "update",
  },
];

function getActionIcon(type: ActivityEntry["type"]) {
  switch (type) {
    case "login":
      return <LogIn className="h-4 w-4" />;
    case "logout":
      return <LogOut className="h-4 w-4" />;
    case "update":
      return <Edit className="h-4 w-4" />;
    case "create":
      return <Plus className="h-4 w-4" />;
    case "delete":
      return <Trash2 className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
}

function getActionColor(type: ActivityEntry["type"]) {
  switch (type) {
    case "login":
      return "bg-green-500/10 text-green-700 dark:text-green-400";
    case "logout":
      return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
    case "update":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
    case "create":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
    case "delete":
      return "bg-red-500/10 text-red-700 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function ActivityLogCard() {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const displayedActivities = showAll ? MOCK_ACTIVITY : MOCK_ACTIVITY.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle>{t("profile.activity.title")}</CardTitle>
          </div>
          <Badge variant="secondary">{MOCK_ACTIVITY.length} {t("profile.activity.items")}</Badge>
        </div>
        <CardDescription>
          {t("profile.activity.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {displayedActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="mb-4 h-12 w-12 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              {t("profile.activity.noActivity")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedActivities.map((activity, index) => (
              <div key={activity.id}>
                <div className="flex items-start gap-4">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${getActionColor(activity.type)}`}>
                    {getActionIcon(activity.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {t(`profile.activity.actions.${activity.action}`)}
                      {activity.entity && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          - {activity.entity}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    </p>
                  </div>
                </div>
                {index < displayedActivities.length - 1 && (
                  <Separator className="my-4" />
                )}
              </div>
            ))}
          </div>
        )}

        {MOCK_ACTIVITY.length > 5 && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll
                ? t("profile.activity.showLess")
                : `${t("profile.activity.viewAll")} (${MOCK_ACTIVITY.length - 5} ${t("profile.activity.more")})`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
