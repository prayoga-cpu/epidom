"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { downloadDataUrl } from "@/lib/utils/export";
import { useI18n } from "@/components/lang/i18n-provider";

interface QrCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  title: string;
  description?: string;
  filename: string;
}

export function QrCodeDialog({
  open,
  onOpenChange,
  value,
  title,
  description,
  filename,
}: QrCodeDialogProps) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    downloadDataUrl(canvas.toDataURL("image/png"), filename);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FormDialogLayout
        title={title}
        description={description}
        maxWidth="sm"
        footer={
          <Button onClick={handleDownload} className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            {t("common.actions.download")}
          </Button>
        }
      >
        <div className="flex justify-center py-2">
          <div className="rounded-xl border-2 border-slate-100 bg-white p-4">
            <QRCodeCanvas ref={canvasRef} value={value} size={200} level="M" marginSize={0} />
          </div>
        </div>
      </FormDialogLayout>
    </Dialog>
  );
}
