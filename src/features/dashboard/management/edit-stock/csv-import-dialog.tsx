"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useI18n } from "@/components/lang/i18n-provider";
import { Dialog } from "@/components/ui/dialog";
import { FormDialogLayout } from "@/components/ui/form-dialog-layout";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useImportStock, type StockImportResult } from "./hooks/use-import-stock";
import { Upload, FileText, CheckCircle2, XCircle} from "lucide-react";
import { LottieLoader } from "@/components/ui/lottie-loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CSVImportDialog({ open, onOpenChange }: CSVImportDialogProps) {
  const { t } = useI18n();
  const params = useParams();
  const storeId = params?.storeId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<StockImportResult[] | null>(null);

  const importStock = useImportStock(storeId);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".csv")) {
        alert(t("management.editStock.importCSVDialog.invalidFile") || "Please select a CSV file");
        return;
      }
      setSelectedFile(file);
      setImportResults(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    try {
      const result = await importStock.mutateAsync(selectedFile);
      setImportResults(result.results);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  const successCount = importResults?.filter((r) => r.success).length || 0;
  const failureCount = importResults?.filter((r) => !r.success).length || 0;

  // Get footer buttons based on state
  const getFooterButtons = () => {
    if (!importResults) {
      return (
        <>
          <Button variant="outline" onClick={handleClose} disabled={importStock.isPending}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selectedFile || importStock.isPending}
          >
            {importStock.isPending && <LottieLoader size="xs" className="mr-1 hidden sm:inline" />}
            {t("management.editStock.importCSVDialog.importButton") || "Import Stock"}
          </Button>
        </>
      );
    }
    return (
      <Button onClick={handleClose}>
        {t("common.actions.close") || "Close"}
      </Button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <FormDialogLayout
        title={t("management.editStock.importCSVDialog.title") || "Import Stock from CSV"}
        description={
          t("management.editStock.importCSVDialog.description") ||
          "Upload a CSV file to update stock levels. The CSV should have columns: SKU, Type (material/product), Current Stock"
        }
        maxWidth="2xl"
        footer={getFooterButtons()}
      >
        <div className="space-y-4">
          {/* File Upload Section */}
          {!importResults && (
            <div className="space-y-4">
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertTitle>{t("management.editStock.importCSVDialog.formatTitle") || "CSV Format"}</AlertTitle>
                <AlertDescription>
                  {t("management.editStock.importCSVDialog.formatDescription") ||
                    "Your CSV file should have the following columns: SKU, Type (material or product), Current Stock"}
                </AlertDescription>
              </Alert>

              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-file-input"
                />
                <label htmlFor="csv-file-input" className="cursor-pointer">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm font-medium">
                    {selectedFile ? selectedFile.name : t("management.editStock.importCSVDialog.selectFile") || "Click to select CSV file"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("management.editStock.importCSVDialog.fileHint") || "CSV files only"}
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* Import Results Section */}
          {importResults && (
            <div className="space-y-4">
              <Alert variant={failureCount === 0 ? "default" : "destructive"}>
                <AlertTitle>
                  {failureCount === 0
                    ? t("management.editStock.importCSVDialog.successTitle") || "Import Successful"
                    : t("management.editStock.importCSVDialog.partialSuccessTitle") || "Import Completed with Errors"}
                </AlertTitle>
                <AlertDescription>
                  {t("management.editStock.importCSVDialog.resultsSummary")
                    ?.replace("{success}", successCount.toString())
                    ?.replace("{failed}", failureCount.toString())
                    ?.replace("{total}", importResults.length.toString()) ||
                    `Successfully imported ${successCount} items, ${failureCount} failed out of ${importResults.length} total`}
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {t("management.editStock.importCSVDialog.resultsTitle") || "Import Results"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {importResults.map((result, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded border"
                      >
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{result.sku}</p>
                            <p className="text-xs text-muted-foreground">
                              {result.type} {result.message && `- ${result.message}`}
                            </p>
                          </div>
                        </div>
                        <Badge variant={result.success ? "default" : "destructive"}>
                          {result.success ? "Success" : "Failed"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </FormDialogLayout>
    </Dialog>
  );
}

