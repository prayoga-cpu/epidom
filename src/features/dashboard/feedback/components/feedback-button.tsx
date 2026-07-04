"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/components/lang/i18n-provider";
import { FeedbackDialog } from "./feedback-dialog";

/**
 * Topbar button that opens the feedback dialog
 */
export function FeedbackButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 hover:bg-white/10"
            style={{ color: "var(--epi-cream-50)" }}
            onClick={() => setOpen(true)}
            aria-label={t("feedback.buttonLabel")}
          >
            <MessageSquarePlus className="size-4" />
            <span className="sr-only">{t("feedback.buttonLabel")}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("feedback.buttonLabel")}</TooltipContent>
      </Tooltip>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
