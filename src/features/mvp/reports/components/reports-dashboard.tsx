/**
 * Reports Dashboard Component
 *
 * Premium reports UI with all export buttons
 */

"use client";

import { useParams } from "next/navigation";
import {
  FileSpreadsheet,
  Package,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Boxes,
  Receipt,
  Calculator,
  ArrowUpRight,
  CheckCircle
} from "lucide-react";
import { ExportCard } from "./export-card";
import { getProductsForExport, getTransactionsForExport } from "../actions";

interface ReportsSummary {
  productCount: number;
  transactionCount: number;
  totalRevenue: number;
  totalStock: number;
}

interface ReportsDashboardProps {
  summary: ReportsSummary;
}

export function ReportsDashboard({ summary }: ReportsDashboardProps) {
  const params = useParams();
  const storeId = params?.storeId as string;

  const mvpComplete = summary.productCount > 0 && summary.transactionCount >= 3;

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          icon={Package}
          label="Total Products"
          value={summary.productCount}
          trend={summary.productCount > 0}
          color="blue"
        />
        <SummaryCard
          icon={Boxes}
          label="Total Stock"
          value={summary.totalStock.toLocaleString()}
          color="purple"
        />
        <SummaryCard
          icon={ShoppingCart}
          label="Transactions"
          value={summary.transactionCount}
          trend={summary.transactionCount >= 3}
          color="green"
        />
        <SummaryCard
          icon={DollarSign}
          label="Total Revenue"
          value={summary.totalRevenue.toLocaleString()}
          prefix="Rp "
          color="amber"
        />
      </div>

      {/* Export Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Export Data</h2>
            <p className="text-sm text-muted-foreground">
              Download your data as CSV for Google Sheets
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" />
            <span>Google Sheets Compatible</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ExportCard
            title="Product Master"
            description="All product information: SKU, Name, Category, Unit"
            filename="product-master"
            icon={Package}
            getData={async () => {
              const products = await getProductsForExport(storeId);
              return products.map((p) => ({
                SKU: p.sku,
                Name: p.name,
                Category: p.category || "",
                Unit: p.unit,
              }));
            }}
          />

          <ExportCard
            title="Stock Report"
            description="Current inventory levels for all products"
            filename="stock-report"
            icon={Boxes}
            getData={async () => {
              const products = await getProductsForExport(storeId);
              return products.map((p) => ({
                SKU: p.sku,
                Name: p.name,
                "Current Stock": p.currentStock,
                Unit: p.unit,
              }));
            }}
          />

          <ExportCard
            title="COGS Report"
            description="Cost of Goods Sold with margin analysis"
            filename="cogs-report"
            icon={Calculator}
            getData={async () => {
              const products = await getProductsForExport(storeId);
              return products.map((p) => {
                const margin = p.sellingPrice - p.costPrice;
                const marginPct = p.sellingPrice > 0 ? (margin / p.sellingPrice) * 100 : 0;
                return {
                  SKU: p.sku,
                  Name: p.name,
                  "Cost Price": p.costPrice,
                  "Selling Price": p.sellingPrice,
                  Margin: margin,
                  "Margin %": marginPct.toFixed(1),
                };
              });
            }}
          />

          <ExportCard
            title="Transaction Summary"
            description="All POS transactions with totals"
            filename="transactions-report"
            icon={Receipt}
            getData={async () => {
              const transactions = await getTransactionsForExport(storeId);
              return transactions.map((t) => ({
                "Order Number": t.orderNumber,
                Date: t.orderDate,
                Items: t.itemCount,
                Quantity: t.totalQuantity,
                Revenue: t.totalRevenue,
                Cost: t.totalCost,
                Profit: t.profit,
              }));
            }}
          />
        </div>
      </div>

      {/* Detailed Export */}
      <div className="rounded-xl border bg-gradient-to-br from-muted/50 to-muted/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-xl bg-primary/10 p-3">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold">Transaction Details</h3>
            <p className="text-sm text-muted-foreground">
              Detailed line-item export for P&L analysis
            </p>
          </div>
        </div>
        <ExportCard
          title="Full Transaction Details"
          description="Every item in every transaction with cost and profit breakdown"
          filename="transaction-details"
          icon={FileSpreadsheet}
          getData={async () => {
            const transactions = await getTransactionsForExport(storeId);
            const rows: Record<string, unknown>[] = [];

            for (const t of transactions) {
              for (const item of t.items) {
                rows.push({
                  "Order Number": t.orderNumber,
                  Date: t.orderDate,
                  SKU: item.sku,
                  Product: item.name,
                  Quantity: item.quantity,
                  "Unit Price": item.unitPrice,
                  Total: item.total,
                  "Cost Price": item.costPrice,
                  Profit: item.total - (item.costPrice * Number(item.quantity)),
                });
              }
            }

            return rows;
          }}
        />
      </div>

      {/* MVP Validation Checklist */}
      <div className={`rounded-xl border p-6 ${
        mvpComplete
          ? "bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/30"
          : "bg-muted/50"
      }`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`rounded-full p-2 ${mvpComplete ? "bg-green-500" : "bg-muted"}`}>
            <CheckCircle className={`h-5 w-5 ${mvpComplete ? "text-white" : "text-muted-foreground"}`} />
          </div>
          <div>
            <h3 className="font-bold">
              {mvpComplete ? "🎉 MVP Complete!" : "MVP Checklist"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {mvpComplete
                ? "All requirements met. Export your data and you're done!"
                : "Complete these steps to finish the MVP"}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <ChecklistItem
            checked={summary.productCount > 0}
            label="Product Master imported"
          />
          <ChecklistItem
            checked={summary.productCount > 0}
            label="Stock data populated"
          />
          <ChecklistItem
            checked={summary.productCount > 0}
            label="COGS data available"
          />
          <ChecklistItem
            checked={summary.transactionCount >= 3}
            label={`3+ transactions (${summary.transactionCount}/3)`}
          />
        </div>

        {mvpComplete && (
          <div className="mt-4 pt-4 border-t border-green-500/20">
            <p className="text-sm text-green-700 dark:text-green-400">
              ✅ All exports are ready. Download your CSV files to use in Google Sheets.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  prefix,
  trend,
  color = "blue",
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  prefix?: string;
  trend?: boolean;
  color?: "blue" | "green" | "purple" | "amber";
}) {
  const colorClasses = {
    blue: "from-blue-500/10 to-blue-500/5 border-blue-500/20",
    green: "from-green-500/10 to-green-500/5 border-green-500/20",
    purple: "from-purple-500/10 to-purple-500/5 border-purple-500/20",
    amber: "from-amber-500/10 to-amber-500/5 border-amber-500/20",
  };

  const iconColors = {
    blue: "bg-blue-500/20 text-blue-600",
    green: "bg-green-500/20 text-green-600",
    purple: "bg-purple-500/20 text-purple-600",
    amber: "bg-amber-500/20 text-amber-600",
  };

  return (
    <div className={`rounded-xl bg-gradient-to-br border p-5 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div className={`rounded-xl p-2.5 ${iconColors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
            <ArrowUpRight className="h-3 w-3" />
            Ready
          </div>
        )}
      </div>
      <p className="text-2xl font-bold mt-4 tabular-nums">
        {prefix}{value}
      </p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function ChecklistItem({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
      checked ? "bg-green-500/10" : "bg-muted/50"
    }`}>
      <div className={`rounded-full p-1 ${checked ? "bg-green-500" : "bg-muted"}`}>
        <CheckCircle className={`h-3.5 w-3.5 ${checked ? "text-white" : "text-muted-foreground"}`} />
      </div>
      <span className={`text-sm font-medium ${checked ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}
