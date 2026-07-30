"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Button } from "@/components/ui/button";
import { Download, Copy, Check } from "lucide-react";
import { downloadDataUrl } from "@/lib/utils/export";
import { useI18n } from "@/components/lang/i18n-provider";
import { useState } from "react";
import { Input } from "@/components/ui/input";

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
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    downloadDataUrl(canvas.toDataURL("image/png"), filename);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <div className="flex flex-col gap-4 py-2">
          <div className="flex justify-center">
            <div className="rounded-xl border-2 border-slate-100 bg-white p-4">
              <QRCodeCanvas ref={canvasRef} value={value} size={200} level="M" marginSize={0} />
            </div>
          </div>
          
          <div className="flex items-center space-x-2 px-1">
            <Input 
              value={value} 
              readOnly 
              className="bg-muted text-muted-foreground flex-1 cursor-text"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={handleCopy}
            >
              {copied ? <Check className="text-green-500 size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>
      </FormDialogLayout>
    </Dialog>
  );
}
